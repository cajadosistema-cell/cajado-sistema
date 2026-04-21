import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { id, email } = await req.json()

    if (!id || !email) {
      return NextResponse.json({ error: 'ID e email do usuário são obrigatórios.' }, { status: 400 })
    }

    // 1. Buscar o user_id (FK auth.users) antes de deletar
    const { data: func } = await supabaseAdmin
      .from('funcionarios')
      .select('id, user_id')
      .eq('id', id)
      .single()

    // O auth user ID pode ser func.user_id (novo padrão) ou func.id (padrão antigo)
    const authUserId = (func as any)?.user_id ?? id

    // 2. Remover da tabela funcionarios
    const { error: dbError } = await supabaseAdmin
      .from('funcionarios')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.warn('Aviso ao remover da tabela funcionarios:', dbError.message)
    }

    // 3. Remover do Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUserId)

    if (authError && !authError.message.toLowerCase().includes('not found')) {
      return NextResponse.json(
        { error: `Erro ao excluir usuário no sistema de autenticação: ${authError.message}` },
        { status: 500 }
      )
    }

    // 4. Remover do bot inbox (Railway) — opcional
    try {
      const inboxUrl = process.env.NEXT_PUBLIC_INBOX_API_URL || 'https://cajado-sistema-production.up.railway.app'
      await fetch(`${inboxUrl}/auth/integrations/sync-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          action: 'delete',
          integration_key: 'fe735c00cfb3613832c4e8b7e88a67af7892cdb6d5c94b901e028e3f25d06ebb'
        }),
      })
    } catch {}

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
