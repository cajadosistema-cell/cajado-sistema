'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/toast'

interface Funcionario {
  id: string
  nome: string
  email: string
  cargo: string
  ativo: boolean
  avatar_url?: string
}

interface MensagemChat {
  id: string
  remetente_id: string
  destinatario_id: string | null
  texto: string | null
  audio_base64: string | null
  created_at: string
}

// ── Avatar helpers ────────────────────────────────────────────
function getInitials(nome: string) {
  return nome
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

function Avatar({ nome, size = 'md' }: { nome: string; size?: 'sm' | 'md' }) {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
  ]
  const idx = nome.charCodeAt(0) % colors.length
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={cn(
      'rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shrink-0',
      colors[idx], dim
    )}>
      {getInitials(nome)}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────

// ── Contact list item ────────────────────────────────────────
const ContactItem = ({ id, name, subtitle, isActive, online, isGeral, onClick }: {
  id: string | null; name: string; subtitle: string; isActive: boolean; online?: boolean; isGeral?: boolean; onClick: () => void
}) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full text-left px-4 py-3 flex items-center gap-3 transition-all',
      isActive
        ? 'bg-brand-gold-soft border-l-2 border-brand-gold'
        : 'border-l-2 border-transparent hover:bg-surface active:bg-surface-hover'
    )}
  >
    {isGeral ? (
      <div className="w-10 h-10 rounded-full bg-brand-gold-soft flex items-center justify-center shrink-0 text-lg">🌍</div>
    ) : (
      <div className="relative">
        <Avatar nome={name} size="md" />
        {online && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface" />
        )}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className={cn('text-sm font-semibold truncate', isActive ? 'text-brand-gold' : 'text-fg')}>{name}</p>
      <p className="text-[11px] text-fg-tertiary truncate">{subtitle}</p>
    </div>
    {online !== undefined && !isGeral && (
      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full',
        online ? 'text-success bg-success-soft' : 'text-fg-disabled bg-muted'
      )}>
        {online ? 'online' : 'off'}
      </span>
    )}
  </button>
)

