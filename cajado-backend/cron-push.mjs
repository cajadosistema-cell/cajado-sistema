/**
 * Railway Cron Worker — Push Notifications
 * Roda a cada 5 min via Railway Cron Schedule: */5 * * * *
 * Chama a rota /api/cron/send-push do app Railway (cajado-sistema).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sistema.cajadosolucoes.com.br'
const CRON_SECRET = process.env.CRON_SECRET || ''

async function executar() {
  const url = `${APP_URL}/api/cron/send-push?secret=${CRON_SECRET}`
  console.log(`[cron-push] ${new Date().toISOString()} — Chamando push...`)

  try {
    const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(25000) })
    const data = await resp.json()
    console.log(`[cron-push] Resultado:`, JSON.stringify(data))
    process.exit(resp.ok ? 0 : 1)
  } catch (err) {
    console.error(`[cron-push] Erro:`, err.message)
    process.exit(1)
  }
}

executar()
