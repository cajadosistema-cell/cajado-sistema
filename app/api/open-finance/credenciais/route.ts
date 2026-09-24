import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPluggyApiKey, PluggyCustomCredentials } from '@/lib/open-finance/pluggy-client'

/**
 * GET /api/open-finance/credenciais
 * Retorna as credenciais Pluggy salvas para a empresa do usuário logado
 * (retorna client_id mascarado e se existe credencial salva)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: perfil } = await (supabase.from('perfis') as any)
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!perfil?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    const adminSupabase = await createAdminClient()
    const { data: credencial } = await (adminSupabase.from('open_finance_credenciais') as any)
      .select('id, client_id, label, ativo, validated_at, created_at, updated_at')
      .eq('empresa_id', perfil.empresa_id)
      .eq('provider', 'pluggy')
      .maybeSingle()

    if (!credencial) {
      const globalClientId = process.env.PLUGGY_CLIENT_ID
      const hasGlobal = Boolean(
        globalClientId &&
        process.env.PLUGGY_CLIENT_SECRET &&
        !globalClientId.startsWith('mock_') &&
        globalClientId !== 'demo'
      )

      if (hasGlobal && globalClientId) {
        const maskedGlobal = globalClientId.length > 8
          ? `${globalClientId.slice(0, 4)}...${globalClientId.slice(-4)}`
          : '****'
        return NextResponse.json({
          credencial: {
            client_id_masked: maskedGlobal,
            label: 'Demo App do sistema',
            isGlobal: true,
          },
          hasCredentials: true,
          hasCustomCredentials: false,
          hasGlobalCredentials: true,
        })
      }

      return NextResponse.json({ credencial: null, hasCredentials: false })
    }

    // Mascarar o client_id para exibição (mostra apenas primeiros e últimos 4 chars)
    const masked = credencial.client_id.length > 8
      ? `${credencial.client_id.slice(0, 4)}...${credencial.client_id.slice(-4)}`
      : '****'

    return NextResponse.json({
      credencial: {
        ...credencial,
        client_id_masked: masked,
        isGlobal: false,
      },
      hasCredentials: true,
      hasCustomCredentials: true,
      hasGlobalCredentials: false,
    })
  } catch (error: any) {
    console.error('Erro em GET /api/open-finance/credenciais:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/open-finance/credenciais
 * Salva ou atualiza as credenciais Pluggy da empresa
 * Valida as credenciais antes de salvar fazendo um teste de autenticação
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: perfil } = await (supabase.from('perfis') as any)
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!perfil?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    const body = await req.json()
    const { clientId, clientSecret, label } = body

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Client ID e Client Secret são obrigatórios' }, { status: 400 })
    }

    // Validar credenciais tentando autenticar na API Pluggy
    const custom: PluggyCustomCredentials = { clientId, clientSecret }
    try {
      await getPluggyApiKey(custom)
    } catch (err: any) {
      return NextResponse.json({
        error: `Credenciais inválidas: ${err.message}. Verifique o Client ID e Client Secret no dashboard.pluggy.ai`,
        validationFailed: true,
      }, { status: 400 })
    }

    const adminSupabase = await createAdminClient()
    const { data: credencial, error: saveError } = await (adminSupabase.from('open_finance_credenciais') as any)
      .upsert(
        {
          empresa_id: perfil.empresa_id,
          provider: 'pluggy',
          client_id: clientId,
          client_secret: clientSecret,
          label: label || 'Minha Conta Pluggy',
          ativo: true,
          validated_at: new Date().toISOString(),
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'empresa_id,provider' }
      )
      .select('id, client_id, label, ativo, validated_at')
      .single()

    if (saveError) {
      console.error('Erro ao salvar credenciais:', saveError)
      return NextResponse.json({ error: 'Erro ao salvar credenciais: ' + saveError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      credencial,
      message: '✅ Credenciais Pluggy validadas e salvas com sucesso!',
    })
  } catch (error: any) {
    console.error('Erro em POST /api/open-finance/credenciais:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/open-finance/credenciais
 * Remove as credenciais Pluggy da empresa
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: perfil } = await (supabase.from('perfis') as any)
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!perfil?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    const adminSupabase = await createAdminClient()
    await (adminSupabase.from('open_finance_credenciais') as any)
      .delete()
      .eq('empresa_id', perfil.empresa_id)
      .eq('provider', 'pluggy')

    return NextResponse.json({ success: true, message: 'Credenciais removidas' })
  } catch (error: any) {
    console.error('Erro em DELETE /api/open-finance/credenciais:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
