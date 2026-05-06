import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

async function getSessionEmpresa() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(list: CookieToSet[]) {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any)) } catch {}
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase.from('perfis').select('empresa_id').eq('id', user.id).single()
  return perfil?.empresa_id ? { user, empresa_id: perfil.empresa_id } : null
}

export async function POST(req: NextRequest) {
  try {
    // Verifica sessão obrigatória
    const sessao = await getSessionEmpresa()
    if (!sessao) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { nome, email, senha, cargo, permissoes } = body

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'nome, email e senha são obrigatórios' }, { status: 400 })
    }

    // 1. Criar o usuário no Supabase Auth (usando service_role)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // Confirmar o email automaticamente (sem precisar de verificação)
      user_metadata: {
        nome,
        cargo: cargo || '',
      },
    })

    if (authError) {
      // Se o usuário já existe no Auth, tenta só atualizar a tabela
      if (authError.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'Este email já está cadastrado no sistema.' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Falha ao obter ID do usuário criado.' }, { status: 500 })
    }

    // 2. Inserir na tabela 'funcionarios' com as permissões + empresa_id
    const { error: dbError } = await supabaseAdmin
      .from('funcionarios')
      .insert({
        user_id: userId,
        nome,
        email,
        cargo: cargo || '',
        ativo: true,
        permissoes: permissoes || [],
        empresa_id: sessao.empresa_id,
      })

    if (dbError) {
      // Rollback: remover o usuário do Auth se falhar o insert na tabela
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: `Erro ao salvar perfil: ${dbError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
