'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

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
  destinatario_id: string | null // null = Geral
  texto: string | null
  audio_base64: string | null
  created_at: string
}

export default function ComunicacaoClient() {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [equipe, setEquipe] = useState<Funcionario[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [mensagens, setMensagens] = useState<MensagemChat[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null) // null = Geral da Equipe, ou ID do usuário
  const [texto, setTexto] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  // Referências
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Carrega Usuário, Equipe e Mensagens Iniciais
  useEffect(() => {
    async function loadInitialData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUser(session.user)

      // Carregar Equipe (incluindo a si mesmo, ou você pode remover a si mesmo da listagem)
      const { data: funcs } = await supabase.from('funcionarios').select('*').order('nome')
      if (funcs) {
        setEquipe(funcs)
      }

      // Carregar Mensagens Historico (Limit 150)
      const { data: msgs } = await supabase
        .from('chat_interno')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(150)
      if (msgs) {
        setMensagens(msgs)
      }

      // Setup Presence para ver quem está online na 'equipe'
      const room = supabase.channel('room:equipe')

      room
        .on('presence', { event: 'sync' }, () => {
          const newState = room.presenceState()
          let onlines: string[] = []
          for (const key in newState) {
            // @ts-ignore
            newState[key].forEach(presence => {
              if (presence.user_id) onlines.push(presence.user_id)
            })
          }
          setOnlineUsers(Array.from(new Set(onlines)))
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await room.track({
              user_id: session.user.id,
              online_at: new Date().toISOString(),
            })
          }
        })

      // Setup Realtime para novas mensagens
      const chatSub = supabase.channel('chat_db_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_interno' }, (payload) => {
          const novaMsg = payload.new as MensagemChat
          setMensagens(prev => [...prev, novaMsg])
        })
        .subscribe()

      return () => {
        supabase.removeChannel(room)
        supabase.removeChannel(chatSub)
      }
    }
    loadInitialData()
  }, [])

  // Auto-scroll sempre que chegar mensagem nova
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, activeChat])

  // Filtragem local
  const mensagensFiltradas = mensagens.filter(m => {
    if (activeChat === null) {
      // Chat global
      return m.destinatario_id === null
    } else {
      // DM (Direct Message) com activeChat
      // Ou eu enviei pra ele, ou ele enviou pra mim
      return (
        (m.remetente_id === currentUser?.id && m.destinatario_id === activeChat) ||
        (m.remetente_id === activeChat && m.destinatario_id === currentUser?.id)
      )
    }
  })

  // Enviar Mensagem de Texto
  const handleSendText = async () => {
    if (!texto.trim() || !currentUser) return
    const msg = {
      remetente_id: currentUser.id,
      destinatario_id: activeChat,
      texto: texto.trim(),
      audio_base64: null,
    }
    setTexto('')
    await supabase.from('chat_interno').insert(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  // ÁUDIO RECORDING
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        
        // Conversão para string Base64 Data URL
        const reader = new FileReader()
        reader.readAsDataURL(audioBlob)
        reader.onloadend = async () => {
          const base64data = reader.result as string
          
          // Enviar via Supabase
          if (currentUser) {
            await supabase.from('chat_interno').insert({
              remetente_id: currentUser.id,
              destinatario_id: activeChat,
              texto: null,
              audio_base64: base64data
            })
          }
        }

        // Para todas as tracks do microfone 
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Erro de permissão no áudio: ', err)
      alert("Precisamos de permissão para usar seu microfone.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const cancelRecording = () => {
     if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      // Just stop, don't send
      mediaRecorderRef.current.onstop = () => {
         mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const formatTime = (seconds: number) => {
    const pM = Math.floor(seconds / 60).toString().padStart(2, '0')
    const pS = (seconds % 60).toString().padStart(2, '0')
    return `${pM}:${pS}`
  }

  // Obter detalhes de quem enviou usando os dados carregados de funcionarios
  const getRemetente = (id: string) => {
    const f = equipe.find(f => f.id === id)
    return f || { nome: 'Desconhecido', id }
  }


  return (
    <div className="flex h-[calc(100vh-88px)] sm:h-[calc(100vh-100px)] -mx-4 md:-mx-6 -mt-4 md:-mt-6 overflow-hidden">
      
      {/* ── Sidebar de Usuários ──────────────────────── */}
      <div className="w-80 shrink-0 border-r border-zinc-800 flex flex-col bg-[#05070a]">
        <div className="p-4 border-b border-zinc-800 bg-[#0a0d16]">
          <h2 className="text-sm font-semibold text-zinc-100">
            Chat <span className="text-violet-400 font-normal">Interno</span> 💬
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Comunicação e áudio com a equipe.</p>
        </div>

        <div className="flex-1 overflow-y-auto w-full">
          
          <div className="mt-3 px-3 mb-2">
            <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">Canais</p>
          </div>
          
          {/* Geral */}
          <button
            onClick={() => setActiveChat(null)}
            className={cn(
              "w-full text-left px-4 py-3 border-b border-zinc-800/50 transition-all flex items-center gap-3",
              activeChat === null ? "bg-zinc-800/80 border-l-4 border-l-violet-500" : "hover:bg-zinc-800/30 border-l-4 border-l-transparent"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex flex-shrink-0 items-center justify-center relative shadow-[0_0_15px_rgba(139,92,246,0.1)]">
              <span className="text-violet-400 font-bold text-lg">🌍</span>
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-sm font-bold text-zinc-200">Geral da Equipe</p>
               <p className="text-[10px] text-zinc-500 truncate">Avisos e mensagens para todos</p>
            </div>
          </button>

          <div className="mt-4 px-3 mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">Equipe ({equipe.length})</p>
          </div>
          
          {equipe.filter(f => f.id !== currentUser?.id).map(user => {
            const isOnline = onlineUsers.includes(user.id)
            const isActive = activeChat === user.id
            return (
              <button
                key={user.id}
                onClick={() => setActiveChat(user.id)}
                className={cn(
                  "w-full text-left px-4 py-2.5 transition-all flex items-center gap-3",
                  isActive ? "bg-zinc-800/60 border-l-2 border-l-violet-400" : "hover:bg-zinc-800/20 border-l-2 border-l-transparent"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex flex-shrink-0 items-center justify-center relative">
                  <span className="text-zinc-400 font-bold text-xs uppercase">{user.nome[0]}</span>
                  {isOnline && (
                     <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#05070a]"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-300 truncate">{user.nome}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{user.cargo || 'Membro'}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Painel Principal de Chat ─────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#080b14] relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
        
        {/* Header do Chat */}
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-[#0a0d16]/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
             {activeChat === null ? (
               <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                 <span className="text-violet-400 font-bold text-lg">🌍</span>
               </div>
             ) : (
               <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center relative">
                  <span className="text-zinc-300 font-bold text-sm uppercase">
                    {equipe.find(u => u.id === activeChat)?.nome[0]}
                  </span>
               </div>
             )}
            <div>
              <p className="text-[15px] font-bold text-zinc-100">
                 {activeChat === null ? 'Geral da Equipe' : equipe.find(u => u.id === activeChat)?.nome}
              </p>
              {activeChat !== null && (
                <p className="text-xs text-green-400 font-medium">
                  {onlineUsers.includes(activeChat) ? '● Online' : <span className="text-zinc-500">Offline</span>}
                </p>
              )}
              {activeChat === null && (
                 <p className="text-xs text-zinc-500 font-medium">{onlineUsers.length} usuários online</p>
              )}
            </div>
          </div>
        </div>

        {/* Mensagens do Chat */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth space-y-4">
          {mensagensFiltradas.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <span className="text-4xl mb-3 opacity-30">💬</span>
                <p className="text-sm">Nenhuma mensagem ainda.</p>
                <p className="text-xs mt-1 text-zinc-600">Envie primeira mensagem para quebrar o gelo!</p>
             </div>
          )}

          {mensagensFiltradas.map((msg, i) => {
            // Verificar se deve agrupar (caso remetente seja o mesmo do anterior, oculta nome/bolha repetitiva)
            const showHeader = i === 0 || mensagensFiltradas[i - 1].remetente_id !== msg.remetente_id;
            const isMe = msg.remetente_id === currentUser?.id;
            const remetente = getRemetente(msg.remetente_id)

            return (
              <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start", !showHeader && 'mt-1')}>
                 {showHeader && !isMe && (
                   <span className="text-[11px] font-bold text-zinc-500 ml-1 mb-1">{remetente.nome}</span>
                 )}
                 <div className={cn(
                    "max-w-[75%] md:max-w-[60%] px-4 py-2.5 shadow-sm text-sm break-words relative group",
                    isMe 
                      ? "bg-violet-600/90 text-white rounded-2xl rounded-tr-sm" 
                      : "bg-[#181d2a] text-zinc-200 border border-zinc-800 rounded-2xl rounded-tl-sm"
                 )}>
                    {msg.texto && <p style={{ whiteSpace: 'pre-wrap' }}>{msg.texto}</p>}
                    
                    {/* Caso tenha áudio em base64 */}
                    {msg.audio_base64 && (
                      <div className="my-1 w-full max-w-xs">
                        {/* Audio Element Customizado Simples */}
                        <audio src={msg.audio_base64} controls className="h-8 max-w-full [&::-webkit-media-controls-panel]:bg-zinc-800/80 [&::-webkit-media-controls-current-time-display]:text-white [&::-webkit-media-controls-time-remaining-display]:text-white outline-none" />
                        <p className="text-[10px] mt-1 opacity-70 flex items-center gap-1">🎤 Mensagem de voz</p>
                      </div>
                    )}

                    <span className="text-[9px] opacity-40 float-right pt-2 ml-3">
                       {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                 </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Bar */}
        <div className="px-4 py-4 md:px-6 bg-[#0a0d16] border-t border-zinc-800 relative z-10 flex-shrink-0">
          
          {isRecording ? (
             <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                <div className="flex-1">
                   <p className="text-sm font-bold text-red-500 tracking-wide">Gravando Áudio...</p>
                   <p className="text-xs text-red-400 font-mono">{formatTime(recordingTime)}</p>
                </div>
                <button onClick={cancelRecording} className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 transition">
                   Cancelar
                </button>
                <button onClick={stopRecording} className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition hover:scale-105 active:scale-95">
                   Enviar <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
             </div>
          ) : (
            <div className="flex items-end gap-2 bg-[#121623] border border-zinc-800/80 rounded-2xl p-2 pb-2 focus-within:border-violet-500/50 shadow-inner">
               <textarea
                 className="flex-1 bg-transparent border-none text-sm text-zinc-100 placeholder-zinc-500 resize-none max-h-32 min-h-[44px] py-3 px-3 focus:ring-0"
                 rows={1}
                 placeholder={activeChat === null ? "Mensagem para a Equipe toda..." : "Mensagem direta..."}
                 value={texto}
                 onChange={e => {
                    setTexto(e.target.value);
                    e.target.style.height = 'auto'; 
                    e.target.style.height = `${e.target.scrollHeight}px`;
                 }}
                 onKeyDown={handleKeyDown}
               />
               
               <div className="flex gap-1.5 pb-1 pr-1">
                 {/* Voice Mic Button */}
                 <button 
                    onClick={startRecording}
                    className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition duration-200"
                    title="Enviar Mensagem de Voz"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                 </button>

                 <button 
                  onClick={handleSendText}
                  disabled={!texto.trim()}
                  className="bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white p-3 rounded-xl shadow-lg transition-all disabled:shadow-none duration-200"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
