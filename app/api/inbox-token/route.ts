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

    // Busca o empresa_id REAL — tenta 'usuarios' (Express backend), depois 'perfis' (Supabase Auth)
    const userEmail = session.user.email?.toLowerCase() || ''
    let empresaId: string | null = null

    try {
      // 1ª tentativa: tabela 'usuarios' (sistema backend Express)
      const { data: usuario, error: errUsuario } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('email', userEmail)
        .single()
      if (usuario?.empresa_id) {
        empresaId = usuario.empresa_id
        console.log(`[inbox-token] empresa_id via usuarios: ${empresaId}`)
      } else {
        console.log(`[inbox-token] Usuário não encontrado em 'usuarios': ${errUsuario?.message || 'null'}`)
      }
    } catch (e: any) {
      console.error('[inbox-token] Erro ao buscar em usuarios:', e.message)
    }

    if (!empresaId) {
      try {
        // 2ª tentativa: tabela 'perfis' (Supabase Auth nativo)
        const { data: perfil, error: errPerfil } = await supabase
          .from('perfis')
          .select('empresa_id')
          .eq('id', session.user.id)
          .single()
        if (perfil?.empresa_id) {
          empresaId = perfil.empresa_id
          console.log(`[inbox-token] empresa_id via perfis: ${empresaId}`)
        } else {
          console.error(`[inbox-token] ⚠️ empresa_id NÃO encontrado para ${userEmail} — perfis: ${errPerfil?.message || 'null'}`)
        }
      } catch (e: any) {
        console.error('[inbox-token] Erro ao buscar em perfis:', e.message)
      }
    }

    if (!empresaId) {
      return NextResponse.json({ error: 'empresa_id não encontrado para este usuário — configure o perfil no Supabase' }, { status: 403 })
    }

    // Gera o token do Inbox localmente
    const userPayload = {
      id: session.user.id,
      nome: session.user.user_metadata?.full_name || session.user.user_metadata?.nome || session.user.email?.split('@')[0],
      email: session.user.email,
      role: 'admin',
      setor: 'todos',
      empresa_id: empresaId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    }

    const jwtSecret = process.env.JWT_SECRET || 'cajado-jwt-secret-2025-troque-em-producao'
    const token = signJwt(userPayload, jwtSecret)

    return NextResponse.json({ token, user: userPayload })
  } catch (err: any) {
    console.error('[inbox-token] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
