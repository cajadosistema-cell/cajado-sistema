import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function PATCH(req: NextRequest) {
  try {
    const { id, permissoes } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 })
    }

    // Usando service_role armamos o update na tabela funcionarios
    const { error: dbError } = await supabaseAdmin
      .from('funcionarios')
      .update({ permissoes: permissoes || [] })
      .eq('id', id)

    if (dbError) {
      return NextResponse.json({ error: `Erro ao atualizar limites de acesso: ${dbError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
