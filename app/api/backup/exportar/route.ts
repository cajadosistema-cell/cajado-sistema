import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Tabelas com empresa_id — filtradas pelo tenant do usuário
const TABELAS_TENANT = [
  'lancamentos', 'leads', 'clientes', 'produtos', 'contas',
  'categorias_financeiras', 'funcionarios', 'configuracoes_empresa',
  'vendas', 'parceiros', 'tarefas', 'diario_entradas',
]

// Tabelas pessoais — filtradas pelo user_id
const TABELAS_PESSOAIS = [
  'agenda_eventos', 'elena_conversas', 'elena_ideias',
  'elena_registros', 'limites_orcamento',
]

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

export async function GET() {
  try {
    // 1. Verifica sessão do usuário
    const cookieStore = await cookies()
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: CookieToSet[]) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any)) } catch {}
          },
        },
      }
    )

    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 2. Pega empresa_id do usuário logado
    const { data: perfil } = await supabaseUser
      .from('perfis')
      .select('empresa_id')
      .eq('id', user.id)
      .single()

    if (!perfil?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })
    }

    const empresaId = perfil.empresa_id

    // 3. Usa service_role MAS filtra sempre pelo empresa_id do usuário
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const backup: Record<string, any[]> = {}
    const erros: string[] = []

    // Tabelas de negócio → filtrar por empresa_id
    for (const tabela of TABELAS_TENANT) {
      try {
        const { data, error } = await supabaseAdmin
          .from(tabela)
          .select('*')
          .eq('empresa_id', empresaId)
        if (error) erros.push(`${tabela}: ${error.message}`)
        else backup[tabela] = data ?? []
      } catch {
        erros.push(`${tabela}: tabela não encontrada (ignorada)`)
      }
    }

    // Tabelas pessoais → filtrar por user_id
    for (const tabela of TABELAS_PESSOAIS) {
      try {
        const { data, error } = await supabaseAdmin
          .from(tabela)
          .select('*')
          .eq('user_id', user.id)
        if (error) erros.push(`${tabela}: ${error.message}`)
        else backup[tabela] = data ?? []
      } catch {
        erros.push(`${tabela}: tabela não encontrada (ignorada)`)
      }
    }

    const payload = {
      meta: {
        sistema: 'Cajado Sistema v2.0',
        gerado_em: new Date().toISOString(),
        empresa_id: empresaId,
        usuario_id: user.id,
        total_tabelas: Object.keys(backup).length,
        total_registros: Object.values(backup).reduce((s, v) => s + v.length, 0),
        erros_ignorados: erros,
      },
      dados: backup,
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="cajado-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
