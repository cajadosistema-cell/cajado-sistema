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

async function getEmpresaId() {
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
  return perfil?.empresa_id ?? null
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
    const { error: dbError } = await supabaseAdmin
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
