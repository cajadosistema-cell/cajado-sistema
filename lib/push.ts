'use client'

// ════════════════════════════════════════════════════════════════
// lib/push.ts — ÚNICO ponto de registro de push do sistema.
//
// 🔴 BUGS QUE ISSO CORRIGE:
//
// Existiam TRÊS implementações diferentes (usePushNotifications.ts,
// push-notification-button.tsx, chat-notifications.tsx) e TODAS tinham
// o mesmo defeito fatal:
//
//     await fetch('/api/push/subscribe', {...})   // ← retornava 500
//     setStatus('subscribed')                      // ← "✅ ativado" mesmo assim
//
// Ninguém checava `resp.ok`. Como a rota falhava (colunas inexistentes),
// o botão ficava VERDE dizendo "Notificações ativadas" — e nada tinha
// sido salvo. O Sr. Max confiava e nunca recebia nada.
//
// Além disso:
//  • usePushNotifications gravava DIRETO no Supabase (anon key) em vez de
//    usar a rota — o que exige política RLS de INSERT. Aqui usamos sempre
//    a rota (service role), que não depende de RLS.
//  • Notification.requestPermission() era chamado dentro de useEffect, sem
//    gesto do usuário. Safari/iOS BLOQUEIA isso. A permissão só é pedida
//    a partir de um clique (ver `ativarPush`).
// ════════════════════════════════════════════════════════════════

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BDTr-UnYGrhffBkUnBtgNOultBRobUHHysKflg8b2kgZ0FLL2zia_vet1Kzv6pD3UUb7XVM3aMhcFORUESEo0iw'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSuportado(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export type StatusPush = 'ativo' | 'inativo' | 'negado' | 'nao_suportado'

/** Estado atual, SEM pedir permissão nem registrar nada */
export async function statusPush(): Promise<StatusPush> {
  if (!pushSuportado()) return 'nao_suportado'
  if (Notification.permission === 'denied') return 'negado'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return 'inativo'
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'ativo' : 'inativo'
  } catch {
    return 'inativo'
  }
}

/**
 * Registra o dispositivo para push.
 *
 * ⚠️ DEVE ser chamado a partir de um GESTO DO USUÁRIO (clique num botão).
 *    Safari/iOS bloqueia Notification.requestPermission() fora de um gesto.
 *
 * @throws Error com a mensagem REAL da falha — nunca "sucesso" silencioso.
 */
export async function ativarPush(userId: string): Promise<void> {
  if (!pushSuportado()) {
    throw new Error('Este navegador não suporta notificações push.')
  }
  if (!userId) {
    throw new Error('Usuário não identificado.')
  }

  // 1. Service worker
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready

  // 2. Permissão (exige gesto do usuário — por isso esta função só é
  //    chamada a partir de um onClick)
  const permissao = await Notification.requestPermission()
  if (permissao === 'denied') {
    throw new Error('Você bloqueou as notificações. Libere nas configurações do navegador.')
  }
  if (permissao !== 'granted') {
    throw new Error('Permissão de notificação não concedida.')
  }

  // 3. Subscription
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  // 4. Grava no servidor — 🔴 AQUI ESTAVA O BUG: ninguém checava a resposta
  const resp = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), userId }),
  })

  if (!resp.ok) {
    const detalhe = await resp.json().catch(() => ({}))
    const msg = detalhe?.error || `HTTP ${resp.status}`
    // Desfaz a subscription local: sem registro no servidor, ela é inútil
    // e deixaria o botão "verde" mentindo que está tudo certo.
    await sub.unsubscribe().catch(() => {})
    console.error('[Push] ❌ servidor recusou o registro:', msg)
    throw new Error(`Não consegui registrar o dispositivo: ${msg}`)
  }

  console.log('[Push] ✅ dispositivo registrado com sucesso')
}

/** Remove o dispositivo. Também reporta falha de verdade. */
export async function desativarPush(userId?: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return

  const endpoint = sub.endpoint
  await sub.unsubscribe()

  const resp = await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, userId }),
  })

  if (!resp.ok) {
    const detalhe = await resp.json().catch(() => ({}))
    console.warn('[Push] servidor não removeu o registro:', detalhe?.error || resp.status)
  }
}

/**
 * Re-sincroniza no login: se o dispositivo JÁ tem permissão e subscription,
 * garante que o servidor tem o registro (ex: outro usuário logou no mesmo
 * aparelho, ou a linha foi perdida).
 *
 * ⚠️ NÃO pede permissão. Roda em silêncio, seguro para useEffect.
 */
export async function ressincronizarPush(userId: string): Promise<void> {
  if (!pushSuportado() || !userId) return
  if (Notification.permission !== 'granted') return   // nunca pedir sem gesto

  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return

    const resp = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), userId }),
    })

    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}))
      console.error('[Push] ❌ ressincronização falhou:', d?.error || resp.status)
    }
  } catch (e: any) {
    console.error('[Push] erro na ressincronização:', e?.message)
  }
}
