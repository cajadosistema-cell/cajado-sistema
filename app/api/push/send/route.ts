import { NextResponse } from 'next/server'
import webPush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webPush.setVapidDetails(
  process.env.VAPID_CONTACT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// Envia push para um ou mais usuários destinatários
export async function POST(req: Request) {
  try {
    const { destinatarioId, remetenteNome, texto, url } = await req.json()

    if (!destinatarioId) {
      return NextResponse.json({ error: 'destinatarioId obrigatório' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Busca todas as subscriptions do destinatário
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', destinatarioId)

    if (error) throw error
    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const payload = JSON.stringify({
      title: `💬 ${remetenteNome || 'Chat Cajado'}`,
      body: texto || 'Nova mensagem',
      tag: `chat-${destinatarioId}`,
      url: url || '/comunicacao',
    })

    // Envia para todos os dispositivos registrados
    const results = await Promise.allSettled(
      subs.map(sub =>
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      )
    )

    // Remove subscriptions expiradas (status 404 ou 410)
    const expiredEndpoints: string[] = []
    results.forEach((result, i) => {
      if (
        result.status === 'rejected' &&
        result.reason &&
        (result.reason.statusCode === 404 || result.reason.statusCode === 410)
      ) {
        expiredEndpoints.push(subs[i].endpoint)
      }
    })

    if (expiredEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    console.error('[push/send]', err)
    return NextResponse.json({ error: 'Erro ao enviar push' }, { status: 500 })
  }
}
