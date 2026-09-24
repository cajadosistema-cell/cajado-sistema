import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  getPluggyItem,
  getPluggyAccounts,
  getPluggyTransactions,
  deletePluggyItem,
  PluggyAccount,
  PluggyTransaction,
  PluggyCustomCredentials
} from '@/lib/open-finance/pluggy-client'

/**
 * Busca credenciais Pluggy customizadas salvas para a empresa, se existirem.
 */
async function getEmpresaCredenciais(adminSupabase: any, empresaId: string): Promise<PluggyCustomCredentials | null> {
  const { data } = await (adminSupabase.from('open_finance_credenciais') as any)
    .select('client_id, client_secret')
    .eq('empresa_id', empresaId)
    .eq('provider', 'pluggy')
    .eq('ativo', true)
    .maybeSingle()

  if (data?.client_id && data?.client_secret) {
    return { clientId: data.client_id, clientSecret: data.client_secret }
  }
  return null
}

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

    const empresaId = perfil?.empresa_id
    const { searchParams } = new URL(req.url)
    const categoriaFiltro = searchParams.get('categoria')

    // Buscar conexões garantindo isolamento multi-tenant por empresa_id ou user_id
    let query = (supabase.from('open_finance_conexoes') as any).select('*')
    if (categoriaFiltro === 'pf') {
      query = query.eq('user_id', user.id)
    } else if (empresaId) {
      query = query.eq('empresa_id', empresaId)
    } else {
      query = query.eq('user_id', user.id)
    }

    const { data: conexoes, error: conexoesError } = await query.order('created_at', { ascending: false })

    if (conexoesError) {
      // Se a tabela ainda não foi criada, retorna lista vazia amigável
      if (conexoesError.code === 'PGRST205' || conexoesError.message?.includes('does not exist')) {
        return NextResponse.json({ conexoes: [], tablePending: true })
      }
      throw conexoesError
    }

    // Buscar contas vinculadas a essas conexões
    const conexaoIds = (conexoes || []).map((c: any) => c.id)
    let contasVinculadas: any[] = []

    if (conexaoIds.length > 0) {
      let queryContas = (supabase.from('contas') as any)
        .select('id, nome, tipo, categoria, saldo_atual, open_finance_id, open_finance_conexao_id, open_finance_sincronizado_em')
        .in('open_finance_conexao_id', conexaoIds)

      if (categoriaFiltro) {
        queryContas = queryContas.eq('categoria', categoriaFiltro)
      }

      const { data: contas } = await queryContas
      contasVinculadas = contas || []
    }

    // Associar contas a cada conexão
    const conexoesComContas = (conexoes || []).map((c: any) => ({
      ...c,
      contas: contasVinculadas.filter((acc: any) => acc.open_finance_conexao_id === c.id),
    }))

    return NextResponse.json({ conexoes: conexoesComContas })
  } catch (error: any) {
    console.error('Erro em GET /api/open-finance/conexoes:', error)
    return NextResponse.json({ error: error.message || 'Erro ao listar conexões' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { itemId, connector, categoria = 'pj', clientId: bodyClientId, clientSecret: bodyClientSecret } = body

    if (!itemId) {
      return NextResponse.json({ error: 'itemId é obrigatório' }, { status: 400 })
    }

    // Identificar empresa_id do perfil
    const { data: perfil } = await (supabase.from('perfis') as any)
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle()

    const empresaId = perfil?.empresa_id
    if (!empresaId) {
      return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 400 })
    }

    // Resolver credenciais: prioridade body > salvas na empresa > env global
    let customCreds: PluggyCustomCredentials | null = null
    if (bodyClientId && bodyClientSecret) {
      customCreds = { clientId: bodyClientId, clientSecret: bodyClientSecret }
    } else {
      customCreds = await getEmpresaCredenciais(adminSupabase, empresaId).catch(() => null)
    }

    // 1. Obter informações atualizadas do Item na Pluggy
    const itemData = await getPluggyItem(itemId, customCreds).catch(() => ({
      id: itemId,
      connector: connector || { id: 0, name: 'Instituição Bancária' },
      status: 'UPDATED',
      lastUpdatedAt: new Date().toISOString(),
    }))

    const connectorName = itemData.connector?.name || connector?.name || 'Banco Conectado'
    const connectorLogo = itemData.connector?.imageUrl || connector?.imageUrl || null
    const connectorColor = itemData.connector?.primaryColor || connector?.primaryColor || '#3b82f6'

    // 2. Salvar ou atualizar na tabela open_finance_conexoes
    const { data: conexao, error: saveError } = await (adminSupabase.from('open_finance_conexoes') as any)
      .upsert(
        {
          item_id: itemId,
          empresa_id: empresaId,
          user_id: user.id,
          connector_id: itemData.connector?.id || null,
          connector_name: connectorName,
          connector_logo_url: connectorLogo,
          connector_color: connectorColor,
          status: itemData.status || 'UPDATED',
          metadata: { categoria },
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'item_id' }
      )
      .select()
      .single()

    if (saveError) {
      console.error('Erro ao salvar conexao no banco:', saveError)
      return NextResponse.json({ error: 'Erro ao registrar conexão no banco: ' + saveError.message }, { status: 500 })
    }

    // 3. Buscar contas da instituição via Pluggy
    const pluggyAccounts = await getPluggyAccounts(itemId, customCreds)
    let contasCriadasOuAtualizadas = 0
    let transacoesImportadas = 0

    for (const pAcc of pluggyAccounts) {
      const tipoConta = pAcc.subtype === 'CREDIT_CARD' || pAcc.type === 'CREDIT' ? 'cartao_credito' : 'corrente'
      const saldo = typeof pAcc.balance === 'number' ? pAcc.balance : 0

      // Verifica se a conta já existe vinculada
      let queryExistente = (adminSupabase.from('contas') as any)
        .select('id, nome, saldo_atual')
        .eq('open_finance_id', pAcc.id)

      if (categoria === 'pf') {
        queryExistente = queryExistente.eq('user_id', user.id)
      } else {
        queryExistente = queryExistente.eq('empresa_id', empresaId)
      }

      const { data: contaExistente } = await queryExistente.maybeSingle()

      let contaId: string

      if (contaExistente) {
        contaId = contaExistente.id
        // Atualiza saldo e timestamp de sync
        await (adminSupabase.from('contas') as any)
          .update({
            saldo_atual: saldo,
            open_finance_conexao_id: conexao.id,
            open_finance_sincronizado_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', contaId)
        contasCriadasOuAtualizadas++
      } else {
        // Cria nova conta bancária no Cajado com categoria correta
        const { data: novaConta, error: contaErr } = await (adminSupabase.from('contas') as any)
          .insert({
            empresa_id: empresaId,
            user_id: user.id,
            nome: `${pAcc.name} (${connectorName})`,
            tipo: tipoConta,
            categoria: categoria === 'pf' ? 'pf' : 'pj',
            saldo_inicial: saldo,
            saldo_atual: saldo,
            ativo: true,
            cor: connectorColor,
            open_finance_id: pAcc.id,
            open_finance_conexao_id: conexao.id,
            open_finance_sincronizado_em: new Date().toISOString(),
            open_finance_sync_auto: true,
          })
          .select('id')
          .single()

        if (contaErr) {
          console.error('Erro ao criar conta bancária no Cajado:', contaErr)
          continue
        }
        contaId = novaConta.id
        contasCriadasOuAtualizadas++
      }

      // 4. Buscar transações recentes desta conta
      try {
        const transacoes = await getPluggyTransactions(pAcc.id, { pageSize: 50, customCredentials: customCreds })
        for (const tx of transacoes) {
          // Idempotência: verificar se transação já foi importada
          const { data: txExistente } = await (adminSupabase.from('lancamentos') as any)
            .select('id')
            .eq('open_finance_id', tx.id)
            .maybeSingle()

          if (!txExistente) {
            const isDespesa = tx.amount < 0 || tx.type === 'DEBIT'
            const valorAbs = Math.abs(tx.amount)
            const dataTx = String(tx.date ?? tx.createdAt ?? new Date().toISOString()).slice(0, 10)

            // Enriquecer descrição para facilitar conciliação humana e automática
            let descFinal = tx.description || 'Transação Open Finance'
            const receiverName = tx.paymentData?.receiver?.name
            const receiverDoc = tx.paymentData?.receiver?.documentNumber?.value
            const payerName = tx.paymentData?.payer?.name
            const payerDoc = tx.paymentData?.payer?.documentNumber?.value

            if (isDespesa && (receiverName || receiverDoc)) {
              const info = receiverName || `CPF/CNPJ ${receiverDoc}`
              if (!descFinal.toLowerCase().includes(info.toLowerCase())) {
                descFinal = `${descFinal} (${info})`
              }
            } else if (!isDespesa && (payerName || payerDoc)) {
              const info = payerName || `CPF/CNPJ ${payerDoc}`
              if (!descFinal.toLowerCase().includes(info.toLowerCase())) {
                descFinal = `${descFinal} (${info})`
              }
            }

            const obsPartes: string[] = [`Importado via Open Finance (${connectorName})`]
            if (tx.paymentData?.paymentMethod) obsPartes.push(`Método: ${tx.paymentData.paymentMethod}`)
            if (receiverDoc) obsPartes.push(`Destino Doc: ${receiverDoc}`)
            if (payerDoc) obsPartes.push(`Origem Doc: ${payerDoc}`)
            if (tx.category) obsPartes.push(`Categoria: ${tx.category}`)

            await (adminSupabase.from('lancamentos') as any).insert({
              empresa_id: empresaId,
              conta_id: contaId,
              descricao: descFinal,
              valor: valorAbs,
              tipo: isDespesa ? 'despesa' : 'receita',
              regime: 'caixa',
              status: 'validado',
              data_competencia: dataTx,
              data_caixa: dataTx,
              open_finance_id: tx.id,
              open_finance_tipo: tx.type,
              observacoes: obsPartes.join(' | '),
              conciliado: true,
              created_by: user.id,
            })
            transacoesImportadas++
          }
        }
      } catch (txErr) {
        console.warn(`Erro ao buscar transações para conta ${pAcc.id}:`, txErr)
      }
    }

    return NextResponse.json({
      success: true,
      conexao,
      contasProcessadas: contasCriadasOuAtualizadas,
      transacoesProcessadas: transacoesImportadas,
    })
  } catch (error: any) {
    console.error('Erro em POST /api/open-finance/conexoes:', error)
    return NextResponse.json({ error: error.message || 'Erro ao registrar conexão' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const itemId = searchParams.get('itemId')

    if (!id && !itemId) {
      return NextResponse.json({ error: 'id ou itemId é obrigatório' }, { status: 400 })
    }

    // Buscar a conexão no banco
    let query = (adminSupabase.from('open_finance_conexoes') as any).select('*')
    if (id) query = query.eq('id', id)
    else if (itemId) query = query.eq('item_id', itemId)

    const { data: conexao } = await query.maybeSingle()
    if (!conexao) {
      return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 })
    }

    // Deletar na Pluggy
    if (conexao.item_id) {
      // Buscar credenciais customizadas da empresa se existirem
      let customCreds: PluggyCustomCredentials | null = null
      if (conexao.empresa_id) {
        customCreds = await getEmpresaCredenciais(adminSupabase, conexao.empresa_id).catch(() => null)
      }
      await deletePluggyItem(conexao.item_id, customCreds).catch(() => null)
    }

    // Desvincular contas
    await (adminSupabase.from('contas') as any)
      .update({
        open_finance_conexao_id: null,
        open_finance_id: null,
        open_finance_sync_auto: false,
      })
      .eq('open_finance_conexao_id', conexao.id)

    // Deletar a conexão
    await (adminSupabase.from('open_finance_conexoes') as any)
      .delete()
      .eq('id', conexao.id)

    return NextResponse.json({ success: true, message: 'Conexão removida com sucesso' })
  } catch (error: any) {
    console.error('Erro em DELETE /api/open-finance/conexoes:', error)
    return NextResponse.json({ error: error.message || 'Erro ao remover conexão' }, { status: 500 })
  }
}
