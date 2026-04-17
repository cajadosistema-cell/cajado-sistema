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

    // 1. Remover da tabela funcionarios (isso pode falhar se não existir ou por restrições, 
    // mas na migration que usamos ele deletaria sem erros pela service_role)
    const { error: dbError } = await supabaseAdmin
      .from('funcionarios')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.warn("Aviso ao remover da tabela funcionarios:", dbError.message)
    }

    // 2. Remover do Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      return NextResponse.json({ error: `Erro ao excluir usuário no sistema de autenticação: ${authError.message}` }, { status: 500 })
    }

    // 3. Remover do bot inbox (Railway) se aplicável (opcional, faremos tentativa)
    try {
      const inboxUrl = process.env.NEXT_PUBLIC_INBOX_API_URL || 'https://cajado-sistema-production.up.railway.app'
      await fetch(`${inboxUrl}/auth/integrations/sync-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email, 
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
