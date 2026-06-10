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
  verificarEEnviarAlertas() // roda imediatamente ao iniciar
  cronAlertasWA = setInterval(verificarEEnviarAlertas, 5 * 60 * 1000)
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
