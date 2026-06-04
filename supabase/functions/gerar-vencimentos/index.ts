// supabase/functions/gerar-vencimentos/index.ts
// Edge Function que roda 1x por dia (via cron-job.org às 07:00)
// Lê cartões cadastrados + alertas_recorrentes e cria automaticamente
// eventos de vencimento na agenda_eventos para os próximos 60 dias.
// Garante idempotência via chave única no campo `descricao`.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Datas: hoje e daqui 60 dias ──────────────────────────────
    const agora     = new Date()
    const hoje      = agora.toISOString().split('T')[0]          // YYYY-MM-DD
    const em60dias  = new Date(agora.getTime() + 60 * 24 * 60 * 60 * 1000)
    const ate60     = em60dias.toISOString().split('T')[0]

    console.log(`[gerar-vencimentos] Rodando em ${hoje}, janela até ${ate60}`)

    let totalCriados = 0
    let totalIgnorados = 0

    // ── 1. Lista todos os usuários com cartões ou alertas_recorrentes ─
    const { data: usuarios } = await supabase.auth.admin.listUsers()
    if (!usuarios?.users?.length) {
      return new Response(JSON.stringify({ msg: 'Nenhum usuário encontrado' }), {
        headers: { 'Content-Type': 'application/json', ...cors }
      })
    }

    for (const user of usuarios.users) {
      const uid = user.id

      // ── 2a. Cartões de crédito com dia_vencimento ──────────────
      const { data: cartoes } = await supabase
        .from('contas')
        .select('id, nome, dia_vencimento, bandeira')
        .eq('user_id', uid)
        .eq('tipo', 'cartao_credito')
        .eq('ativo', true)
        .not('dia_vencimento', 'is', null)

      // ── 2b. Alertas recorrentes (boletos, luz, internet, etc.) ──
      const { data: recorrentes } = await supabase
        .from('alertas_recorrentes')
        .select('id, descricao, valor, dia_vencimento, tipo, categoria')
        .eq('user_id', uid)
        .eq('ativo', true)

      // ── Unifica as fontes em formato padrão ───────────────────
      type FonteVencimento = {
        descricao: string
        valor: number | null
        dia: number
        tipo: string
        chave: string   // identificador único para dedup
      }

      const fontes: FonteVencimento[] = []

      for (const c of (cartoes || [])) {
        if (!c.dia_vencimento) continue
        fontes.push({
          descricao: `💳 Pagar ${c.nome}`,
          valor: null,  // valor real vem da fatura
          dia: Number(c.dia_vencimento),
          tipo: 'cartao',
          chave: `AUTO_CARTAO_${c.id}`,
        })
      }

      for (const r of (recorrentes || [])) {
        const emojiTipo: Record<string, string> = {
          agua: '🚰', energia: '💡', internet: '📡', telefone: '📱',
          aluguel: '🏠', condominio: '🏢', plano_saude: '💊',
          financiamento: '🏦', boleto: '📄', cartao: '💳', outro: '📋',
        }
        const emoji = emojiTipo[r.tipo] || '📋'
        fontes.push({
          descricao: `${emoji} Pagar ${r.descricao}${r.valor ? ` — R$ ${Number(r.valor).toFixed(2).replace('.', ',')}` : ''}`,
          valor: r.valor ? Number(r.valor) : null,
          dia: Number(r.dia_vencimento),
          tipo: r.tipo || 'boleto',
          chave: `AUTO_REC_${r.id}`,
        })
      }

      if (fontes.length === 0) continue

      // ── 3. Gera eventos para cada fonte nos próximos 2 meses ──
      for (const fonte of fontes) {
        // Verifica meses 0 (atual) e 1 (próximo)
        for (let mOffset = 0; mOffset <= 1; mOffset++) {
          const dataAlvo = new Date(agora)
          dataAlvo.setDate(1)
          dataAlvo.setMonth(agora.getMonth() + mOffset)

          // Ajusta o dia (ex: fevereiro não tem dia 31)
          const ultimoDiaDoMes = new Date(dataAlvo.getFullYear(), dataAlvo.getMonth() + 1, 0).getDate()
          const diaReal = Math.min(fonte.dia, ultimoDiaDoMes)
          dataAlvo.setDate(diaReal)

          const dataIsoManha = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, '0')}-${String(diaReal).padStart(2, '0')}T09:00:00`
          const dataIsoNoite  = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, '0')}-${String(diaReal).padStart(2, '0')}T20:00:00`

          // Só cria eventos futuros (não cria no passado)
          if (dataAlvo < agora && dataAlvo.toISOString().split('T')[0] < hoje) continue
          // Só cria dentro da janela de 60 dias
          if (dataAlvo.toISOString().split('T')[0] > ate60) continue

          // ── 4. Deduplicação: verifica se já existe evento com mesma chave ──
          // Usa a chave única no campo `descricao` iniciando com a chave AUTO
          const mesRef = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, '0')}`
          const chaveUnica = `${fonte.chave}_${mesRef}`

          const { data: jaExiste } = await supabase
            .from('agenda_eventos')
            .select('id')
            .eq('user_id', uid)
            .like('descricao', `%${chaveUnica}%`)
            .maybeSingle()

          if (jaExiste) {
            totalIgnorados++
            continue
          }

          // ── 5. Cria evento principal (manhã — dispara notificação) ──
          const { error: e1 } = await supabase.from('agenda_eventos').insert({
            user_id:     uid,
            titulo:      fonte.descricao,
            descricao:   `[${chaveUnica}] Gerado automaticamente pelo sistema`,
            data_inicio:  dataIsoManha,
            tipo:        'vencimento',
            status:      'pendente',
          })

          if (e1) {
            console.error(`[gerar-vencimentos] Erro ao criar evento manhã: ${e1.message}`)
            continue
          }

          // ── 6. Cria confirmação noturna (20h) ────────────────────
          await supabase.from('agenda_eventos').insert({
            user_id:     uid,
            titulo:      `✅ Verificar: ${fonte.descricao.replace(/^[^ ]+ /, '')}`,
            descricao:   `[${chaveUnica}_CONF] Verificação noturna automática`,
            data_inicio:  dataIsoNoite,
            tipo:        'lembrete',
            status:      'pendente',
          })

          totalCriados++
          console.log(`[gerar-vencimentos] ✅ Criado: ${fonte.descricao} em ${dataIsoManha}`)
        }
      }
    }

    console.log(`[gerar-vencimentos] Concluído: ${totalCriados} criados, ${totalIgnorados} já existiam`)
    return new Response(JSON.stringify({
      ok: true,
      criados: totalCriados,
      ignorados: totalIgnorados,
      timestamp: agora.toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', ...cors }
    })

  } catch (err) {
    console.error('[gerar-vencimentos] Erro geral:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors }
    })
  }
})
