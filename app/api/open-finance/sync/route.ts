import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  syncPluggyItem,
  getPluggyAccounts,
  getPluggyTransactions,
  getPluggyItem,
  PluggyCustomCredentials,
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { conexaoId, itemId } = body

    // Localizar as conexões a sincronizar
    let query = (adminSupabase.from('open_finance_conexoes') as any).select('*')
    if (conexaoId) {
      query = query.eq('id', conexaoId)
    } else if (itemId) {
      query = query.eq('item_id', itemId)
    } else {
      // Sincronizar todas as conexões do usuário ou empresa
      const { data: perfil } = await (supabase.from('perfis') as any)
        .select('empresa_id')
        .eq('id', user.id)
        .maybeSingle()

      if (perfil?.empresa_id) {
        query = query.eq('empresa_id', perfil.empresa_id)
      } else {
        query = query.eq('user_id', user.id)
      }
    }

    const { data: conexoes, error: conexoesErr } = await query

    if (conexoesErr) {
      return NextResponse.json({ error: 'Erro ao buscar conexões: ' + conexoesErr.message }, { status: 500 })
    }

    if (!conexoes || conexoes.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhuma conexão para sincronizar', atualizados: 0 })
    }

    let contasAtualizadas = 0
    let novasTransacoes = 0

    for (const conexao of conexoes) {
      // Resolver credenciais customizadas da empresa
      const customCreds = conexao.empresa_id
        ? await getEmpresaCredenciais(adminSupabase, conexao.empresa_id).catch(() => null)
        : null

      // 1. Notificar a Pluggy para sincronizar o Item
      try {
        await syncPluggyItem(conexao.item_id, customCreds)
      } catch (err: any) {
        console.warn(`Aviso ao solicitar sync na Pluggy para item ${conexao.item_id}:`, err.message)
      }

      // 2. Atualizar status e dados do conector da conexão
      const itemInfo = await getPluggyItem(conexao.item_id, customCreds).catch(() => null)
      if (itemInfo) {
        const connName = itemInfo.connector?.name || conexao.connector_name
        const connLogo = itemInfo.connector?.imageUrl || conexao.connector_logo_url
        const connColor = itemInfo.connector?.primaryColor || conexao.connector_color

        await (adminSupabase.from('open_finance_conexoes') as any)
          .update({
            status: itemInfo.status,
            connector_name: connName,
            connector_logo_url: connLogo,
            connector_color: connColor,
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', conexao.id)
      }

      // 3. Buscar contas da conexão
      const pluggyAccounts = await getPluggyAccounts(conexao.item_id, customCreds)

      for (const pAcc of pluggyAccounts) {
        const saldo = typeof pAcc.balance === 'number' ? pAcc.balance : 0
        const tipoConta = pAcc.subtype === 'CREDIT_CARD' || pAcc.type === 'CREDIT' ? 'cartao_credito' : 'corrente'
        const connName = itemInfo?.connector?.name || conexao.connector_name || 'Banco'
        const connColor = itemInfo?.connector?.primaryColor || conexao.connector_color || '#3b82f6'

        // Atualizar conta no Cajado ou criar se ainda não existir
        const { data: contaAtualizada } = await (adminSupabase.from('contas') as any)
          .update({
            saldo_atual: saldo,
            open_finance_sincronizado_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('open_finance_id', pAcc.id)
          .select('id')
          .maybeSingle()

        let contaId: string | null = contaAtualizada?.id || null

        if (!contaId) {
          const categoria = conexao.metadata?.categoria === 'pf' ? 'pf' : 'pj'
          const { data: novaConta, error: contaErr } = await (adminSupabase.from('contas') as any)
            .insert({
              empresa_id: conexao.empresa_id,
              user_id: conexao.user_id || user.id,
              nome: `${pAcc.name} (${connName})`,
              tipo: tipoConta,
              categoria,
              saldo_inicial: saldo,
              saldo_atual: saldo,
              ativo: true,
              cor: connColor,
              open_finance_id: pAcc.id,
              open_finance_conexao_id: conexao.id,
              open_finance_sincronizado_em: new Date().toISOString(),
              open_finance_sync_auto: true,
            })
            .select('id')
            .maybeSingle()

          if (!contaErr && novaConta) {
            contaId = novaConta.id
            contasAtualizadas++
          } else {
            console.error('Erro ao criar conta no sync:', contaErr)
          }
        } else {
          contasAtualizadas++
        }

        if (contaId) {
          // 4. Buscar novas transações
          try {
            const transacoes = await getPluggyTransactions(pAcc.id, { pageSize: 50, customCredentials: customCreds })
            for (const tx of transacoes) {
              const { data: txExistente } = await (adminSupabase.from('lancamentos') as any)
                .select('id')
                .eq('open_finance_id', tx.id)
                .maybeSingle()

              if (!txExistente) {
                const isDespesa = tx.amount < 0 || tx.type === 'DEBIT'
                const valorAbs = Math.abs(tx.amount)
                const dataTx = String(tx.date ?? tx.createdAt ?? new Date().toISOString()).slice(0, 10)

                // Enriquecer descrição para facilitar conciliação humana e automática
                let descFinal = tx.description || 'Transação bancária'
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

                const obsPartes: string[] = [`Sincronizado Open Finance (${conexao.connector_name})`]
                if (tx.paymentData?.paymentMethod) obsPartes.push(`Método: ${tx.paymentData.paymentMethod}`)
                if (receiverDoc) obsPartes.push(`Destino Doc: ${receiverDoc}`)
                if (payerDoc) obsPartes.push(`Origem Doc: ${payerDoc}`)
                if (tx.category) obsPartes.push(`Categoria: ${tx.category}`)

                await (adminSupabase.from('lancamentos') as any).insert({
                  empresa_id: conexao.empresa_id,
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
                novasTransacoes++
              }
            }
          } catch (txErr) {
            console.warn(`Erro ao sincronizar transações para conta ${pAcc.id}:`, txErr)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sincronização concluída com sucesso',
      conexoesProcessadas: conexoes.length,
      contasAtualizadas,
      novasTransacoes,
      sincronizadoEm: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Erro em POST /api/open-finance/sync:', error)
    return NextResponse.json({ error: error.message || 'Erro ao sincronizar Open Finance' }, { status: 500 })
  }
}
