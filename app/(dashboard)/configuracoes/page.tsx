import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import ConfiguracoesClient from './configuracoes-client'

export const metadata: Metadata = {
  title: 'Configurações | Sistema Cajado',
}

export default async function ConfiguracoesPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verifica as permissões se for um funcionário cadastrado
  const { data: func } = await supabase
    .from('funcionarios')
    .select('permissoes')
    .eq('email', user.email || '')
    .single()

  // Se o usuário existir na tabela de funcionários E NÃO tiver a permissão de "configuracoes", bloqueia!
  if (func && !(func.permissoes || []).includes('configuracoes')) {
    redirect('/inicio') // Redireciona o funcionário xereta para o Início
  }

  // Se passou, prossegue pro componente:
  return <ConfiguracoesClient />
}
