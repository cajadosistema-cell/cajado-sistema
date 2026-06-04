import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Rota cron chamada pelo Railway a cada minuto.
 * Busca eventos próximos (janela -1 a +5 min) e envia push notifications
 * via a Edge Function send-push do Supabase.
 * 
 * Protegida pelo CRON_SECRET para evitar chamadas não autorizadas.
 */
export async function GET(req: Request) {
  try {
    // Verifica o secret para segurança
    const url = new URL(req.url)
    const secret = url.searchParams.get('secret') || req.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Chama a Edge Function send-push do Supabase
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({}),
    })

    const data = await resp.json()
    console.log(`[cron/send-push] ${new Date().toISOString()} — resultado:`, data)

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...data,
    })
  } catch (err: any) {
    console.error('[cron/send-push] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
