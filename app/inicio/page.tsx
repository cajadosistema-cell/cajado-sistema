import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import InicioClient from './inicio-client'

export const metadata: Metadata = { title: 'Dashboard Geral - Cajado' }

export default async function InicioPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: any[]) {
          try { cookiesToSet.forEach(({ name, value, options }: any) => { cookieStore.set(name, value, options) }) } catch (error) {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verifica se é um funcionário (normal) cadastrado pelo Admin
  const { data: func } = await supabase
    .from('funcionarios')
    .select('permissoes')
    .eq('email', user.email || '')
    .single()

  if (func) {
    // É funcionário! Não pode ver o Dashboard. 
    // Redireciona para o primeiro módulo que ele tiver permissão.
    const perms = func.permissoes || []
    if (perms.length > 0) {
      redirect(`/${perms[0]}`)
    } else {
      // Se não tem acesso a nada
      redirect('/login?erro=bloqueado')
    }
  }

  // Se for o Admin (não achou na tabela de funcionários), carrega a Dashboard normalmente
  return <InicioClient />
}

// force reload
