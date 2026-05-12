// cajado-backend/src/routes/push-alarmes.routes.js
// Cron: verifica alarmes vencidos e envia push notification para o dispositivo do usuário

const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const webpush = require('web-push')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

webpush.setVapidDetails(
  'mailto:sistema@cajado.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// ── Função principal: verifica e dispara alarmes ──────────────────────────
async function verificarAlarmes() {
  try {
    const agora   = new Date()
    const em15min = new Date(agora.getTime() + 15 * 60 * 1000)

    // Busca eventos do tipo lembrete que estão prestes a vencer (próximos 1 min)
    // ou que já passaram e ainda não foram notificados
    const { data: alarmes, error } = await supabase
      .from('agenda_eventos')
      .select('id, user_id, titulo, descricao, data_inicio, tipo')
      .eq('tipo', 'lembrete')
      .eq('status', 'pendente')
      .is('push_enviado', null)
      .gte('data_inicio', agora.toISOString())
      .lte('data_inicio', em15min.toISOString())

    if (error || !alarmes?.length) return

    for (const alarme of alarmes) {
      // Busca subscriptions do usuário
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', alarme.user_id)

      if (!subs?.length) continue

      const minutosRestantes = Math.round((new Date(alarme.data_inicio) - agora) / 60000)
      const horarioFormatado = new Date(alarme.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      const payload = JSON.stringify({
        title: `⏰ ${alarme.titulo}`,
        body:  minutosRestantes > 0
          ? `Em ${minutosRestantes} minuto(s) — ${horarioFormatado}`
          : `Agora! ${horarioFormatado}`,
        url:  '/inicio',
        tag:  'alarme-' + alarme.id,
        requireInteraction: true,
      })

      let algumEnviado = false
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
          algumEnviado = true
        } catch (err) {
          // Endpoint expirado — remove
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        }
      }

      // Marca o alarme como notificado para não disparar de novo
      if (algumEnviado) {
        await supabase.from('agenda_eventos')
          .update({ push_enviado: new Date().toISOString() })
          .eq('id', alarme.id)
      }
    }
  } catch (err) {
    console.error('[Alarmes Cron]', err.message)
  }
}

// ── Inicia o cron a cada 60 segundos ──────────────────────────────────────
let cronInterval = null

function iniciarCronAlarmes() {
  if (cronInterval) return
  console.log('[Push Alarmes] Cron iniciado — verificando a cada 60s')
  verificarAlarmes() // Roda imediatamente ao iniciar
  cronInterval = setInterval(verificarAlarmes, 60 * 1000)
}

// ── Rota de status ─────────────────────────────────────────────────────────
router.get('/push/status', (req, res) => {
  res.json({ ok: true, cronAtivo: !!cronInterval, mensagem: 'Cron de alarmes ativo' })
})

// ── Rota manual: disparar push para um usuário ─────────────────────────────
router.post('/push/enviar', async (req, res) => {
  try {
    const { userId, title, message, url } = req.body
    if (!userId || !title) return res.status(400).json({ error: 'userId e title são obrigatórios' })

    const { data: subs } = await supabase
      .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId)

    if (!subs?.length) return res.json({ ok: false, msg: 'Nenhum dispositivo' })

    const payload = JSON.stringify({ title, body: message || title, url: url || '/inicio', requireInteraction: true })
    let enviados = 0
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        enviados++
      } catch {}
    }
    res.json({ ok: true, enviados })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = { router, iniciarCronAlarmes }
