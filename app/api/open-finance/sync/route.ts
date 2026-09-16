import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  syncPluggyItem,
  getPluggyAccounts,
  getPluggyTransactions,
  getPluggyItem,
} from '@/lib/open-finance/pluggy-client'

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
      // 1. Notificar a Pluggy para sincronizar o Item
      try {
        await syncPluggyItem(conexao.item_id)
      } catch (err: any) {
        console.warn(`Aviso ao solicitar sync na Pluggy para item ${conexao.item_id}:`, err.message)
      }

      // 2. Atualizar status da conexão
      const itemInfo = await getPluggyItem(conexao.item_id).catch(() => null)
      if (itemInfo) {
        await (adminSupabase.from('open_finance_conexoes') as any)
          .update({
            status: itemInfo.status,
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', conexao.id)
      }

      // 3. Buscar contas da conexão
      const pluggyAccounts = await getPluggyAccounts(conexao.item_id)

      for (const pAcc of pluggyAccounts) {
        const saldo = typeof pAcc.balance === 'number' ? pAcc.balance : 0

        // Atualizar conta no Cajado
        const { data: contaAtualizada } = await (adminSupabase.from('contas') as any)
          .update({
            saldo_atual: saldo,
            open_finance_sincronizado_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('open_finance_id', pAcc.id)
          .select('id')
          .maybeSingle()

        if (contaAtualizada) {
          contasAtualizadas++

          // 4. Buscar novas transações
          try {
            const transacoes = await getPluggyTransactions(pAcc.id, { pageSize: 30 })
            for (const tx of transacoes) {
              const { data: txExistente } = await (adminSupabase.from('lancamentos') as any)
                .select('id')
                .eq('open_finance_id', tx.id)
                .maybeSingle()

              if (!txExistente) {
                const isDespesa = tx.amount < 0 || tx.type === 'DEBIT'
                await (adminSupabase.from('lancamentos') as any).insert({
                  empresa_id: conexao.empresa_id,
                  conta_id: contaAtualizada.id,
                  descricao: tx.description || 'Transação bancária',
                  valor: Math.abs(tx.amount),
                  tipo: isDespesa ? 'despesa' : 'receita',
                  regime: 'caixa',
                  status: 'validado',
                  data_competencia: tx.date,
                  data_caixa: tx.date,
                  open_finance_id: tx.id,
                  open_finance_tipo: tx.type,
                  observacoes: `Sincronizado Open Finance (${conexao.connector_name})`,
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
