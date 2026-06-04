// supabase/functions/send-push/index.ts
// Edge Function: Web Push via VAPID correto (PKCS8 para chave privada EC P-256)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Helpers base64url ─────────────────────────────────────────────────────
function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(b64url.length + (4 - b64url.length % 4) % 4, '=')
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── Importa chave privada EC P-256 em formato PKCS8 ──────────────────────
// O WebCrypto API NÃO suporta 'raw' para ECDSA private keys.
// É necessário encapsular os 32 bytes no envelope PKCS8 de P-256.
async function importarChavePrivadaVAPID(rawPrivateKey: Uint8Array): Promise<CryptoKey> {
  // Header PKCS8 para EC P-256 (RFC 5958 / SEC1)
  // Construído conforme: SEQUENCE { INTEGER 0, SEQUENCE { OID ecPublicKey, OID prime256v1 }, OCTET STRING { SEQUENCE { INTEGER 1, OCTET STRING { d } } } }
  const pkcs8Header = new Uint8Array([
    0x30, 0x41,              // SEQUENCE (65 bytes)
      0x02, 0x01, 0x00,      // INTEGER version = 0
      0x30, 0x13,            // SEQUENCE algorithmIdentifier
        0x06, 0x07,          // OID ecPublicKey
          0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
        0x06, 0x08,          // OID prime256v1
          0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
      0x04, 0x27,            // OCTET STRING (39 bytes) = privateKey
        0x30, 0x25,          // SEQUENCE ECPrivateKey
          0x02, 0x01, 0x01,  // INTEGER version = 1
          0x04, 0x20,        // OCTET STRING (32 bytes) = d
  ])

  const pkcs8 = new Uint8Array(pkcs8Header.length + 32)
  pkcs8.set(pkcs8Header)
  pkcs8.set(rawPrivateKey.slice(0, 32), pkcs8Header.length)

  return await crypto.subtle.importKey(
    'pkcs8',
    pkcs8.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

// ── Gera JWT VAPID ────────────────────────────────────────────────────────
async function gerarJWT(vapidPublic: string, vapidPrivate: string, audience: string): Promise<string> {
  const header  = { alg: 'ES256', typ: 'JWT' }
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:sistema@cajado.com.br',
  }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const signingInput = `${encode(header)}.${encode(payload)}`

  const privateKeyBytes = base64UrlToBytes(vapidPrivate)
  const cryptoKey = await importarChavePrivadaVAPID(privateKeyBytes)

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const sigB64 = bytesToBase64Url(new Uint8Array(signature))
  return `${signingInput}.${sigB64}`
}

// ── Envia push para um endpoint ───────────────────────────────────────────
async function enviarPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublic: string,
  vapidPrivate: string
): Promise<number> {
  const url      = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const jwt      = await gerarJWT(vapidPublic, vapidPrivate, audience)
  const body     = JSON.stringify(payload)

  const resp = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'TTL':           '60',
      'Urgency':       'high',
      'Authorization': `vapid t=${jwt},k=${vapidPublic}`,
    },
    body,
  })

  return resp.status
}

// ── Handler principal ─────────────────────────────────────────────────────
serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      console.error('[send-push] VAPID keys não configuradas!')
      return new Response(JSON.stringify({ error: 'VAPID keys missing' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...cors }
      })
    }

    // userId opcional (chamada do cliente) ou varre todos (chamada do cron)
    let targetUserId: string | null = null
    try {
      const body = await req.json()
      targetUserId = body?.userId || null
    } catch { /* sem body */ }

    // Janela de verificação: -1 min a +5 min
    const agora  = new Date()
    const ha1min = new Date(agora.getTime() - 1 * 60 * 1000)
    const em5min = new Date(agora.getTime() + 5 * 60 * 1000)

    let query = supabase
      .from('agenda_eventos')
      .select('id, user_id, titulo, data_inicio, tipo')
      .neq('status', 'cancelado')
      .neq('status', 'concluido')
      .is('push_enviado', null)
      .gte('data_inicio', ha1min.toISOString())
      .lte('data_inicio', em5min.toISOString())

    if (targetUserId) query = query.eq('user_id', targetUserId)

    const { data: eventos, error: errEventos } = await query

    if (errEventos) {
      console.error('[send-push] Erro ao buscar eventos:', errEventos.message)
      return new Response(JSON.stringify({ error: errEventos.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...cors }
      })
    }

    if (!eventos || eventos.length === 0) {
      return new Response(JSON.stringify({ enviados: 0, msg: 'Nenhum evento próximo' }), {
        headers: { 'Content-Type': 'application/json', ...cors }
      })
    }

    console.log(`[send-push] ${eventos.length} evento(s) encontrado(s) na janela`)

    let enviados = 0
    const erros: string[] = []

    for (const ev of eventos) {
      const dataEvento = new Date(ev.data_inicio)
      const diffMin    = (dataEvento.getTime() - agora.getTime()) / 60000

      const ehAntecipado = diffMin >= 2 && diffMin <= 5
      const ehAgora      = diffMin > -1 && diffMin < 2

      if (!ehAntecipado && !ehAgora) continue

      // Busca subscriptions do usuário
      const { data: subs, error: errSubs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', ev.user_id)

      if (errSubs) {
        console.error(`[send-push] Erro subscriptions user ${ev.user_id}:`, errSubs.message)
        continue
      }

      if (!subs || subs.length === 0) {
        console.log(`[send-push] Sem subscriptions para user ${ev.user_id}`)
        continue
      }

      const titulo = ehAntecipado
        ? `⏰ Em 3 minutos: ${ev.titulo}`
        : `🔔 Agora: ${ev.titulo}`

      const corpo = ehAntecipado
        ? 'Prepare-se! O evento começa em breve.'
        : 'O evento está começando AGORA!'

      const payload = {
        title:             titulo,
        body:              corpo,
        tag:               `${ev.id}-${ehAntecipado ? '3min' : '0min'}`,
        url:               '/pf-pessoal',
        requireInteraction: true,
        vibrate:           ehAgora ? [300, 100, 300, 100, 300] : [200, 100, 200],
      }

      for (const sub of subs) {
        try {
          const status = await enviarPush(sub, payload, VAPID_PUBLIC, VAPID_PRIVATE)
          console.log(`[send-push] Evento "${ev.titulo}" → endpoint status: ${status}`)

          if (status === 200 || status === 201) {
            enviados++
            // Marca push_enviado para evitar duplicatas
            await supabase.from('agenda_eventos').update({ push_enviado: new Date().toISOString() }).eq('id', ev.id)
          } else if (status === 410 || status === 404) {
            // Subscription expirada — remove
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            console.log(`[send-push] Subscription removida (status ${status})`)
          } else {
            erros.push(`status ${status} para evento ${ev.id}`)
          }
        } catch (e) {
          console.error(`[send-push] Erro ao enviar push:`, String(e))
          erros.push(String(e))
        }
      }
    }

    console.log(`[send-push] Concluído: ${enviados} enviado(s), ${erros.length} erro(s)`)
    return new Response(JSON.stringify({ enviados, erros: erros.length, total_eventos: eventos.length }), {
      headers: { 'Content-Type': 'application/json', ...cors }
    })

  } catch (err) {
    console.error('[send-push] Erro geral:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...cors }
    })
  }
})
