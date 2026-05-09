import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Endpoint server-side que troca a sessão Supabase por um token do backend inbox
// Nunca expõe ADMIN_EMAIL/ADMIN_SENHA ao cliente
export async function GET() {
  try {
    // 1. Verifica se o usuário está autenticado via Supabase
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
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 2. Faz login no backend inbox com as credenciais de admin (server-side)
    const backendUrl = process.env.INBOX_BACKEND_URL || 'http://localhost:3001'
    const res = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        senha: process.env.ADMIN_SENHA,
        password: process.env.ADMIN_SENHA,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[inbox-token] Falha no login do backend:', err)
      return NextResponse.json({ error: 'Falha ao autenticar no backend inbox' }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ token: data.token, user: data.user })
  } catch (err: any) {
    console.error('[inbox-token] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
