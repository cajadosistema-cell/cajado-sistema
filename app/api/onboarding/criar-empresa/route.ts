import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cookieStore.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const { nome_empresa, cnpj, telefone, segmento, plano = 'trial' } = body

  if (!nome_empresa?.trim()) {
    return NextResponse.json({ error: 'Nome da empresa é obrigatório' }, { status: 400 })
  }

  // 1. Cria o registro da empresa
  const { data: empresa, error: errEmpresa } = await supabase
    .from('empresas')
    .insert({
      nome: nome_empresa.trim(),
      cnpj: cnpj?.trim() || null,
      telefone: telefone?.trim() || null,
      email: user.email,
      plano,
      ativo: true,
      trial_ate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (errEmpresa) {
    console.error('[onboarding] erro ao criar empresa:', errEmpresa)
    return NextResponse.json({ error: errEmpresa.message }, { status: 500 })
  }

  const empresaId = empresa.id

  // 2. Vincula empresa ao perfil do usuário (owner)
  const { error: errPerfil } = await supabase
    .from('perfis')
    .update({
      empresa_id: empresaId,
      cargo: 'Administrador',
    })
    .eq('id', user.id)

  if (errPerfil) {
    console.error('[onboarding] erro ao atualizar perfil:', errPerfil)
    return NextResponse.json({ error: errPerfil.message }, { status: 500 })
  }

  // 3. Define o owner_id na empresa
  await supabase
    .from('empresas')
    .update({ owner_id: user.id })
    .eq('id', empresaId)

  // 4. Cria categorias financeiras padrão para a nova empresa
  const categoriasPadrao = [
    { nome: 'Salários',         tipo: 'despesa',     cor: '#ef4444' },
    { nome: 'Aluguel',          tipo: 'despesa',     cor: '#f97316' },
    { nome: 'Marketing',        tipo: 'despesa',     cor: '#a855f7' },
    { nome: 'Serviços',         tipo: 'despesa',     cor: '#6366f1' },
    { nome: 'Fornecedores',     tipo: 'despesa',     cor: '#ec4899' },
    { nome: 'Impostos',         tipo: 'despesa',     cor: '#dc2626' },
    { nome: 'Vendas de Serviço',tipo: 'receita',     cor: '#22c55e' },
    { nome: 'Comissões',        tipo: 'receita',     cor: '#10b981' },
    { nome: 'Outros Recebidos', tipo: 'receita',     cor: '#84cc16' },
    { nome: 'Reserva',          tipo: 'investimento',cor: '#3b82f6' },
  ]

  await supabase.from('categorias_financeiras').insert(
    categoriasPadrao.map(c => ({ ...c, empresa_id: empresaId }))
  )

  return NextResponse.json({ success: true, empresa_id: empresaId })
}
