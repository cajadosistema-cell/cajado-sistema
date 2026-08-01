// supabase/functions/gerar-vencimentos/index.ts
// Edge Function que roda 1x por dia (via cron-job.org às 07:00)
// Lê cartões cadastrados + compromissos_fixos recorrentes e cria automaticamente
// eventos de vencimento na agenda_eventos para os próximos 60 dias.
// Garante idempotência via chave única no campo `descricao`.
//
// 31/07-01/08/2026 — CORRIGIDO:
//   (1) FUSO: toda data agora é calculada em America/Sao_Paulo. Esta função roda
//       em UTC no servidor; sem fuso explícito, das 21h à meia-noite (BRT) o
//       "hoje" já era o dia seguinte, e na virada do mês, o mês seguinte.
//   (2) DEDUP: a checagem usava .maybeSingle() com LIKE '%chave%', que casa TANTO
//       com [CHAVE] quanto com [CHAVE_CONF]. A partir do 2º dia sempre havia 2
//       linhas -> maybeSingle devolvia erro, data vinha null, e a função recriava
//       os dois eventos TODO DIA. Agora usa .limit(1) e aborta em caso de erro.
//   (3) Aritmética de mês/dia trocada por strings YYYY-MM-DD: sem setMonth(),
//       que estoura (31/01 + 1 mês = 03/03) e depende do fuso do servidor.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Helpers de data LOCAL ────────────────────────────────────────
// Duplicados de propósito: Edge Function tem bundle Deno próprio e NÃO
// consegue importar de @/lib/utils. Mantenha em sincronia com lib/utils/index.ts.
const TZ = 'America/Sao_Paulo'

/** Data de hoje no fuso de São Paulo, formato YYYY-MM-DD. */
function hojeLocal(d: Date = new Date(), tz: string = TZ): string {
  // 'en-CA' formata nativamente como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/**
 * Soma dias a uma string YYYY-MM-DD.
 * UTC-in/UTC-out de propósito: como entra e sai data pura (sem hora), o
 * resultado é consistente e imune a horário de verão. Mesmo raciocínio da
 * exceção deixada em somarMeses() no useElenaSalvar.ts.
 */
function somarDias(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + dias * 86_400_000)
    .toISOString().split('T')[0]
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Último dia do mês (mes é 1-based: 1 = janeiro). */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Datas: hoje e daqui 60 dias (fuso de São Paulo) ──────────
    const agora     = new Date()
    const hoje      = hojeLocal(agora)          // YYYY-MM-DD local
    const ate60     = somarDias(hoje, 60)       // YYYY-MM-DD local
    const [anoHoje, mesHoje] = hoje.split('-').map(Number)

    console.log(`[gerar-vencimentos] Rodando em ${hoje} (${TZ}), janela até ${ate60}`)

    let totalCriados = 0
    let totalIgnorados = 0

    // ── 1. Lista todos os usuários com cartões ou compromissos_fixos ─
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

      // ── 2b. Compromissos fixos recorrentes (boletos, luz, internet, etc.) ──
      const { data: recorrentes } = await supabase
        .from('compromissos_fixos')
        .select('id, descricao, valor, dia_vencimento, tipo_detalhe, categoria')
        .eq('user_id', uid)
        .eq('ativo', true)
        .eq('recorrente', true)

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
        const emoji = emojiTipo[r.tipo_detalhe] || '📋'
        fontes.push({
          descricao: `${emoji} Pagar ${r.descricao}${r.valor ? ` — R$ ${Number(r.valor).toFixed(2).replace('.', ',')}` : ''}`,
          valor: r.valor ? Number(r.valor) : null,
          dia: Number(r.dia_vencimento),
          tipo: r.tipo_detalhe || 'boleto',
          chave: `AUTO_REC_${r.id}`,
        })
      }

      if (fontes.length === 0) continue

      // ── 3. Gera eventos para cada fonte nos próximos 2 meses ──
      for (const fonte of fontes) {
        if (!fonte.dia || Number.isNaN(fonte.dia)) continue

        // Verifica meses 0 (atual) e 1 (próximo)
        for (let mOffset = 0; mOffset <= 1; mOffset++) {
          // Aritmética de mês em inteiros — sem setMonth() e sem fuso
          const totalMeses = (mesHoje - 1) + mOffset
          const anoAlvo = anoHoje + Math.floor(totalMeses / 12)
          const mesAlvo = (totalMeses % 12) + 1

          // Ajusta o dia (ex: fevereiro não tem dia 31)
          const diaReal = Math.min(fonte.dia, ultimoDiaDoMes(anoAlvo, mesAlvo))

          const mesRef  = `${anoAlvo}-${pad(mesAlvo)}`
          const dataYmd = `${mesRef}-${pad(diaReal)}`

          const dataIsoManha = `${dataYmd}T09:00:00`
          const dataIsoNoite = `${dataYmd}T20:00:00`

          // Só cria eventos futuros (não cria no passado) — comparação de string
          if (dataYmd < hoje) continue
          // Só cria dentro da janela de 60 dias
          if (dataYmd > ate60) continue

          // ── 4. Deduplicação: verifica se já existe evento com mesma chave ──
          // ATENÇÃO: o LIKE abaixo casa com [CHAVE] E com [CHAVE_CONF].
          // Por isso .limit(1) e NÃO .maybeSingle() — maybeSingle quebrava com
          // 2 linhas, devolvia data=null e a função recriava tudo todo dia.
          const chaveUnica = `${fonte.chave}_${mesRef}`

          const { data: jaExiste, error: eDedup } = await supabase
            .from('agenda_eventos')
            .select('id')
            .eq('user_id', uid)
            .like('descricao', `%${chaveUnica}%`)
            .limit(1)

          if (eDedup) {
            // Na dúvida NÃO cria: faltar um evento é melhor que duplicar
            console.error(`[gerar-vencimentos] Dedup falhou em ${chaveUnica}: ${eDedup.message}`)
            continue
          }

          if (jaExiste && jaExiste.length > 0) {
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
      data_local: hoje,
      timestamp: agora.toISOString(),   // timestamp real — UTC aqui é correto
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
