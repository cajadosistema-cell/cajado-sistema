'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

type Status = 'idle' | 'checking' | 'supported' | 'granted' | 'denied' | 'unsupported'

export function BotaoPushNotification() {
  const supabase = createClient()
  const [status, setStatus] = useState<Status>('checking')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
    verificarSuporteEStatus()
  }, []) // eslint-disable-line

  const verificarSuporteEStatus = async () => {
    setStatus('checking')
    // Verifica suporte
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    // iOS: só funciona se adicionado à tela inicial
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !isStandalone) {
      setStatus('unsupported') // ainda não instalado como PWA
      return
    }
    // Verifica permissão atual
    const perm = Notification.permission
    if (perm === 'granted') setStatus('granted')
    else if (perm === 'denied') setStatus('denied')
    else setStatus('supported')
  }

  const ativarNotificacoes = async () => {
    if (!userId) return
    setLoading(true)
    try {
      // Solicita permissão
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setStatus('denied'); return }

      // Registra service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Subscreve no push manager
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })

      // Salva no backend
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userId }),
      })
      if (!res.ok) throw new Error('Falha ao salvar subscription')

      setStatus('granted')
    } catch (err: any) {
      console.error('[Push]', err)
      alert('Erro ao ativar notificações: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const desativarNotificacoes = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint, userId }),
          })
          await sub.unsubscribe()
        }
      }
      setStatus('supported')
    } catch (err: any) {
      console.error('[Push Unsub]', err)
    } finally {
      setLoading(false)
    }
  }

  // Não renderiza se não suporta ou ainda carregando
  if (status === 'checking' || status === 'unsupported') {
    if (status === 'unsupported' && /iPhone|iPad/.test(navigator?.userAgent || '')) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
          📱 Para notificações no iPhone: Safari → Compartilhar → <strong>Adicionar à Tela Inicial</strong>
        </div>
      )
    }
    return null
  }

  if (status === 'denied') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
        🔕 Notificações bloqueadas nas configurações do seu navegador/iPhone.
      </div>
    )
  }

  if (status === 'granted') {
    return (
      <button
        onClick={desativarNotificacoes}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
      >
        {loading ? '⏳' : '🔔'} Notificações ativas — toque para desativar
      </button>
    )
  }

  return (
    <button
      onClick={ativarNotificacoes}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-400 hover:bg-blue-500/20 transition-colors"
    >
      {loading ? '⏳ Ativando...' : '🔔 Ativar notificações no celular'}
    </button>
  )
}
