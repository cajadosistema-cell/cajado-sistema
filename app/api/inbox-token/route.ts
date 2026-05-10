import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Troca a sessão Supabase por um token do backend inbox
// Usa o novo endpoint /auth/supabase-exchange — sem precisar de ADMIN_SENHA
export async function GET(req: Request) {
  try {
    // 1. Pega o access_token da sessão Supabase atual
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
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return NextResponse.json({ error: 'Não autenticado no Supabase' }, { status: 401 })
    }

    // 2. Troca o token Supabase por um token do backend inbox
    const backendUrl = process.env.INBOX_BACKEND_URL?.replace(/\/$/, '')
      || 'http://localhost:3001'

    const res = await fetch(`${backendUrl}/auth/supabase-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'x-integration-key': process.env.INBOX_INTEGRATION_KEY || 'fe735c00cfb3613832c4e8b7e88a67af7892cdb6d5c94b901e028e3f25d06ebb'
      },
      body: JSON.stringify({
        email: session.user?.email,
        nome: session.user?.user_metadata?.full_name || session.user?.user_metadata?.nome || session.user?.email,
        id: session.user?.id
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[inbox-token] Falha no exchange. Status:', res.status, 'Body:', err)
      return NextResponse.json({ error: `Backend exchange failed: ${res.status} - ${err}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ token: data.token, user: data.usuario })
  } catch (err: any) {
    console.error('[inbox-token] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
