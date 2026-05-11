import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => (request.cookies.set(name, value)))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const host = request.headers.get('host') || ''
  const isSistema = host.includes('sistema.cajadosolucoes') || host.includes('localhost')
  
  const isAuthPage     = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/cadastro')
  const isPublicRoute  = request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/api')
  const isOnboarding   = request.nextUrl.pathname.startsWith('/onboarding')

  // Redirecionamento de domínio: raiz → login ou início
  if (isSistema && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? '/inicio' : '/login'
    return NextResponse.redirect(url)
  }

  // Deslogado tentando acessar área protegida
  if (!user && !isAuthPage && !isPublicRoute && !isOnboarding) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Já logado tentando abrir login → vai pro início
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/inicio'
    return NextResponse.redirect(url)
  }

  // Usuário logado mas SEM empresa → redireciona para onboarding
  // (exceto se já está no onboarding, na API ou em rotas públicas)
  if (user && !isOnboarding && !isAuthPage && !isPublicRoute) {
    const { data: perfil } = await supabase
      .from('perfis')
      .select('empresa_id')
      .eq('id', user.id)
      .single()

    if (perfil && !perfil.empresa_id) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
