// cajado-backend/src/routes/alertas-whatsapp.routes.js
// ─────────────────────────────────────────────────────────────
// Cron de alertas via WhatsApp — roda a cada 5 minutos.
// Busca eventos de agenda com data próxima e envia mensagem
// via Evolution API para o WhatsApp do usuário.
// Solução definitiva: funciona mesmo com o app fechado/em background.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router  = express.Router()
const { createClient } = require('@supabase/supabase-js')
const { enviarWhatsApp } = require('../services/evolution.service')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Número padrão para alertas do dono (fallback se perfil não tiver) ────────
// Configure ALERTA_WHATSAPP_DONO no Railway com o número do Sr. Max (ex: 5571999999999)
const NUMERO_DONO = process.env.ALERTA_WHATSAPP_DONO || null

// ── Instância Evolution a usar para alertas ──────────────────────────────────
// Configure ALERTA_WHATSAPP_INSTANCIA no Railway (ex: cajado01 ou botwhatsapp01)
const INSTANCIA_ALERTA = process.env.ALERTA_WHATSAPP_INSTANCIA
  || process.env.INSTANCE
  || 'botwhatsapp01'

// ─── Função principal ────────────────────────────────────────────────────────
async function verificarEEnviarAlertas() {

// --- Relatório Matinal Automático (Executa às 08:00 todos os dias) ---
async function enviarRelatorioMatinal() {
  try {
    const hoje = new Date()
    // Apenas dispara entre 08:00 e 08:15 (roda a cada 5m, então cairá aqui 1 vez ao dia)
    if (hoje.getHours() !== 8 || hoje.getMinutes() > 15) return

    // Evita enviar duas vezes no mesmo dia
    const hojeStr = hoje.toISOString().substring(0, 10) // YYYY-MM-DD
    const { data: logsHoje } = await supabase
      .from('logs_sistema')
      .select('id')
      .eq('tipo', 'relatorio_matinal')
      .gte('created_at', `${hojeStr}T00:00:00`)
      .limit(1)

    if (logsHoje?.length) return // já enviou hoje

    console.log(`[Alertas-WA] Preparando resumo matinal financeiro...`)

    // Busca eventos (vencimentos) dos próximos 7 dias
    const daqui7Dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000)
    const { data: eventos, error } = await supabase
      .from('agenda_eventos')
      .select('user_id, titulo, data_inicio, tipo')
      .eq('tipo', 'vencimento')
      .in('status', ['pendente'])
      .gte('data_inicio', `${hojeStr}T00:00:00`)
      .lte('data_inicio', daqui7Dias.toISOString())
      .order('data_inicio', { ascending: true })

    if (error || !eventos?.length) return // sem compromissos, não envia para não incomodar

    // Agrupa por usuário
    const vencimentosPorUser = {}
    eventos.forEach(ev => {
      if (!vencimentosPorUser[ev.user_id]) vencimentosPorUser[ev.user_id] = []
      vencimentosPorUser[ev.user_id].push(ev)
    })

    for (const userId in vencimentosPorUser) {
      let numero = NUMERO_DONO
      const { data: perfil } = await supabase.from('perfis').select('whatsapp, nome').eq('id', userId).maybeSingle()
      if (perfil?.whatsapp) numero = perfil.whatsapp
      if (!numero) continue

      const evts = vencimentosPorUser[userId]
      let msg = `🌅 *Bom dia, ${perfil?.nome?.split(' ')[0] || 'Sr. Max'}!*\n\n`
      msg += `Aqui está o seu *Resumo Financeiro* para os próximos 7 dias:\n\n`

      let urgentes = 0
      evts.forEach(ev => {
        const dataEv = new Date(ev.data_inicio)
        const diff = Math.ceil((dataEv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
        const dtFmt = dataEv.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        const urg = diff <= 2 ? '🔴' : '🟡'
        if (diff <= 2) urgentes++
        const quando = diff === 0 ? '*HOJE*' : diff === 1 ? 'amanhã' : `dia ${dtFmt}`
        msg += `${urg} ${ev.titulo} — ${quando}\n`
      })

      msg += `\n_Total: ${evts.length} compromisso(s) pendente(s)._`
      if (urgentes > 0) msg += `\n⚠️ *Atenção: Você tem ${urgentes} vencimento(s) urgente(s)!*`
      msg += `\n\nAbra o Cajado para gerenciar.`

      await enviarWhatsApp(numero, msg, INSTANCIA_ALERTA)
      console.log(`[Alertas-WA] Resumo matinal enviado para ${numero}`)
    }

    // Registra log para não enviar de novo hoje
    // Cria tabela caso não exista (se falhar, não impede execução amanhã)
    try { await supabase.from('logs_sistema').insert([{ tipo: 'relatorio_matinal', payload: { data: hojeStr } }]) } catch(e){}

  } catch (err) {
    console.error('[Alertas-WA] Erro no resumo matinal:', err.message)
  }
}
  try {
    const agora   = new Date()
    const em15min = new Date(agora.getTime() + 15 * 60 * 1000)
    const em1min  = new Date(agora.getTime() + 1  * 60 * 1000) // já passou (1min atrás)

    // Busca eventos pendentes que estão nos próximos 15 minutos
    // e que ainda não foram notificados via WhatsApp
    const { data: eventos, error } = await supabase
      .from('agenda_eventos')
      .select('id, user_id, titulo, descricao, data_inicio, tipo')
      .in('status', ['pendente'])
      .gte('data_inicio', new Date(agora.getTime() - 60 * 1000).toISOString()) // permite 1min de atraso
      .lte('data_inicio', em15min.toISOString())
      .is('whatsapp_alerta_enviado', null)
      .order('data_inicio', { ascending: true })

    if (error) {
      // Coluna pode não existir ainda (aguardando migration) — silencioso
      if (error.message?.includes('whatsapp_alerta_enviado')) {
        console.log('[Alertas-WA] Coluna whatsapp_alerta_enviado ainda não existe. Rode a migration 055.')
        return
      }
      console.error('[Alertas-WA] Erro ao buscar eventos:', error.message)
      return
    }

    if (!eventos?.length) return

    console.log(`[Alertas-WA] ${eventos.length} alerta(s) para disparar`)

    for (const ev of eventos) {
      try {
        // 1. Busca número WhatsApp do usuário no perfis
        let numero = NUMERO_DONO
        const { data: perfil } = await supabase
          .from('perfis')
          .select('whatsapp')
          .eq('id', ev.user_id)
          .maybeSingle()

        if (perfil?.whatsapp) numero = perfil.whatsapp

        if (!numero) {
          console.warn(`[Alertas-WA] Usuário ${ev.user_id} sem número WhatsApp. Configure ALERTA_WHATSAPP_DONO no Railway.`)
          // Marca como enviado para não repetir
          await supabase.from('agenda_eventos')
            .update({ whatsapp_alerta_enviado: new Date().toISOString() })
            .eq('id', ev.id)
          continue
        }

        // 2. Monta a mensagem
        const dataEvento  = new Date(ev.data_inicio)
        const diffMs      = dataEvento.getTime() - agora.getTime()
        const diffMin     = Math.round(diffMs / 60000)
        const horario     = dataEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' })
        const dataDia     = dataEvento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Bahia' })

        let quando = ''
        if (diffMin <= 0)      quando = '⚠️ *AGORA!*'
        else if (diffMin <= 1) quando = 'em *1 minuto!*'
        else                   quando = `em *${diffMin} minutos*`

        const emoji = ev.tipo === 'vencimento' ? '💳' : ev.tipo === 'reuniao' ? '🤝' : '⏰'

        const msg = `${emoji} *Lembrete — Sistema Cajado*\n\n`
          + `📌 ${ev.titulo}\n`
          + `🕐 ${horario}h (${dataDia}) — ${quando}\n`
          + (ev.descricao && !ev.descricao.startsWith('[AUTO_') ? `📝 ${ev.descricao.substring(0, 100)}\n` : '')
          + `\n_Abra o Sistema Cajado para mais detalhes._`

        // 3. Envia via WhatsApp
        await enviarWhatsApp(numero, msg, INSTANCIA_ALERTA)

        // 4. Marca como enviado
        await supabase.from('agenda_eventos')
          .update({ whatsapp_alerta_enviado: new Date().toISOString() })
          .eq('id', ev.id)

        console.log(`[Alertas-WA] ✅ Alerta enviado: "${ev.titulo}" → ${numero} (${quando})`)

      } catch (errEvento) {
        console.error(`[Alertas-WA] ❌ Erro ao processar evento ${ev.id}:`, errEvento.message)
      }
    }
  } catch (err) {
    console.error('[Alertas-WA] Erro geral:', err.message)
  }
}

// ─── Cron interno: dispara a cada 5 minutos ──────────────────────────────────
let cronAlertasWA = null

function iniciarCronAlertasWhatsApp() {
  if (cronAlertasWA) return
  console.log('[Alertas-WA] ✅ Cron iniciado — verificando a cada 5 minutos')
  
  const tick = async () => {
    await verificarEEnviarAlertas()
    await enviarRelatorioMatinal()
  }
  
  tick() // roda imediatamente ao iniciar
  cronAlertasWA = setInterval(tick, 5 * 60 * 1000)
}

// ─── Rotas de diagnóstico ─────────────────────────────────────────────────────
router.get('/alertas-wa/status', (req, res) => {
  res.json({
    ok:          true,
    cronAtivo:   !!cronAlertasWA,
    instancia:   INSTANCIA_ALERTA,
    numeroDono:  NUMERO_DONO ? '***' + NUMERO_DONO.slice(-4) : 'não configurado',
    mensagem:    'Cron de alertas WhatsApp ativo (5 minutos)',
  })
})

// Rota manual para testar (chamar manualmente)
router.post('/alertas-wa/verificar', async (req, res) => {
  try {
    await verificarEEnviarAlertas()
    res.json({ ok: true, mensagem: 'Verificação executada' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = { router, iniciarCronAlertasWhatsApp }
