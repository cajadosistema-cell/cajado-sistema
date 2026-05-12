import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/push/subscribe — salva subscription do dispositivo
export async function POST(req: NextRequest) {
  try {
    const { subscription, userId } = await req.json()
    if (!subscription?.endpoint || !userId) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('push_subscriptions').upsert({
      user_id:    userId,
      endpoint:   subscription.endpoint,
      p256dh:     subscription.keys.p256dh,
      auth:       subscription.keys.auth,
      user_agent: req.headers.get('user-agent') || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/push/subscribe — remove subscription
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint, userId } = await req.json()
    await supabaseAdmin.from('push_subscriptions')
      .delete().eq('user_id', userId).eq('endpoint', endpoint)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
