'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ToastMsg {
  id: string
  nome: string
  texto: string
  avatar: string
  chatId: string | null
}

// ── Toast de notificação in-app ────────────────────────────────
function NotificationToast({ msg, onClose, onClick }: {
  msg: ToastMsg
  onClose: () => void
  onClick: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className={cn(
        'flex items-start gap-3 bg-[#141928] border border-violet-500/30 rounded-2xl',
        'px-4 py-3 shadow-2xl shadow-black/40 cursor-pointer w-full max-w-xs',
        'animate-in slide-in-from-top-2 fade-in duration-300',
      )}
      onClick={onClick}
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 font-bold text-white text-xs">
        {msg.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-violet-300 truncate">{msg.nome}</p>
        <p className="text-xs text-zinc-300 truncate mt-0.5 leading-relaxed">{msg.texto}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onClose() }}
        className="text-zinc-600 hover:text-zinc-400 text-lg leading-none shrink-0 -mt-0.5"
        aria-label="Fechar"
      >×</button>
    </div>
  )
}

// ── Registrar Service Worker e Web Push Subscription ──────────
async function registerPushSubscription(userId: string) {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    // Registra o service worker
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

    // Converte a VAPID key para Uint8Array
    const urlBase64ToUint8Array = (base64String: string) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
      const rawData = window.atob(base64)
      const outputArray = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
      return outputArray
    }

    // Tenta pegar subscription existente ou criar nova
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    // Salva no banco
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), userId }),
    })
  } catch (err) {
    console.warn('[WebPush] Falha ao registrar:', err)
  }
}

// ── Provider principal ────────────────────────────────────────
export function ChatNotifications() {
  const pathname = usePathname()
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const currentUserRef = useRef<string | null>(null)
  const equipeRef = useRef<Record<string, string>>({})

  // Carregar usuário e registrar push subscription
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      currentUserRef.current = session.user.id

      // Carregar nomes da equipe
      const { data: funcs } = await supabase.from('funcionarios').select('id, nome')
      if (funcs) {
        const map: Record<string, string> = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(funcs as any[]).forEach((f: any) => { map[f.id] = f.nome })
        equipeRef.current = map
      }

      // Registrar Web Push (após 2s para não bloquear carregamento)
      setTimeout(() => registerPushSubscription(session.user.id), 2000)
    }
    init()
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const navigateToChat = useCallback((chatId: string | null) => {
    if (chatId) sessionStorage.setItem('cajado_open_chat', chatId)
    else sessionStorage.setItem('cajado_open_chat', 'geral')
    window.location.href = '/comunicacao'
  }, [])

  // Realtime listener — ativa em TODO o dashboard
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel('chat_notif_global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_interno' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const msg = payload.new
          const myId = currentUserRef.current

          if (!myId || msg.remetente_id === myId) return
          if (msg.destinatario_id !== null && msg.destinatario_id !== myId) return

          const nomeRemetente = equipeRef.current[msg.remetente_id] ?? 'Alguém'
          const iniciais = nomeRemetente.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
          const textoPreview = msg.texto ? msg.texto.slice(0, 80) : '🎤 Mensagem de voz'

          const isOnChatPage = pathname === '/comunicacao'

          // Toast in-app (só fora do chat)
          if (!isOnChatPage) {
            setToasts(prev => [
              ...prev.slice(-2),
              {
                id: `${msg.id}-${Date.now()}`,
                nome: nomeRemetente,
                texto: textoPreview,
                avatar: iniciais,
                chatId: msg.destinatario_id ?? null,
              },
            ])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pathname, navigateToChat])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <NotificationToast
            msg={t}
            onClose={() => dismissToast(t.id)}
            onClick={() => { dismissToast(t.id); navigateToChat(t.chatId) }}
          />
        </div>
      ))}
    </div>
  )
}
