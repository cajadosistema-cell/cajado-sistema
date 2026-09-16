import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPluggyConnectToken } from '@/lib/open-finance/pluggy-client'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { itemId } = body

    // Obter empresa_id do perfil do usuário
    const { data: perfil } = await (supabase.from('perfis') as any)
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle()

    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/open-finance/webhook`
      : undefined

    const tokenData = await createPluggyConnectToken({
      clientUserId: user.id,
      itemId,
      webhookUrl,
    })

    return NextResponse.json({
      success: true,
      connectToken: tokenData.connectToken,
      isMock: tokenData.isMock,
      empresaId: perfil?.empresa_id || null,
    })
  } catch (error: any) {
    console.error('Erro em /api/open-finance/connect-token:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar token de conexão Open Finance' },
      { status: 500 }
    )
  }
}
