import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Usa service_role para poder criar usuários no Auth
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
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

    // 2. Inserir na tabela 'funcionarios' com as permissões
    const { error: dbError } = await supabaseAdmin
      .from('funcionarios')
      .insert({
        user_id: userId,      // FK para auth.users
        nome,
        email,
        cargo: cargo || '',
        ativo: true,
        permissoes: permissoes || [],
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
