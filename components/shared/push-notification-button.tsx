'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function PushNotificationButton() {
  const supabase = createClient()
  const [status, setStatus] = useState<'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported'>('idle')
  const [sub, setSub] = useState<PushSubscription | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    // Register service worker
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.pushManager.getSubscription().then(existing => {
        if (existing) { setSub(existing); setStatus('subscribed') }
        else { setStatus('idle') }
      })
    }).catch(() => setStatus('unsupported'))

    // Check if already denied
    if (Notification.permission === 'denied') setStatus('denied')
  }, [])

  const ativar = async () => {
    setStatus('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus('denied'); return }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })

      const { data: { user } } = await supabase.auth.getUser()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userId: user?.id,
        }),
      })

      setSub(subscription)
      setStatus('subscribed')
    } catch {
      setStatus('idle')
    }
  }

  const desativar = async () => {
    if (!sub) return
    setStatus('loading')
    await sub.unsubscribe()
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
    setSub(null)
    setStatus('idle')
  }

  if (status === 'unsupported') return null

  return (
    <div className="flex items-center gap-2">
      {status === 'subscribed' ? (
        <button
          onClick={desativar}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all"
          title="Alertas ativos — clique para desativar"
        >
          🔔 Alertas ativos
        </button>
      ) : status === 'denied' ? (
        <span className="text-xs text-fg-disabled" title="Permissão negada no navegador">🔕 Bloqueado</span>
      ) : (
        <button
          onClick={ativar}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
          title="Ativar alertas no celular"
        >
          {status === 'loading' ? '⏳ Ativando...' : '🔔 Ativar alertas'}
        </button>
      )}
    </div>
  )
}

// Hook para enviar notificação de teste
export async function enviarPushTeste(userId: string) {
  return fetch('/api/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinatarioId: userId,
      remetenteNome: 'Cajado Sistema',
      texto: 'Seus alertas estão funcionando! ✅',
      url: '/inicio',
    }),
  })
}
