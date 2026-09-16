import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPluggyAccounts, getPluggyTransactions } from '@/lib/open-finance/pluggy-client'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { event, itemId, data } = payload

    if (!itemId) {
      return NextResponse.json({ received: true, ignored: 'Missing itemId' })
    }

    const adminSupabase = await createAdminClient()

    // 1. Localizar a conexão vinculada a este item
    const { data: conexao } = await (adminSupabase.from('open_finance_conexoes') as any)
      .select('*')
      .eq('item_id', itemId)
      .maybeSingle()

    if (!conexao) {
      console.warn(`Webhook Pluggy recebido para itemId desconhecido: ${itemId}`)
      return NextResponse.json({ received: true, ignored: 'Item not registered in Cajado' })
    }

    // 2. Registrar evento na tabela de auditoria/logs
    try {
      await (adminSupabase.from('open_finance_logs') as any).insert({
        empresa_id: conexao.empresa_id,
        conexao_id: conexao.id,
        evento: event || 'unknown',
        payload,
      })
    } catch (logErr) {
      console.warn('Falha ao salvar log do webhook:', logErr)
    }

    // 3. Tratar diferentes tipos de evento
    if (event === 'item/updated' || event === 'item/created') {
      const status = data?.status || 'UPDATED'
      await (adminSupabase.from('open_finance_conexoes') as any)
        .update({
          status,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conexao.id)

      // Se atualizou com sucesso, atualizar saldos das contas
      if (status === 'UPDATED') {
        const accounts = await getPluggyAccounts(itemId).catch(() => [])
        for (const pAcc of accounts) {
          const saldo = typeof pAcc.balance === 'number' ? pAcc.balance : 0
          await (adminSupabase.from('contas') as any)
            .update({
              saldo_atual: saldo,
              open_finance_sincronizado_em: new Date().toISOString(),
            })
            .eq('open_finance_id', pAcc.id)
        }
      }
    } else if (event === 'transactions/created') {
      const accountId = data?.accountId
      if (accountId) {
        // Buscar transações recentes desta conta
        const transacoes = await getPluggyTransactions(accountId, { pageSize: 30 }).catch(() => [])

        // Localizar a conta no Cajado
        const { data: conta } = await (adminSupabase.from('contas') as any)
          .select('id')
          .eq('open_finance_id', accountId)
          .maybeSingle()

        if (conta) {
          for (const tx of transacoes) {
            const { data: txExistente } = await (adminSupabase.from('lancamentos') as any)
              .select('id')
              .eq('open_finance_id', tx.id)
              .maybeSingle()

            if (!txExistente) {
              const isDespesa = tx.amount < 0 || tx.type === 'DEBIT'
              await (adminSupabase.from('lancamentos') as any).insert({
                empresa_id: conexao.empresa_id,
                conta_id: conta.id,
                descricao: tx.description || 'Transação bancária',
                valor: Math.abs(tx.amount),
                tipo: isDespesa ? 'despesa' : 'receita',
                regime: 'caixa',
                status: 'validado',
                data_competencia: tx.date,
                data_caixa: tx.date,
                open_finance_id: tx.id,
                open_finance_tipo: tx.type,
                observacoes: `Automático via Webhook Open Finance (${conexao.connector_name})`,
                conciliado: true,
              })
            }
          }
        }
      }
    } else if (event === 'item/error') {
      await (adminSupabase.from('open_finance_conexoes') as any)
        .update({
          status: 'LOGIN_ERROR',
          error_message: data?.error?.message || 'Erro de autenticação com a instituição bancária',
          updated_at: new Date().toISOString(),
        })
        .eq('id', conexao.id)
    }

    return NextResponse.json({ received: true, event, itemId })
  } catch (error: any) {
    console.error('Erro ao processar Webhook Open Finance:', error)
    // Retorna 200 mesmo em erro interno para evitar retry infinito da Pluggy
    return NextResponse.json({ received: true, error: error.message }, { status: 200 })
  }
}
