import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  'mailto:sistema@cajado.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// POST /api/push/send — envia notificação para um ou todos dispositivos do usuário
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, title, message, url, tag, requireInteraction } = body

    if (!userId || !title) {
      return NextResponse.json({ error: 'userId e title são obrigatórios' }, { status: 400 })
    }

    // Busca todas as subscriptions do usuário
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error) throw error
    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: false, msg: 'Nenhum dispositivo registrado' })
    }

    const payload = JSON.stringify({
      title,
      body:               message || title,
      url:                url || '/inicio',
      tag:                tag || 'cajado-' + Date.now(),
      requireInteraction: requireInteraction ?? true,
    })

    const resultados = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async err => {
          // Se o endpoint expirou, remove do banco
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions')
              .delete().eq('endpoint', sub.endpoint)
          }
          throw err
        })
      )
    )

    const enviados = resultados.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, enviados, total: subs.length })

  } catch (err: any) {
    console.error('[Push Send]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