export default function ComunicacaoClient() {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [equipe, setEquipe] = useState<Funcionario[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [mensagens, setMensagens] = useState<MensagemChat[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  // Mobile: null = mostra lista, qualquer valor = mostra chat
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const { warning } = useToast()

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Load data & realtime ────────────────────────────────────
  useEffect(() => {
    let mounted = true
    let room: ReturnType<typeof supabase.channel> | null = null
    let chatSub: ReturnType<typeof supabase.channel> | null = null

    async function loadInitialData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !mounted) return
      setCurrentUser(session.user)

      const { data: funcs } = await supabase.from('funcionarios').select('*').order('nome')
      if (funcs && mounted) setEquipe(funcs)

      const { data: msgs } = await supabase
        .from('chat_interno')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(150)
      if (msgs && mounted) setMensagens(msgs as MensagemChat[])

      if (!mounted) return

      // Canal de presença compartilhado (mesmo nome para todos)
      room = supabase.channel('equipe:sala-principal')
      room
        .on('presence', { event: 'sync' }, () => {
          if (!room || !mounted) return
          const newState = room.presenceState()
          const onlines: string[] = []
          for (const key in newState) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(newState[key] as any[]).forEach((p: any) => {
              if (p.user_id) onlines.push(p.user_id as string)
            })
          }
          setOnlineUsers(Array.from(new Set(onlines)))
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && mounted) {
            await room!.track({ user_id: session.user.id, online_at: new Date().toISOString() })
          }
        })

      // Realtime messages — nome único por mount
      chatSub = supabase.channel(`chat_db_changes_${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_interno' }, (payload) => {
          if (mounted) setMensagens(prev => [...prev, payload.new as MensagemChat])
        })
        .subscribe()
    }

    loadInitialData()

    return () => {
      mounted = false
      if (room) supabase.removeChannel(room)
      if (chatSub) supabase.removeChannel(chatSub)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, activeChat])

  // ── Filter messages ─────────────────────────────────────────
  const mensagensFiltradas = mensagens.filter(m => {
    if (activeChat === null) return m.destinatario_id === null
    return (
      (m.remetente_id === currentUser?.id && m.destinatario_id === activeChat) ||
      (m.remetente_id === activeChat && m.destinatario_id === currentUser?.id)
    )
  })

  // ── Web Push helper ─────────────────────────────────────────
  const sendPush = async (destinatario: string | null, texto: string) => {
    if (!currentUser || !destinatario) return // não envia push no canal geral (destinatario = null)
    const nomeRemetente = equipe.find(f => f.id === currentUser.id)?.nome ?? 'Alguém'
    fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinatarioId: destinatario,
        remetenteNome: nomeRemetente,
        texto,
        url: '/comunicacao',
      }),
    }).catch(() => {}) // fire-and-forget, não bloqueia o envio
  }

  // ── Send text ───────────────────────────────────────────────
  const handleSendText = async () => {
    if (!texto.trim() || !currentUser) return
    const textoMsg = texto.trim()
    const msg = { remetente_id: currentUser.id, destinatario_id: activeChat, texto: textoMsg, audio_base64: null }
    setTexto('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('chat_interno') as any).insert(msg)
    sendPush(activeChat, textoMsg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText() }
  }

  // ── Audio ───────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = async () => {
          if (currentUser) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('chat_interno') as any).insert({
              remetente_id: currentUser.id,
              destinatario_id: activeChat,
              texto: null,
              audio_base64: reader.result as string,
            })
            sendPush(activeChat, '🎤 Mensagem de voz')
          }
        }
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000)
    } catch {
      warning('Precisamos de permissão para usar seu microfone. Verifique as configurações do navegador.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop())
      }
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const getRemetente = (id: string) => id === currentUser?.id ? { nome: currentUser?.user_metadata?.nome || currentUser?.email?.split('@')[0] || 'Você', id } : (equipe.find(f => f.id === id) || { nome: 'Desconhecido', id })

  // ── Chat name helper ────────────────────────────────────────
  const activeChatName = activeChat === null
    ? 'Geral da Equipe'
    : equipe.find(u => u.id === activeChat)?.nome ?? '...'

  const activeChatOnline = activeChat !== null && onlineUsers.includes(activeChat)

  // ── Select chat (mobile-aware) ──────────────────────────────
  const selectChat = (id: string | null) => {
    setActiveChat(id)
    setMobileView('chat')
  }

  // ── Unread badge helpers (count msgs from others not yet "read") ──
  const unreadFor = (userId: string | null) => {
    // Simple: count messages not sent by me in this chat thread
    return mensagens.filter(m => {
      if (userId === null) return m.destinatario_id === null && m.remetente_id !== currentUser?.id
      return (
        m.remetente_id === userId &&
        m.destinatario_id === currentUser?.id
      )
    }).length
  }

  // ContactItem extraído

  // ── Contact list panel ───────────────────────────────────────
  const renderContactPanel = () => (
    <div className={cn(
      'flex flex-col bg-sidebar border-r border-border-subtle',
      // Mobile: full width, shown only when mobileView=list
      'w-full md:w-72 lg:w-80',
      mobileView === 'chat' ? 'hidden md:flex' : 'flex'
    )}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-border-subtle bg-page">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🗨️</span>
          <h1 className="text-base font-bold text-fg">Chat Interno</h1>
        </div>
        <p className="text-[11px] text-fg-tertiary">{onlineUsers.length} online agora</p>
        {currentUser && (
          <p className="text-[10px] font-semibold text-brand-gold mt-1 uppercase tracking-wider">
            Logado como: {currentUser.user_metadata?.nome || currentUser.email?.split('@')[0]}
          </p>
        )}
      </div>

      {/* Contacts */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-widest font-bold text-fg-disabled">Canais</p>
        <ContactItem
          id={null}
          name="Geral da Equipe"
          subtitle={`${onlineUsers.length} membros online`}
          isActive={activeChat === null && mobileView === 'chat'}
          isGeral
          onClick={() => selectChat(null)}
        />
        
        <p className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-widest font-bold text-fg-disabled">
          Equipe ({equipe.filter(f => f.id !== currentUser?.id).length})
        </p>
        {equipe.filter(f => f.id !== currentUser?.id).map(user => (
          <ContactItem
            key={user.id}
            id={user.id}
            name={user.nome}
            subtitle={user.cargo || 'Membro'}
            isActive={activeChat === user.id && mobileView === 'chat'}
            online={onlineUsers.includes(user.id)}
            onClick={() => selectChat(user.id)}
          />
        ))}
        {equipe.filter(f => f.id !== currentUser?.id).length === 0 && (
          <p className="px-4 py-6 text-xs text-fg-disabled text-center">Nenhum membro na equipe ainda</p>
        )}
      </div>
    </div>
  )

  // ── Chat panel ───────────────────────────────────────────────
  const renderChatPanel = () => (
    <div className={cn(
      'flex-1 flex flex-col min-w-0 bg-page',
      mobileView === 'list' ? 'hidden md:flex' : 'flex'
    )}>
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-border-subtle bg-sidebar/90 backdrop-blur-md flex items-center gap-3 shrink-0">
        {/* Back button - mobile only */}
        <button
          onClick={() => setMobileView('list')}
          className="md:hidden p-2 -ml-2 text-fg-secondary hover:text-fg active:bg-muted rounded-xl transition"
          aria-label="Voltar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {activeChat === null ? (
          <div className="w-9 h-9 rounded-xl bg-brand-gold-soft border border-brand-gold/30 flex items-center justify-center text-base shrink-0">🌍</div>
        ) : (
          <div className="relative">
            <Avatar nome={activeChatName} size="sm" />
            {activeChatOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0a0d16]" />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-fg truncate">{activeChatName}</p>
          {activeChat !== null ? (
            <p className={cn('text-[11px] font-medium', activeChatOnline ? 'text-emerald-400' : 'text-fg-tertiary')}>
              {activeChatOnline ? '● Online' : 'Offline'}
            </p>
          ) : (
            <p className="text-[11px] text-fg-tertiary">{onlineUsers.length} online</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 md:px-5 space-y-3 scroll-smooth">
        {mensagensFiltradas.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-fg-disabled select-none">
            <span className="text-5xl mb-3 opacity-20">💬</span>
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs mt-1">Seja o primeiro a dizer algo!</p>
          </div>
        )}

        {mensagensFiltradas.map((msg, i) => {
          const showHeader = i === 0 || mensagensFiltradas[i - 1].remetente_id !== msg.remetente_id
          const isMe = msg.remetente_id === currentUser?.id
          const remetente = getRemetente(msg.remetente_id)

          return (
            <div key={msg.id} className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row', !showHeader && (isMe ? 'pr-0' : 'pl-0'))}>
              {/* Avatar - only on first of group, other side */}
              {!isMe && showHeader && (
                <Avatar nome={remetente.nome} size="sm" />
              )}
              {!isMe && !showHeader && <div className="w-8 shrink-0" />}

              <div className={cn('flex flex-col', isMe ? 'items-end' : 'items-start', 'max-w-[78%] md:max-w-[65%]')}>
                {showHeader && (
                  <span className={cn('text-[11px] font-semibold text-fg-tertiary mb-1', isMe ? 'mr-1' : 'ml-1')}>{remetente.nome}</span>
                )}
                <div className={cn(
                  'px-3.5 py-2.5 text-sm break-words leading-relaxed shadow-sm',
                  isMe
                    ? 'bg-violet-600 text-white rounded-2xl rounded-tr-sm'
                    : 'bg-[#141928] text-fg border border-border-subtle/80 rounded-2xl rounded-tl-sm'
                )}>
                  {msg.texto && <p style={{ whiteSpace: 'pre-wrap' }}>{msg.texto}</p>}
                  {msg.audio_base64 && (
                    <div className="my-1">
                      <audio src={msg.audio_base64} controls className="h-8 max-w-[200px] rounded" />
                      <p className="text-[10px] mt-1 opacity-60 flex items-center gap-1">🎤 Áudio</p>
                    </div>
                  )}
                  <span className={cn('text-[9px] opacity-40 float-right pt-1 ml-3 tabular-nums')}>
                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input bar */}
      <div className="px-3 py-3 md:px-4 md:py-4 bg-[#0a0d16] border-t border-border-subtle shrink-0">
        {isRecording ? (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-400">Gravando...</p>
              <p className="text-xs font-mono text-red-500/70">{formatTime(recordingTime)}</p>
            </div>
            <button onClick={cancelRecording} className="text-xs text-fg-tertiary hover:text-fg-secondary px-3 py-1.5 rounded-lg transition">Cancelar</button>
            <button onClick={stopRecording} className="bg-red-500 hover:bg-red-600 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all">
              Enviar
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 bg-[#111625] border border-border-subtle/80 rounded-2xl px-3 py-2 focus-within:border-brand-gold/40 transition-colors">
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent border-none text-sm text-fg placeholder-zinc-600 resize-none max-h-28 min-h-[40px] py-2 px-1 focus:outline-none focus:ring-0"
              rows={1}
              placeholder={activeChat === null ? 'Mensagem para a equipe...' : 'Mensagem direta...'}
              value={texto}
              onChange={e => {
                setTexto(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`
              }}
              onKeyDown={handleKeyDown}
            />
            <div className="flex gap-1 pb-1">
              <button
                onClick={startRecording}
                className="p-2.5 text-fg-tertiary hover:text-violet-400 hover:bg-muted active:bg-zinc-700 rounded-xl transition-all"
                title="Gravar áudio"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
              </button>
              <button
                onClick={handleSendText}
                disabled={!texto.trim()}
                className="bg-violet-600 hover:bg-violet-500 active:bg-violet-700 active:scale-95 disabled:bg-muted disabled:text-fg-disabled text-white p-2.5 rounded-xl transition-all shadow-lg disabled:shadow-none"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ── Layout wrapper ──────────────────────────────────────────
  // Mobile: ocupa toda a tela menos o header do dashboard e o bottom nav (≈56px + 64px)
  // Desktop: lado a lado dentro do container normal
  return (
    <div className={cn(
      'flex overflow-hidden bg-sidebar rounded-xl border border-border-subtle shadow-2xl',
      // Mobile: altura da viewport menos o bottom nav (64px) e padding do layout (24px top)
      'h-[calc(100vh-88px)]',
      // Overflow-x: tirar os paddings do layout pai para ocupar largura total no mobile
      '-mx-4 -my-6 sm:-mx-6'
    )}>
      {renderContactPanel()}
      {renderChatPanel()}
    </div>
  )
}
