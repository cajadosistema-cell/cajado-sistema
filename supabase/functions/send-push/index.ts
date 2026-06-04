// supabase/functions/send-push/index.ts
// Edge Function que verifica eventos próximos e envia push notifications
// Chamada pelo cliente a cada 30s (polling) OU via cron (se configurado)
// Compatível com iOS 16.4+ PWA, Android Chrome, Desktop

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Web Push via VAPID ────────────────────────────────────────────────────
// Implementação manual de web push para Deno (sem depender de web-push npm)
async function gerarJWT(vapidPublic: string, vapidPrivate: string, audience: string): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT' }
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:sistema@cajado.com.br',
  }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const signingInput = `${encode(header)}.${encode(payload)}`

  // Importa chave privada VAPID (formato base64url → DER)
  const privateKeyBytes = base64UrlToBytes(vapidPrivate)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const sigB64 = bytesToBase64Url(new Uint8Array(signature))
  return `${signingInput}.${sigB64}`
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64url.length + (4 - b64url.length % 4) % 4, '='
  )
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function enviarPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublic: string,
  vapidPrivate: string
) {
  const url = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const jwt = await gerarJWT(vapidPublic, vapidPrivate, audience)

  const body = JSON.stringify(payload)

  const resp = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'TTL': '60',
      'Authorization': `vapid t=${jwt},k=${vapidPublic}`,
    },
    body,
  })

  return resp.status
}

// ── Handler principal ─────────────────────────────────────────────────────
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!

    // Recebe userId do corpo (chamada do cliente) ou usa service role para varredura geral
    let targetUserId: string | null = null
    try {
      const body = await req.json()
      targetUserId = body.userId || null
    } catch {}

    // Janela: eventos nos próximos 2-5 minutos (para alerta de antecedência)
    const agora = new Date()
    const em2min = new Date(agora.getTime() + 2 * 60 * 1000)
    const em5min = new Date(agora.getTime() + 5 * 60 * 1000)
    // E também eventos passando AGORA (0-1 min)
    const ha1min = new Date(agora.getTime() - 1 * 60 * 1000)

    let query = supabase
      .from('agenda_eventos')
      .select('id, user_id, titulo, data_inicio, tipo')
      .neq('status', 'cancelado')
      .gte('data_inicio', ha1min.toISOString())
      .lte('data_inicio', em5min.toISOString())

    if (targetUserId) query = query.eq('user_id', targetUserId)

    const { data: eventos } = await query

    if (!eventos || eventos.length === 0) {
      return new Response(JSON.stringify({ enviados: 0, msg: 'Nenhum evento próximo' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    let enviados = 0

    for (const ev of eventos) {
      const dataEvento = new Date(ev.data_inicio)
      const diffMin = (dataEvento.getTime() - agora.getTime()) / 60000

      // Define tipo de alerta
      const ehAntecipado = diffMin >= 2 && diffMin <= 5
      const ehAgora = diffMin < 2

      if (!ehAntecipado && !ehAgora) continue

      // Busca subscriptions do usuário
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', ev.user_id)

      if (!subs || subs.length === 0) continue

      const titulo = ehAntecipado
        ? `⏰ Em 3 minutos: ${ev.titulo}`
        : `🔔 Agora: ${ev.titulo}`

      const corpo = ehAntecipado
        ? 'Prepare-se! O evento começa em breve.'
        : 'O evento está começando AGORA!'

      const payload = {
        title: titulo,
        body: corpo,
        tag: `${ev.id}-${ehAntecipado ? '3min' : '0min'}`,
        url: '/pf-pessoal',
        requireInteraction: true,
        vibrate: ehAgora ? [300, 100, 300, 100, 300] : [200, 100, 200],
      }

      for (const sub of subs) {
        try {
          const status = await enviarPush(sub, payload, VAPID_PUBLIC, VAPID_PRIVATE)
          if (status === 200 || status === 201) enviados++
          // 410 = subscription expirada, remove do banco
          if (status === 410) {
            await supabase.from('push_subscriptions')
              .delete().eq('endpoint', sub.endpoint)
          }
        } catch { /* ignora erros individuais */ }
      }
    }

    return new Response(JSON.stringify({ enviados }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
