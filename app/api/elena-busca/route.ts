import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

/**
 * POST /api/elena-busca
 * Busca conversas relevantes no histórico do Supabase (elena_conversas)
 * para injetar no contexto da Elena quando o usuário perguntar sobre conversas passadas.
 *
 * Body: { termo: string, limite?: number }
 * Response: { mensagens: Array<{ role, texto, created_at }> }
 */
export async function POST(req: NextRequest) {
  try {
    const { termo, limite = 10 } = await req.json()

    if (!termo || typeof termo !== 'string' || termo.trim().length < 2) {
      return NextResponse.json({ mensagens: [] })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: CookieToSet[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options as any)
              )
            } catch {}
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Palavras para busca — filtra stopwords e usa todas relevantes
    const palavras = termo
      .toLowerCase()
      .split(/\s+/)
      .filter((p: string) => p.length > 3)  // Ignora palavras curtas (artigos, preposições)
      .slice(0, 6)  // No máximo 6 palavras para a query

    if (palavras.length === 0) {
      return NextResponse.json({ mensagens: [] })
    }

    // Monta filtro OR com todas as palavras relevantes (não só a primeira)
    const orFiltros = palavras.map((p: string) => `texto.ilike.%${p}%`).join(',')
    const orFiltrosRegistro = palavras.map((p: string) =>
      `titulo.ilike.%${p}%,conteudo.ilike.%${p}%,chave.ilike.%${p}%`
    ).join(',')

    // Detecta se é pedido de relatório financeiro (busca mais ampla)
    const RELATORIO_KEYWORDS = ['relatorio', 'relatório', 'balanço', 'balanco', 'resumo financeiro',
      'quanto gastei', 'quanto recebi', 'gastos do mes', 'receitas do mes', 'analise do mes']
    const isFinanceiro = RELATORIO_KEYWORDS.some(kw => termo.toLowerCase().includes(kw))

    // Busca em paralelo: conversas históricas + memória universal
    const [{ data: msgs, error }, { data: registros }] = await Promise.all([
      // 1. Conversas históricas (elena_conversas) — busca por múltiplas palavras
      supabase
        .from('elena_conversas')
        .select('id, role, texto, sessao_id, created_at')
        .eq('user_id', user.id)
        .or(orFiltros)
        .order('created_at', { ascending: false })
        .limit(limite * 3),

      // 2. Memória universal (elena_registro)
      (supabase.from('elena_registro') as any)
        .select('id, tipo, chave, titulo, conteudo, importante, criado_em')
        .eq('user_id', user.id)
        .or(orFiltrosRegistro)
        .order('importante', { ascending: false })
        .limit(10),
    ])

    if (error || !msgs) {
      return NextResponse.json({ mensagens: [] })
    }

    // Pontua e filtra conversas
    const pontuadas = msgs
      .map((m: any) => {
        const textoLower = (m.texto || '').toLowerCase()
        const pontos = palavras.filter((p: string) => textoLower.includes(p)).length
        return { ...m, pontos }
      })
      .filter((m: any) => m.pontos > 0)
      .sort((a: any, b: any) => b.pontos - a.pontos)
      .slice(0, limite)

    // Formata conversas
    const mensagens = pontuadas.map((m: any) => ({
      role: m.role,
      texto: m.texto?.substring(0, 400) || '',
      created_at: m.created_at,
      sessao_id: m.sessao_id,
    }))

    // Formata registros da memória universal
    const memoriaEncontrada = (registros || []).map((r: any) => ({
      role: 'ai' as const,
      texto: `[MEMÓRIA ${(r.tipo || '').toUpperCase()}] ${r.titulo}: ${r.conteudo || ''}`,
      created_at: r.criado_em,
      sessao_id: 'memoria',
    }))

    // Junta: memória primeiro (mais relevante), depois conversas
    const todos = [...memoriaEncontrada, ...mensagens].slice(0, limite)

    return NextResponse.json({ mensagens: todos, total: todos.length, memoria: memoriaEncontrada.length })
  } catch (err: any) {
    console.error('[Elena Busca]', err)
    return NextResponse.json({ mensagens: [], error: err.message })
  }
}
