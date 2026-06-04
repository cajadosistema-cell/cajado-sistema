import { NextResponse } from 'next/server'

// Endpoint chamado pelo cron-job.org 1x por dia (ex: 07:00)
// Gera automaticamente eventos de vencimento na agenda para:
//   - Cartões de crédito cadastrados (com dia_vencimento)
//   - Contas recorrentes na tabela alertas_recorrentes
// Isso elimina a necessidade de criar alertas manualmente todo mês.

export async function GET(request: Request) {
  const url   = new URL(request.url)
  const token = url.searchParams.get('token') || request.headers.get('x-cron-token')

  const expectedToken = process.env.CRON_SECRET || 'cajado-cron-2025'
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supaUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supaUrl || !anonKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const resp = await fetch(`${supaUrl}/functions/v1/gerar-vencimentos`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({}),
    })

    const data = await resp.json().catch(() => ({}))

    console.log('[daily-vencimentos] Resultado:', data)
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...data,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const POST = GET
