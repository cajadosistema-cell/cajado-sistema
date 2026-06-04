import { NextResponse } from 'next/server'

// Endpoint chamado por serviço de cron externo (ex: cron-job.org) a cada minuto
// Envia push notifications para eventos próximos de TODOS os usuários
// Mesmo com o app fechado no iPhone PWA

export async function GET(request: Request) {
  // Proteção simples: verifica um token secreto no header ou query
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
    || request.headers.get('x-cron-token')

  const expectedToken = process.env.CRON_SECRET || 'cajado-cron-2025'
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supaUrl || !anonKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    // Chama a Edge Function — sem userId = verifica TODOS os usuários
    const resp = await fetch(`${supaUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({}),
    })

    const data = await resp.json().catch(() => ({}))
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST também aceito (alguns serviços de cron usam POST)
export const POST = GET
