import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Salva a push subscription do usuário no banco
export async function POST(req: Request) {
  try {
    const { subscription, userId } = await req.json()

    if (!subscription || !userId) {
      return NextResponse.json({ error: 'subscription e userId obrigatórios' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Upsert: atualiza se endpoint já existe, insere se não
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: 'endpoint' }
      )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/subscribe]', err)
    return NextResponse.json({ error: 'Erro ao salvar subscription' }, { status: 500 })
  }
}
