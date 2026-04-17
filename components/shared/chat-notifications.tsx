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
      {/* Avatar */}
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
      >
        ×
      </button>
    </div>
  )
}

// ── Provider principal ────────────────────────────────────────
export function ChatNotifications() {
  const supabase = createClient()
  const pathname = usePathname()
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const currentUserRef = useRef<string | null>(null)
  const equipeRef = useRef<Record<string, string>>({}) // id → nome
  const permissionRef = useRef<NotificationPermission>('default')

  // Solicitar permissão de notificação do browser
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    permissionRef.current = Notification.permission
    if (Notification.permission === 'default') {
      // Aguarda um gesto do usuário para pedir — dispara após 3s
      const t = setTimeout(() => {
        Notification.requestPermission().then(p => {
          permissionRef.current = p
        })
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [])

  // Carregar usuário atual e equipe
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      currentUserRef.current = session.user.id

      const { data: funcs } = await supabase.from('funcionarios').select('id, nome').order('nome')
      if (funcs) {
        const map: Record<string, string> = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(funcs as any[]).forEach((f: any) => { map[f.id] = f.nome })
        equipeRef.current = map
      }
    }
    init()
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const navigateToChat = useCallback((chatId: string | null) => {
    // Armazena o destino no sessionStorage para o chat abrir na conversa certa
    if (chatId) {
      sessionStorage.setItem('cajado_open_chat', chatId)
    } else {
      sessionStorage.setItem('cajado_open_chat', 'geral')
    }
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

          // Ignorar mensagens do próprio usuário
          if (!myId || msg.remetente_id === myId) return

          // Ignorar DMs que não são para mim
          if (msg.destinatario_id !== null && msg.destinatario_id !== myId) return

          const nomeRemetente = equipeRef.current[msg.remetente_id] ?? 'Alguém'
          const iniciais = nomeRemetente.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
          const textoPreview = msg.texto
            ? msg.texto.slice(0, 80)
            : '🎤 Mensagem de voz'

          const isOnChatPage = pathname === '/comunicacao'

          // ── Browser Notification (funciona fora do app quando PWA instalado) ──
          if (permissionRef.current === 'granted') {
            const notification = new Notification(
              msg.destinatario_id === null
                ? `💬 ${nomeRemetente} — Geral`
                : `💬 ${nomeRemetente}`,
              {
                body: textoPreview,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: `chat-${msg.remetente_id}`,
                silent: false,
              }
            )
            notification.onclick = () => {
              window.focus()
              navigateToChat(msg.destinatario_id)
              notification.close()
            }
          }

          // ── Toast in-app (sempre visível dentro do sistema) ──
          // Não mostra toast se estiver na página de chat E a conversa já está aberta
          // (o chat já tem scroll automático nesse caso)
          const alreadyOnThisChat = isOnChatPage // simplificado — o chat cuida do próprio scroll
          if (!alreadyOnThisChat) {
            const toast: ToastMsg = {
              id: `${msg.id}-${Date.now()}`,
              nome: nomeRemetente,
              texto: textoPreview,
              avatar: iniciais,
              chatId: msg.destinatario_id ?? null,
            }
            setToasts(prev => [...prev.slice(-2), toast]) // máx 3 toasts ao mesmo tempo
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
      aria-label="Notificações de chat"
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
