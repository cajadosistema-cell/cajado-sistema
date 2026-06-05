import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Lazy init: só cria o client quando a rota é chamada (não no build)
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

async function getEmpresaId() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase.from('perfis').select('empresa_id, role').eq('id', user.id).single()
  if (!perfil?.empresa_id || !['admin', 'owner'].includes(perfil.role || '')) return null
  return perfil.empresa_id
}

export async function PATCH(req: NextRequest) {
  try {
    const empresa_id = await getEmpresaId()
    if (!empresa_id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id, permissoes } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 })
    }

    // Filtra pelo empresa_id do admin — impede editar funcionários de outra empresa
    const { error: dbError } = await getAdmin()
      .from('funcionarios')
      .update({ permissoes: permissoes || [] })
      .eq('id', id)
      .eq('empresa_id', empresa_id)

    if (dbError) {
      return NextResponse.json({ error: `Erro ao atualizar limites de acesso: ${dbError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
