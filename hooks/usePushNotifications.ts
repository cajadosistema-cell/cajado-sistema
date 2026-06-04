'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Chave pública VAPID — usa a variável de ambiente (mesma chave do servidor)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  || 'BDTr-UnYGrhffBkUnBtgNOultBRobUHHysKflg8b2kgZ0FLL2zia_vet1Kzv6pD3UUb7XVM3aMhcFORUESEo0iw'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications(userId: string | null) {
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (!('PushManager' in window)) return

    async function registrar() {
      try {
        // 1. Registra o Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready

        // 2. Verifica permissão
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') return

        // 3. Cria/recupera subscription de push
        let sub = await registration.pushManager.getSubscription()
        if (!sub) {
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          })
        }

        // 4. Extrai keys e salva no Supabase (upsert por endpoint)
        const json = sub.toJSON()
        const endpoint = json.endpoint!
        const p256dh = json.keys?.p256dh!
        const auth = json.keys?.auth!

        await (supabase.from('push_subscriptions') as any).upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent.substring(0, 200),
          },
          { onConflict: 'user_id,endpoint' }
        )

        console.log('[Push] Subscription registrada ✅')
      } catch (err) {
        // Silencioso — não bloqueia o app
        console.warn('[Push] Falha ao registrar:', err)
      }
    }

    registrar()
  }, [userId, supabase])
}
