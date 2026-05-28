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

    // Busca por similaridade usando ilike (case-insensitive)
    // Divide o termo em palavras e busca mensagens que contenham qualquer palavra relevante
    const palavras = termo
      .toLowerCase()
      .split(/\s+/)
      .filter((p: string) => p.length > 3)  // Ignora palavras curtas (artigos, preposições)
      .slice(0, 5)  // No máximo 5 palavras para a query

    if (palavras.length === 0) {
      return NextResponse.json({ mensagens: [] })
    }

    // Usa a primeira palavra mais relevante para a busca principal
    // e filtra as demais no código
    const termoPrincipal = palavras[0]

    const { data: msgs, error } = await supabase
      .from('elena_conversas')
      .select('id, role, texto, sessao_id, created_at')
      .eq('user_id', user.id)
      .ilike('texto', `%${termoPrincipal}%`)
      .order('created_at', { ascending: false })
      .limit(limite * 3)  // Busca mais e filtra abaixo

    if (error || !msgs) {
      return NextResponse.json({ mensagens: [] })
    }

    // Filtra por relevância: mensagens que contenham mais palavras do termo
    const pontuadas = msgs
      .map((m: any) => {
        const textoLower = (m.texto || '').toLowerCase()
        const pontos = palavras.filter((p: string) => textoLower.includes(p)).length
        return { ...m, pontos }
      })
      .filter((m: any) => m.pontos > 0)
      .sort((a: any, b: any) => b.pontos - a.pontos)
      .slice(0, limite)

    // Formata para o contexto da Elena
    const mensagens = pontuadas.map((m: any) => ({
      role: m.role,
      texto: m.texto?.substring(0, 400) || '',  // limita tamanho
      created_at: m.created_at,
      sessao_id: m.sessao_id,
    }))

    return NextResponse.json({ mensagens, total: mensagens.length })
  } catch (err: any) {
    console.error('[Elena Busca]', err)
    return NextResponse.json({ mensagens: [], error: err.message })
  }
}
