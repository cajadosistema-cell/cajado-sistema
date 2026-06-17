import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

/**
 * POST /api/elena-busca
 * Busca conversas relevantes no histórico do Supabase (elena_conversas)
 * usando Full-Text Search (FTS) com stemming em português.
 * Fallback para ILIKE se FTS não encontrar resultados.
 *
 * Body: { termo: string, limite?: number }
 * Response: { mensagens: Array<{ role, texto, created_at }> }
 */

// ── Helper: detectar range de data no texto do usuário ──────
function detectarRangeData(texto: string): { inicio?: string; fim?: string } | null {
  const lower = texto.toLowerCase()
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = agora.getMonth() // 0-indexed

  // Meses explícitos
  const MESES: Record<string, number> = {
    janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
    julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
  }
  for (const [nome, idx] of Object.entries(MESES)) {
    if (lower.includes(nome)) {
      const anoAlvo = idx > mes ? ano - 1 : ano // se o mês é futuro, assume ano passado
      const inicio = `${anoAlvo}-${String(idx + 1).padStart(2, '0')}-01`
      const ultimoDia = new Date(anoAlvo, idx + 1, 0).getDate()
      const fim = `${anoAlvo}-${String(idx + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
      return { inicio: `${inicio}T00:00:00`, fim: `${fim}T23:59:59` }
    }
  }

  // Hoje
  if (lower.includes('hoje') || lower.includes('de hoje') || lower.includes('conversas de hoje')) {
    const hoje = agora.toISOString().split('T')[0]
    return { inicio: `${hoje}T00:00:00`, fim: `${hoje}T23:59:59` }
  }

  // Ontem
  if (lower.includes('ontem')) {
    const ontem = new Date(agora)
    ontem.setDate(ontem.getDate() - 1)
    const d = ontem.toISOString().split('T')[0]
    return { inicio: `${d}T00:00:00`, fim: `${d}T23:59:59` }
  }

  // Semana passada / essa semana
  if (lower.includes('semana passada') || lower.includes('ultima semana') || lower.includes('última semana')) {
    const inicioSemana = new Date(agora)
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() - 7)
    const fimSemana = new Date(inicioSemana)
    fimSemana.setDate(fimSemana.getDate() + 6)
    return {
      inicio: `${inicioSemana.toISOString().split('T')[0]}T00:00:00`,
      fim: `${fimSemana.toISOString().split('T')[0]}T23:59:59`,
    }
  }

  if (lower.includes('essa semana') || lower.includes('esta semana')) {
    const inicioSemana = new Date(agora)
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
    return {
      inicio: `${inicioSemana.toISOString().split('T')[0]}T00:00:00`,
      fim: agora.toISOString(),
    }
  }

  // Este mês / mês passado
  if (lower.includes('mês passado') || lower.includes('mes passado')) {
    const mesAnterior = mes === 0 ? 11 : mes - 1
    const anoMesAnterior = mes === 0 ? ano - 1 : ano
    const inicio = `${anoMesAnterior}-${String(mesAnterior + 1).padStart(2, '0')}-01`
    const ultimoDia = new Date(anoMesAnterior, mesAnterior + 1, 0).getDate()
    const fim = `${anoMesAnterior}-${String(mesAnterior + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    return { inicio: `${inicio}T00:00:00`, fim: `${fim}T23:59:59` }
  }

  if (lower.includes('este mês') || lower.includes('esse mês') || lower.includes('este mes') || lower.includes('esse mes')) {
    const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
    return { inicio: `${inicio}T00:00:00`, fim: agora.toISOString() }
  }

  return null
}

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

    // ── Detectar range de data ──────────────────────────────
    const rangeData = detectarRangeData(termo)

    // ── Palavras para busca ─────────────────────────────────
    // Remove stopwords e meses (já usados no filtro de data)
    const STOPWORDS = new Set(['que', 'como', 'quando', 'onde', 'qual', 'quais', 'para', 'com', 'sem', 'por', 'das', 'dos', 'nos', 'nas', 'uma', 'uns', 'umas', 'esse', 'essa', 'este', 'esta', 'nossas', 'nossos', 'minha', 'minhas', 'meus'])
    const MESES_NOMES = new Set(['janeiro', 'fevereiro', 'marco', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'])

    const palavras = termo
      .toLowerCase()
      .split(/\s+/)
      .filter((p: string) => p.length > 2 && !STOPWORDS.has(p) && !MESES_NOMES.has(p))
      .slice(0, 6)

    // ── Busca FTS (Full-Text Search) ────────────────────────
    let msgsFTS: any[] = []
    if (palavras.length > 0) {
      // Monta tsquery: "gastei & almoço" (AND entre palavras)
      const tsQuery = palavras.map(p => `'${p}'`).join(' & ')

      let query = supabase
        .from('elena_conversas')
        .select('id, role, texto, sessao_id, created_at')
        .eq('user_id', user.id)
        .textSearch('busca_fts', tsQuery, { config: 'portuguese' })
        .order('created_at', { ascending: false })
        .limit(limite * 3)

      // Aplicar filtro de data se detectado
      if (rangeData?.inicio) {
        query = query.gte('created_at', rangeData.inicio)
      }
      if (rangeData?.fim) {
        query = query.lte('created_at', rangeData.fim)
      }

      const { data } = await query
      msgsFTS = data || []
    }

    // ── Fallback ILIKE (se FTS não encontrou nada) ──────────
    let msgsILIKE: any[] = []
    if (msgsFTS.length === 0 && palavras.length > 0) {
      const orFiltros = palavras.map((p: string) => `texto.ilike.%${p}%`).join(',')

      let query = supabase
        .from('elena_conversas')
        .select('id, role, texto, sessao_id, created_at')
        .eq('user_id', user.id)
        .or(orFiltros)
        .order('created_at', { ascending: false })
        .limit(limite * 3)

      if (rangeData?.inicio) {
        query = query.gte('created_at', rangeData.inicio)
      }
      if (rangeData?.fim) {
        query = query.lte('created_at', rangeData.fim)
      }

      const { data } = await query
      msgsILIKE = data || []
    }

    // ── Se só tem filtro de data (sem palavras-chave) ────────
    let msgsSoData: any[] = []
    if (palavras.length === 0 && rangeData) {
      let query = supabase
        .from('elena_conversas')
        .select('id, role, texto, sessao_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limite * 3)

      if (rangeData.inicio) query = query.gte('created_at', rangeData.inicio)
      if (rangeData.fim) query = query.lte('created_at', rangeData.fim)

      const { data } = await query
      msgsSoData = data || []
    }

    const msgs = msgsFTS.length > 0 ? msgsFTS : msgsILIKE.length > 0 ? msgsILIKE : msgsSoData

    // ── Busca memória universal (elena_registro) ────────────
    let memoriaEncontrada: any[] = []
    if (palavras.length > 0) {
      const orFiltrosRegistro = palavras.map((p: string) =>
        `titulo.ilike.%${p}%,conteudo.ilike.%${p}%,chave.ilike.%${p}%`
      ).join(',')

      const { data: registros } = await (supabase.from('elena_registro') as any)
        .select('id, tipo, chave, titulo, conteudo, importante, criado_em')
        .eq('user_id', user.id)
        .or(orFiltrosRegistro)
        .order('importante', { ascending: false })
        .limit(10)

      memoriaEncontrada = (registros || []).map((r: any) => ({
        role: 'ai' as const,
        texto: `[MEMÓRIA ${(r.tipo || '').toUpperCase()}] ${r.titulo}: ${r.conteudo || ''}`,
        created_at: r.criado_em,
        sessao_id: 'memoria',
      }))
    }

    // ── Pontuar e formatar conversas ────────────────────────
    const pontuadas = msgs
      .map((m: any) => {
        const textoLower = (m.texto || '').toLowerCase()
        const pontos = palavras.filter((p: string) => textoLower.includes(p)).length
        return { ...m, pontos }
      })
      .sort((a: any, b: any) => b.pontos - a.pontos || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limite)

    const mensagens = pontuadas.map((m: any) => ({
      role: m.role,
      texto: m.texto?.substring(0, 800) || '',  // Aumentado de 400 para 800
      created_at: m.created_at,
      sessao_id: m.sessao_id,
    }))

    // Junta: memória primeiro (mais relevante), depois conversas
    const todos = [...memoriaEncontrada, ...mensagens].slice(0, limite)

    return NextResponse.json({
      mensagens: todos,
      total: todos.length,
      memoria: memoriaEncontrada.length,
      metodo: msgsFTS.length > 0 ? 'fts' : msgsILIKE.length > 0 ? 'ilike' : rangeData ? 'data' : 'nenhum',
      filtroData: rangeData || null,
    })
  } catch (err: any) {
    console.error('[Elena Busca]', err)
    return NextResponse.json({ mensagens: [], error: err.message })
  }
}
