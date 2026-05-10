import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import crypto from 'crypto'

function signJwt(payload: any, secret: string) {
  const encodeBase64Url = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const encodedHeader = encodeBase64Url({ alg: 'HS256', typ: 'JWT' })
  const encodedPayload = encodeBase64Url(payload)
  const signature = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return NextResponse.json({ error: 'Não autenticado no Supabase' }, { status: 401 })
    }

    // Gera o token do Inbox localmente para evitar 502/cross-project errors com o backend
    const userPayload = {
      id: session.user.id,
      nome: session.user.user_metadata?.full_name || session.user.user_metadata?.nome || session.user.email?.split('@')[0],
      email: session.user.email,
      role: 'admin',
      setor: 'todos',
      empresa_id: 'empresa-padrao',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 dias
    }

    // Mesmo secret usado no cajado-backend/.env
    const jwtSecret = process.env.JWT_SECRET || 'cajado-jwt-secret-2025-troque-em-producao'
    const token = signJwt(userPayload, jwtSecret)

    return NextResponse.json({ token, user: userPayload })
  } catch (err: any) {
    console.error('[inbox-token] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
