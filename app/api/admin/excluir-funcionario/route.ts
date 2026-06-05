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

export async function POST(req: NextRequest) {
  try {
    const empresa_id = await getEmpresaId()
    if (!empresa_id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id, email } = await req.json()

    if (!id || !email) {
      return NextResponse.json({ error: 'ID e email do usuário são obrigatórios.' }, { status: 400 })
    }

    // 1. Verifica se o funcionário pertence à empresa do admin
    const { data: func } = await getAdmin()
      .from('funcionarios')
      .select('id, user_id')
      .eq('id', id)
      .eq('empresa_id', empresa_id)  // SEGURO: só deleta da própria empresa
      .single()

    // O auth user ID pode ser func.user_id (novo padrão) ou func.id (padrão antigo)
    const authUserId = (func as any)?.user_id ?? id

    // 2. Remover da tabela funcionarios
    const { error: dbError } = await getAdmin()
      .from('funcionarios')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.warn('Aviso ao remover da tabela funcionarios:', dbError.message)
    }

    // 3. Remover do Supabase Auth
    const { error: authError } = await getAdmin().auth.admin.deleteUser(authUserId)

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
          integration_key: process.env.INBOX_INTEGRATION_KEY || ''
        }),
      })
    } catch {}

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
