'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresaId } from '@/lib/hooks/useEmpresaId'
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
  // 24/09/2026 — anexos (migration 086). `anexo_path` é o CAMINHO no bucket
  // privado `chat-anexos`, não uma URL: não dá para usar direto num src.
  // A URL assinada é pedida na hora de mostrar, logo abaixo.
  anexo_path: string | null
  anexo_tipo: string | null
  // 24/09/2026 — pendências (migration 087). Mensagem marcada como tarefa
  // fica aberta enquanto `resolvido_em` for nulo.
  pendente: boolean | null
  resolvido_em: string | null
  resolvido_por: string | null
  created_at: string
}

// ── prepararImagem ────────────────────────────────────────────
// Reduz a foto ANTES de subir. O Sr. Max fotografa boleto pelo celular e
// saem 3-4 MB; com 1600px no lado maior e JPEG 0.8 fica em ~300 KB, e o
// código de barras continua perfeitamente legível. Isso economiza o 4G
// dele, o espaço do plano e o tempo de abrir a conversa.
//
// O limite de 10 MB do bucket continua valendo como segunda trava, para
// o caso de alguém contornar a tela.
async function prepararImagem(file: File): Promise<Blob> {
  const LADO_MAX = 1600
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return await new Promise<Blob>(resolve => {
    canvas.toBlob(b => resolve(b ?? file), 'image/jpeg', 0.8)
  })
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
  const { empresaId } = useEmpresaId()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [equipe, setEquipe] = useState<Funcionario[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [mensagens, setMensagens] = useState<MensagemChat[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  // Mobile: null = mostra lista, qualquer valor = mostra chat
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  // Anexos: caminho no bucket → URL assinada. O bucket é privado, então a
  // URL tem validade e não pode ser guardada no banco.
  const [urlsAnexos, setUrlsAnexos] = useState<Record<string, string>>({})
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  // Filtro do cabeçalho: mostra só as pendências abertas da conversa.
  const [soPendencias, setSoPendencias] = useState(false)
  const { warning } = useToast()

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load data & realtime ────────────────────────────────────
  useEffect(() => {
    let mounted = true
    let room: ReturnType<typeof supabase.channel> | null = null
    let chatSub: ReturnType<typeof supabase.channel> | null = null

    async function loadInitialData() {
      // 🔴 FIX (24/09/2026): aqui havia `if (!empresaId) return`. A empresa só é
      // necessária para a LISTA DE CONTATOS; o histórico do chat não depende
      // dela. Com o guard no topo, enquanto o hook de empresa não resolvia,
      // nada carregava.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !mounted) return
      setCurrentUser(session.user)

      if (empresaId) {
        const { data: funcs } = await supabase.from('funcionarios').select('*').eq('empresa_id', empresaId).order('nome')
        if (funcs && mounted) setEquipe(funcs)
      }

      const { data: vwUsers } = await supabase.from('vw_usuarios_chat').select('*')
      if (vwUsers && mounted) setAllUsers(vwUsers)

      // 🔴 FIX (24/09/2026) — O BUG QUE DEIXOU O CHAT MUDO.
      // A consulta filtrava por `.eq('empresa_id', empresaId)`, e a tabela
      // `chat_interno` NÃO TEM essa coluna (id, remetente_id, destinatario_id,
      // texto, audio_base64, lido, created_at — confirmado no
      // information_schema em 24/09). Filtro em coluna inexistente faz o
      // PostgREST devolver erro; como a linha destruturava só o `data`, o erro
      // sumia, `msgs` vinha nulo e a lista nascia vazia. Toda vez.
      //
      // O efeito prático: em 23/09 o Sr. Max escreveu "Opa" às 17:31 e a Maiara
      // "Oi" às 17:33. As duas estão no banco. Nenhum dos dois viu a do outro —
      // quem tinha a página aberta via a mensagem chegar pelo realtime, e quem
      // abria depois não via nada, porque o histórico nunca carregava.
      //
      // A visibilidade de quem vê o quê é trabalho do RLS, não de um filtro no
      // cliente. E o `error` agora é lido: erro engolido foi o que fez isso
      // passar despercebido.
      const { data: msgs, error: errMsgs } = await supabase
        .from('chat_interno')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(150)
      if (errMsgs) console.error('[chat] histórico não carregou:', errMsgs.message)
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
          // Guarda contra duplicata: com o histórico voltando a carregar, uma
          // mensagem pode chegar pelo realtime e já estar na lista (recarga da
          // página no mesmo instante, ou dois mounts do efeito). Comparar por
          // id é barato e evita a mensagem aparecer duas vezes na tela.
          if (!mounted) return
          const nova = payload.new as MensagemChat
          setMensagens(prev => prev.some(m => m.id === nova.id) ? prev : [...prev, nova])
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
  }, [empresaId])


  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, activeChat])

  // ── URLs assinadas dos anexos ───────────────────────────────
  // Bucket privado não tem URL fixa: cada arquivo precisa de uma URL com
  // validade. Pedimos em LOTE (`createSignedUrls`) só para os caminhos que
  // ainda não temos — uma conversa com trinta fotos faria trinta chamadas
  // se fosse uma a uma.
  useEffect(() => {
    const faltando = Array.from(new Set(
      mensagens
        .map(m => m.anexo_path)
        .filter((p): p is string => !!p && !urlsAnexos[p])
    ))
    if (faltando.length === 0) return
    let ativo = true
    supabase.storage.from('chat-anexos').createSignedUrls(faltando, 3600)
      .then(({ data, error }) => {
        if (error) { console.error('[chat] anexos sem URL:', error.message); return }
        if (!ativo || !data) return
        const novas: Record<string, string> = {}
        data.forEach(d => { if (d.path && d.signedUrl) novas[d.path] = d.signedUrl })
        setUrlsAnexos(prev => ({ ...prev, ...novas }))
      })
    return () => { ativo = false }
  // `urlsAnexos` fora das dependências de propósito: ele é ESCRITO aqui, e
  // incluí-lo faria o efeito se chamar em laço.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagens])

  // ── Filter messages ─────────────────────────────────────────
  const mensagensDaConversa = mensagens.filter(m => {
    if (activeChat === null) return m.destinatario_id === null
    return (
      (m.remetente_id === currentUser?.id && m.destinatario_id === activeChat) ||
      (m.remetente_id === activeChat && m.destinatario_id === currentUser?.id)
    )
  })

  // Pendência ABERTA = marcada e ainda não resolvida. O contador do
  // cabeçalho usa isto, e é ele que responde ao "você já resolveu?" sem
  // ninguém precisar rolar a conversa.
  const pendenciasAbertas = mensagensDaConversa.filter(m => m.pendente && !m.resolvido_em)
  const mensagensFiltradas = soPendencias ? pendenciasAbertas : mensagensDaConversa

  // ── Marcar / desmarcar pendência ────────────────────────────
  // Três estados, um botão: normal → pendente → resolvida → normal.
  // A atualização é otimista (muda na tela na hora) e desfeita se o banco
  // recusar — o erro aparece, não some.
  const alternarPendencia = async (msg: MensagemChat) => {
    if (!currentUser) return
    const aberta = !!msg.pendente && !msg.resolvido_em
    const resolvida = !!msg.pendente && !!msg.resolvido_em

    const novo = aberta
      ? { pendente: true,  resolvido_em: new Date().toISOString(), resolvido_por: currentUser.id }
      : resolvida
        ? { pendente: false, resolvido_em: null, resolvido_por: null }
        : { pendente: true,  resolvido_em: null, resolvido_por: null }

    const anterior = mensagens
    setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, ...novo } as MensagemChat : m))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('chat_interno') as any).update(novo).eq('id', msg.id)
    if (error) {
      setMensagens(anterior)
      warning(`Não consegui marcar: ${error.message}`)
    }
  }

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
    const { error } = await (supabase.from('chat_interno') as any).insert(msg)
    if (error) { console.error('Erro ao enviar mensagem:', error.message); return }
    sendPush(activeChat, textoMsg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText() }
  }

  // ── Anexo (foto ou PDF) ─────────────────────────────────────
  // Sobe o arquivo para o bucket privado e grava só o caminho na mensagem.
  // O caminho é `<user_id>/<timestamp>-<aleatório>.<ext>`: a política do
  // Storage exige que a primeira pasta seja o id de quem está logado, então
  // ninguém grava na pasta de outro.
  const handleAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reenviar o MESMO arquivo em seguida
    if (!file || !currentUser) return

    const ehImagem = file.type.startsWith('image/')
    const ehPdf = file.type === 'application/pdf'
    if (!ehImagem && !ehPdf) {
      warning('Por enquanto dá para enviar imagem (JPG, PNG, WEBP) ou PDF.')
      return
    }

    setEnviandoAnexo(true)
    try {
      const corpo = ehImagem ? await prepararImagem(file) : file
      const tipo = ehImagem ? 'image/jpeg' : 'application/pdf'
      const ext = ehImagem ? 'jpg' : 'pdf'
      const path = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: errUp } = await supabase.storage
        .from('chat-anexos')
        .upload(path, corpo, { contentType: tipo, upsert: false })
      if (errUp) throw new Error(errUp.message)

      // A legenda que estiver digitada vai junto, como no WhatsApp.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: errIns } = await (supabase.from('chat_interno') as any).insert({
        remetente_id: currentUser.id,
        destinatario_id: activeChat,
        texto: texto.trim() || null,
        audio_base64: null,
        anexo_path: path,
        anexo_tipo: tipo,
      })
      if (errIns) throw new Error(errIns.message)

      setTexto('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      sendPush(activeChat, ehImagem ? '📷 Foto' : '📄 Documento')
    } catch (err) {
      // Erro visível de propósito. Anexo que "some" sem avisar é pior que
      // anexo que não vai — foi assim que o histórico do chat ficou mudo
      // por semanas.
      const msg = err instanceof Error ? err.message : 'erro desconhecido'
      warning(`Não consegui enviar o anexo: ${msg}`)
    } finally {
      setEnviandoAnexo(false)
    }
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
            const { error } = await (supabase.from('chat_interno') as any).insert({
              remetente_id: currentUser.id,
              destinatario_id: activeChat,
              texto: null,
              audio_base64: reader.result as string,
            })
            if (!error) sendPush(activeChat, '🎤 Mensagem de voz')
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

  const getRemetente = (id: string) => id === currentUser?.id ? { nome: currentUser?.user_metadata?.nome || currentUser?.email?.split('@')[0] || 'Você', id } : (equipe.find(f => f.id === id) || allUsers.find(u => u.id === id) || { nome: 'Desconhecido', id })

  // ── Chat name helper ────────────────────────────────────────
  const activeChatName = activeChat === null
    ? 'Geral da Equipe'
    : equipe.find(u => u.id === activeChat)?.nome ?? '...'

  const activeChatOnline = activeChat !== null && onlineUsers.includes(activeChat)

  // ── Quem está online AGORA, pelo nome ───────────────────────
  // 24/09/2026. A presença sempre existiu (canal `equipe:sala-principal`,
  // global — todo mundo entra), mas a bolinha verde só era desenhada na
  // lista de contatos, e essa lista vem de `funcionarios` filtrada por
  // empresa. O Sr. Max nunca aparecia na lista da Maiara nem ela na dele:
  // o sistema sabia que o outro estava online e não tinha onde mostrar.
  //
  // `allUsers` vem de `vw_usuarios_chat`, que é carregada SEM filtro de
  // empresa — é ela que atravessa. Cruzando com a presença, dá para dizer
  // quem está do outro lado, inclusive no canal Geral.
  const nomesOnline = onlineUsers
    .filter(id => id !== currentUser?.id)
    .map(id => {
      const u = equipe.find(f => f.id === id) ?? allUsers.find(a => a.id === id)
      return (u?.nome as string | undefined)?.split(' ')[0]
    })
    .filter((n): n is string => !!n)

  // Uma linha curta: "Max online" / "Max, Carlos online" / "+2".
  // Nome próprio diz mais que um número — "2 online" não responde à
  // pergunta que a pessoa realmente tem, que é "ele está aí agora?".
  const resumoOnline = nomesOnline.length === 0
    ? 'Ninguém mais online agora'
    : nomesOnline.length <= 2
      ? `● ${nomesOnline.join(', ')} online`
      : `● ${nomesOnline.slice(0, 2).join(', ')} +${nomesOnline.length - 2} online`

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
        <p className={cn('text-[11px] truncate', nomesOnline.length > 0 ? 'text-emerald-400' : 'text-fg-tertiary')}>
          {nomesOnline.length > 0 ? resumoOnline : 'Só você online agora'}
        </p>
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
          subtitle={nomesOnline.length > 0 ? resumoOnline.replace('● ', '') : 'Só você por aqui'}
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
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl bg-brand-gold-soft border border-brand-gold/30 flex items-center justify-center text-base">🌍</div>
            {/* Bolinha no canal Geral quando tem alguém do outro lado */}
            {nomesOnline.length > 0 && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0a0d16]" />
            )}
          </div>
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
            <p className={cn('text-[11px] font-medium truncate', nomesOnline.length > 0 ? 'text-emerald-400' : 'text-fg-tertiary')}>
              {resumoOnline}
            </p>
          )}
        </div>

        {/* Filtro de pendências — é a razão de existir deste chat em vez
            do WhatsApp: o que está em aberto fica a um toque, em vez de
            rolar para cima e sumir. */}
        <button
          onClick={() => setSoPendencias(v => !v)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0',
            soPendencias
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : pendenciasAbertas.length > 0
                ? 'text-amber-400/80 hover:bg-muted border border-transparent'
                : 'text-fg-disabled hover:bg-muted border border-transparent'
          )}
          title={soPendencias ? 'Mostrar a conversa inteira' : 'Mostrar só o que está em aberto'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={pendenciasAbertas.length > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          {pendenciasAbertas.length > 0 ? pendenciasAbertas.length : ''}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 md:px-5 space-y-3 scroll-smooth">
        {mensagensFiltradas.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-fg-disabled select-none">
            {soPendencias ? (
              <>
                <span className="text-5xl mb-3 opacity-20">✅</span>
                <p className="text-sm">Nada em aberto por aqui</p>
                <p className="text-xs mt-1">Toque em ⚑ numa mensagem para marcar como pendência.</p>
              </>
            ) : (
              <>
                <span className="text-5xl mb-3 opacity-20">💬</span>
                <p className="text-sm">Nenhuma mensagem ainda</p>
                <p className="text-xs mt-1">Seja o primeiro a dizer algo!</p>
              </>
            )}
          </div>
        )}

        {mensagensFiltradas.map((msg, i) => {
          const showHeader = i === 0 || mensagensFiltradas[i - 1].remetente_id !== msg.remetente_id
          const isMe = msg.remetente_id === currentUser?.id
          const remetente = getRemetente(msg.remetente_id)

          return (
            <div key={msg.id} className={cn('group flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row', !showHeader && (isMe ? 'pr-0' : 'pl-0'))}>
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
                    : 'bg-[#141928] text-fg border border-border-subtle/80 rounded-2xl rounded-tl-sm',
                  // Pendência aberta ganha uma faixa âmbar na lateral. É a
                  // marca que faz o combinado não se confundir com conversa.
                  msg.pendente && !msg.resolvido_em && 'border-l-4 border-l-amber-400',
                  msg.pendente && msg.resolvido_em && 'opacity-70',
                )}>
                  {msg.texto && <p style={{ whiteSpace: 'pre-wrap' }}>{msg.texto}</p>}
                  {msg.anexo_path && (
                    <div className="my-1">
                      {msg.anexo_tipo?.startsWith('image/') ? (
                        urlsAnexos[msg.anexo_path] ? (
                          <a href={urlsAnexos[msg.anexo_path]} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={urlsAnexos[msg.anexo_path]}
                              alt="Anexo"
                              className="rounded-xl max-w-[240px] max-h-[320px] object-cover cursor-zoom-in"
                            />
                          </a>
                        ) : (
                          // Enquanto a URL assinada não chega. Mantém a altura
                          // para a conversa não pular quando a imagem entra.
                          <div className="w-[240px] h-[160px] rounded-xl bg-muted/40 animate-pulse" />
                        )
                      ) : (
                        <a
                          href={urlsAnexos[msg.anexo_path] ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted transition"
                        >
                          <span className="text-lg">📄</span>
                          <span className="text-xs font-semibold underline">
                            {urlsAnexos[msg.anexo_path] ? 'Abrir documento' : 'Carregando...'}
                          </span>
                        </a>
                      )}
                    </div>
                  )}
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

                {/* Botão de pendência. Fica FORA da bolha, discreto, e só
                    ganha cor quando a mensagem vira tarefa. Três estados
                    num toque só: marcar → resolver → desmarcar. */}
                <button
                  onClick={() => alternarPendencia(msg)}
                  className={cn(
                    'mt-1 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg transition-colors',
                    msg.pendente && !msg.resolvido_em
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : msg.pendente && msg.resolvido_em
                        ? 'text-emerald-400/80 hover:bg-emerald-500/10'
                        : 'text-fg-disabled opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted md:opacity-0 max-md:opacity-60',
                  )}
                  title={
                    msg.pendente && !msg.resolvido_em ? 'Marcar como resolvida'
                    : msg.pendente ? 'Tirar a marcação'
                    : 'Marcar como pendência'
                  }
                >
                  {msg.pendente && !msg.resolvido_em ? '⚑ pendente'
                    : msg.pendente ? '✓ resolvida'
                    : '⚑ marcar'}
                </button>
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleAnexo}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={enviandoAnexo}
                className="p-2.5 text-fg-tertiary hover:text-violet-400 hover:bg-muted active:bg-zinc-700 rounded-xl transition-all disabled:opacity-40"
                title="Enviar foto ou PDF"
              >
                {enviandoAnexo ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                )}
              </button>
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
