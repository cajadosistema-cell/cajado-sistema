/**
 * Railway Cron Worker — Push Notifications
 * Roda a cada 1 minuto via Railway Cron Schedule.
 * Chama a rota /api/cron/send-push do próprio app Railway.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://sistema.cajadosolucoes.com.br'

const CRON_SECRET = process.env.CRON_SECRET || ''

async function executar() {
  const url = `${APP_URL}/api/cron/send-push?secret=${CRON_SECRET}`
  console.log(`[cron] ${new Date().toISOString()} — Chamando ${APP_URL}/api/cron/send-push`)

  try {
    const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(25000) })
    const data = await resp.json()
    console.log(`[cron] Resultado:`, JSON.stringify(data))

    if (!resp.ok) {
      console.error(`[cron] HTTP ${resp.status}`)
      process.exit(1)
    }
  } catch (err) {
    console.error(`[cron] Erro:`, err.message)
    process.exit(1)
  }
}

executar()
