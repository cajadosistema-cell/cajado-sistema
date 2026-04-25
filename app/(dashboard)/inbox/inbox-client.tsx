'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import {
  useInbox, useConversaDetalhe,
  enviarMensagem, enviarNota, toggleBot,
  humanouAssumiu, reativarBot, mudarEtiqueta, mudarSetor,
  loginInbox,
  type Conversa,
} from '@/lib/hooks/useInbox'

import ConfiguracoesBotClient from '../configuracoes/bot/bot-client'

// ── Tipos locais ───────────────────────────────────────────────

interface ClienteCajado {
  id: string
  nome: string
  telefone: string
  total_compras: number
  total_gasto: number
  ultima_compra: string | null
}

interface VendaCajado {
  id: string
  numero: string
  status: string
  status_pagamento: string
  total: number
  total_a_receber: number
  data_abertura: string
}

// ── Utilitários ────────────────────────────────────────────────

const etiquetaColors: Record<string, string> = {
  novo:       'bg-blue-500/15 text-blue-400',
  proposta:   'bg-amber-500/15 text-amber-400',
  cliente:    'bg-emerald-500/15 text-emerald-400',
  retomar:    'bg-purple-500/15 text-purple-400',
  perdido:    'bg-surface-hover text-fg-secondary',
  aguardando: 'bg-yellow-500/15 text-yellow-400',
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^55/, '')
}

// ── Ícones SVG inline ──────────────────────────────────────────

function IconSend({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  )
}

function IconNote({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function IconDoubleCheck({ className, blue }: { className?: string; blue?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={cn('inline-block', blue ? 'text-sky-400' : 'text-fg-tertiary', className)}>
      <polyline points="20 6 9 17 4 12"/>
      <polyline points="16 6 9 13"/>
    </svg>
  )
}

function IconBack({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 18-6-6 6-6"/>
    </svg>
  )
}

// ── Componentes menores ────────────────────────────────────────

function ConversaItem({
  conv,
  ativa,
  onClick,
}: {
  conv: Conversa
  ativa: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3.5 border-b border-border-subtle/60 transition-colors active:bg-surface-hover/40',
        ativa ? 'bg-muted' : 'hover:bg-surface-hover/50'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar 48px — tamanho WhatsApp */}
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-base font-bold ring-2',
          conv.botOn !== false
            ? 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30'
            : 'bg-amber-500/20 text-amber-400 ring-amber-500/30'
        )}>
          {conv.nome?.[0]?.toUpperCase() || '#'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-semibold text-fg truncate">{conv.nome}</p>
            <span className="text-[10px] text-fg-disabled shrink-0">{conv.ultimoHorario}</span>
          </div>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <p className="text-xs text-fg-tertiary truncate flex-1">{conv.ultimaMensagem}</p>
            {conv.unread > 0 ? (
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center shrink-0">
                {conv.unread > 9 ? '9+' : conv.unread}
              </span>
            ) : null}
          </div>
          {/* Etiqueta + status bot */}
          <div className="flex items-center gap-1.5 mt-1">
            {conv.etiqueta && (
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide', etiquetaColors[conv.etiqueta] || 'bg-surface-hover text-fg-secondary')}>
                {conv.etiqueta}
              </span>
            )}
            {conv.setor && (
              <span className="text-[9px] text-fg-disabled">{conv.setor}</span>
            )}
            {!conv.botOn && (
              <span className="text-[9px] text-amber-400 font-semibold">● humano</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function MensagemBubble({ msg }: { msg: { id: string; tipo: string; texto: string; timestamp: string; transcricao?: string } }) {
  const isEnviada = msg.tipo === 'enviada' || msg.tipo === 'bot'
  const isInterna = msg.tipo === 'interna'
  const isAudio = msg.texto.toLowerCase().includes('[áudio]') || msg.texto.toLowerCase().includes('audio') || msg.tipo === 'audio'
  
  const transcricaoUI = msg.transcricao || (isAudio && !isEnviada ? "Transcrevendo áudio..." : null)

  return (
    <div className={cn('flex mb-1.5', isEnviada ? 'justify-end' : isInterna ? 'justify-center' : 'justify-start')}>
      <div
        className={cn(
          // Mobile: 85vw de largura máxima; Desktop: 70%
          'max-w-[85vw] md:max-w-[70%] px-3 py-2 rounded-xl text-sm',
          isInterna
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300 italic text-xs max-w-full w-full text-center rounded-lg'
            : isEnviada
            ? 'bg-surface-hover text-fg rounded-br-sm'
            : 'bg-muted text-fg rounded-bl-sm'
        )}
      >
        {isInterna && <span className="text-amber-500 mr-1">📝</span>}
        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.texto}</span>
        
        {/* Bloco de Transcrição de Áudio */}
        {transcricaoUI && (
          <div className="mt-2 text-xs bg-page/50 p-2 rounded border border-border-subtle/50">
            <p className="text-[10px] text-fg-tertiary font-bold mb-0.5">✨ Transcrição de Áudio</p>
            <p className="text-fg-secondary italic">"{transcricaoUI}"</p>
          </div>
        )}

        {/* Horário + checkmarks */}
        <div className={cn('flex items-center gap-1 mt-1', isEnviada ? 'justify-end' : isInterna ? 'justify-center' : 'justify-start')}>
          <span className="text-[10px] opacity-50">
            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isEnviada && !isInterna && (
            // ✓✓ azul para mensagens entregues (quando tivermos status real, passaríamos lida=true)
            <span className="text-[10px] text-fg-tertiary leading-none">✓✓</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Painel CRM integrado (Inbox → CRM Cajado) ─────────────────

const STATUS_CONFIG_CRM: Record<string, { label: string; color: string; bg: string }> = {
  novo:          { label: 'Novo',          color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  proposta:      { label: 'Proposta',      color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  retomar:       { label: 'Retomar',       color: 'text-purple-400',  bg: 'bg-purple-500/10' },
  cliente_ativo: { label: 'Cliente Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  perdido:       { label: 'Perdido',       color: 'text-fg-tertiary',    bg: 'bg-muted' },
}
const STATUS_PIPELINE = ['novo', 'proposta', 'retomar', 'cliente_ativo', 'perdido'] as const

function PainelCRM({ numero, nome }: { numero: string; nome?: string }) {
  const supabase = createClient()
  const [lead, setLead] = useState<any>(null)
  const [atividades, setAtividades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)
  const [novaAtiv, setNovaAtiv] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [novoNome, setNovoNome] = useState(nome || '')

  const telefone = normalizePhone(numero)

  const buscarLead = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*')
      .ilike('telefone', `%${telefone}%`)
      .limit(1)
      .single()
    setLead(data || null)

    if (data) {
      const { data: ativs } = await (supabase.from('atividades') as any)
        .select('*')
        .eq('lead_id', (data as any).id)
        .order('realizado_em', { ascending: false })
        .limit(5)
      setAtividades(ativs || [])
    }
    setLoading(false)
  }

  useEffect(() => { if (numero) buscarLead() }, [numero])

  const mudarStatus = async (status: string) => {
    if (!lead) return
    await (supabase.from('leads') as any).update({ status, ultimo_contato: new Date().toISOString() }).eq('id', (lead as any).id)
    setLead((l: any) => ({ ...l, status }))
  }

  const registrarAtividade = async () => {
    if (!lead || !novaAtiv.trim()) return
    setSalvando(true)
    const { data: nova } = await (supabase.from('atividades') as any).insert({
      lead_id: (lead as any).id,
      tipo: 'mensagem',
      descricao: novaAtiv.trim(),
      realizado_em: new Date().toISOString(),
    }).select().single()
    if (nova) setAtividades(prev => [nova, ...prev])
    setNovaAtiv('')
    setSalvando(false)
  }

  const criarLead = async () => {
    if (!novoNome.trim()) return
    setSalvando(true)
    const { data: novo } = await (supabase.from('leads') as any).insert({
      nome: novoNome.trim(),
      telefone: telefone,
      origem: 'whatsapp',
      status: 'novo',
      ultimo_contato: new Date().toISOString(),
    }).select().single()
    if (novo) { setLead(novo); setCriando(false) }
    setSalvando(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <p className="text-xs text-fg-disabled animate-pulse">Buscando no CRM...</p>
    </div>
  )

  if (!lead && !criando) return (
    <div className="p-4 space-y-3">
      <div className="bg-muted/40 border border-border-subtle/50 rounded-xl p-4 text-center space-y-2">
        <p className="text-2xl">🔍</p>
        <p className="text-sm font-medium text-fg-secondary">Não encontrado no CRM</p>
        <p className="text-xs text-fg-disabled font-mono">{telefone}</p>
        <button
          onClick={() => { setNovoNome(nome || ''); setCriando(true) }}
          className="w-full mt-2 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
        >
          + Adicionar ao CRM
        </button>
      </div>
    </div>
  )

  if (criando) return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-fg-secondary font-semibold">Novo lead via WhatsApp</p>
      <input
        className="input w-full text-sm"
        placeholder="Nome do contato *"
        value={novoNome}
        onChange={e => setNovoNome(e.target.value)}
      />
      <input className="input w-full text-sm" value={telefone} disabled />
      <div className="flex gap-2">
        <button onClick={() => setCriando(false)} className="btn-secondary text-xs flex-1">Cancelar</button>
        <button onClick={criarLead} disabled={salvando || !novoNome.trim()} className="btn-primary text-xs flex-1">
          {salvando ? 'Criando...' : 'Criar Lead'}
        </button>
      </div>
    </div>
  )

  const cfg = STATUS_CONFIG_CRM[lead.status] || STATUS_CONFIG_CRM['novo']
  const followupAtrasado = lead.proximo_followup && new Date(lead.proximo_followup) < new Date()

  return (
    <div className="p-4 space-y-4">
      {/* Identidade CRM */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <span className="text-amber-400 font-bold text-sm">{lead.nome?.[0] || '#'}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg truncate">{lead.nome}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Trocar status no funil diretamente do inbox */}
      <div>
        <p className="text-[10px] text-fg-disabled uppercase tracking-widest mb-1.5">Mover no funil</p>
        <div className="flex flex-wrap gap-1">
          {STATUS_PIPELINE.map(s => (
            <button key={s} onClick={() => mudarStatus(s)}
              className={`text-[10px] px-2 py-1 rounded-full border font-medium transition-all ${
                lead.status === s
                  ? `${STATUS_CONFIG_CRM[s].bg} ${STATUS_CONFIG_CRM[s].color} border-current`
                  : 'bg-muted/50 text-fg-tertiary border-border-subtle hover:border-zinc-500'
              }`}>
              {STATUS_CONFIG_CRM[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/40 rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-amber-400">
            {lead.valor_estimado ? formatCurrency(lead.valor_estimado) : '—'}
          </p>
          <p className="text-[10px] text-fg-disabled">pipeline</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-fg-secondary">{lead.origem || '—'}</p>
          <p className="text-[10px] text-fg-disabled">origem</p>
        </div>
      </div>

      {/* Follow-up */}
      {lead.proximo_followup && (
        <div className={`rounded-lg p-2.5 border text-xs ${followupAtrasado ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-muted/40 border-border-subtle text-fg-secondary'}`}>
          📅 {followupAtrasado ? '⚠ Atrasado! ' : 'Follow-up: '}
          {new Date(lead.proximo_followup).toLocaleDateString('pt-BR')}
        </div>
      )}

      {/* Notas do lead */}
      {lead.notas && (
        <div className="bg-muted/30 border border-border-subtle/50 rounded-lg p-2.5">
          <p className="text-[10px] text-fg-tertiary mb-1">Notas</p>
          <p className="text-xs text-fg-secondary leading-relaxed">{lead.notas}</p>
        </div>
      )}

      {/* Registrar atividade rápida */}
      <div className="space-y-2">
        <p className="text-[10px] text-fg-tertiary uppercase tracking-widest">Registrar no CRM</p>
        <textarea
          className="input w-full text-xs resize-none bg-page"
          rows={2}
          placeholder="Ex: Enviou proposta, confirmou reunião..."
          value={novaAtiv}
          onChange={e => setNovaAtiv(e.target.value)}
        />
        <button onClick={registrarAtividade} disabled={salvando || !novaAtiv.trim()}
          className="w-full py-1.5 rounded-lg bg-muted hover:bg-surface-hover border border-border-subtle text-xs text-fg-secondary font-medium transition-colors disabled:opacity-40">
          {salvando ? 'Salvando...' : '+ Registrar atividade'}
        </button>
      </div>

      {/* Histórico rápido */}
      {atividades.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-fg-disabled uppercase tracking-widest">Histórico ({atividades.length})</p>
          {atividades.map((a: any) => (
            <div key={a.id} className="bg-muted/30 rounded-lg px-3 py-2">
              <p className="text-xs text-fg-secondary">{a.descricao}</p>
              <p className="text-[10px] text-zinc-700 mt-0.5">
                {new Date(a.realizado_em).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Link para o CRM completo */}
      <a href="/cajado" className="block text-center text-[10px] text-fg-disabled hover:text-amber-400 transition-colors pt-1">
        Ver perfil completo no CRM →
      </a>
    </div>
  )
}

// ── Snippets / Respostas Rápidas ───────────────────────────────
const SNIPPETS = [
  { atalho: '/pix', titulo: 'Chave PIX', texto: 'Nossa chave PIX (CNPJ) é: 12.345.678/0001-90. Empresa Cajado Soluções. Assim que transferir, por favor, me mande o comprovante aqui.' },
  { atalho: '/bomdia', titulo: 'Bom dia', texto: 'Bom dia! Meu nome é Mário, como posso ajudar com a documentação do seu veículo hoje?' },
  { atalho: '/vistoria', titulo: 'Docs Vistoria', texto: 'Para a vistoria, precisamos de: CNH do proprietário, CRLV atual e Comprovante de Residência. O documento original deve ser levado no momento.' },
  { atalho: '/endereco', titulo: 'Nosso Endereço', texto: 'Estamos localizados na Avenida Principal, 1000 - Centro. Funcionamos de seg a sex das 8h às 18h.' }
]

export default function InboxClient() {
  const [numeroAtivo, setNumeroAtivo] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [nota, setNota] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showSnippets, setShowSnippets] = useState(false)
  const [prevUnread, setPrevUnread] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { conversas, loading, refetch } = useInbox()
  const { conversa, refetch: refetchConversa } = useConversaDetalhe(!showConfig ? numeroAtivo : null)

  const totalUnread = conversas.reduce((a, c) => a + (c.unread || 0), 0)

  // ── Auto-grow textarea ─────────────────────────────────────
  const autoGrow = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const newHeight = Math.min(el.scrollHeight, 160) // max ~6 linhas
    el.style.height = `${newHeight}px`
  }, [])

  useEffect(() => { autoGrow() }, [texto, autoGrow])

  // ── Notificações ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (totalUnread > prevUnread) {
      const audio = new Audio('https://chatwoot-assets.s3.amazonaws.com/sounds/ding.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {})

      if (Notification.permission === 'granted' && document.hidden) {
        new Notification('Inbox Cajado', {
          body: 'Você recebeu novas mensagens no WhatsApp!',
          icon: '/icon-192.png'
        })
      }
    }
    setPrevUnread(totalUnread)
  }, [totalUnread, prevUnread])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversa?.mensagens?.length])

  const conversasFiltradas = conversas.filter(c =>
    c.nome?.toLowerCase().includes(filtro.toLowerCase()) ||
    c.numero?.includes(filtro) ||
    c.etiqueta?.includes(filtro.toLowerCase())
  )

  async function handleEnviar() {
    if (!texto.trim() || !numeroAtivo || enviando) return
    setEnviando(true)
    try {
      if (nota) {
        await enviarNota(numeroAtivo, texto)
      } else {
        await enviarMensagem(numeroAtivo, texto)
      }
      setTexto('')
      // reset textarea height
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      await refetchConversa()
    } finally {
      setEnviando(false)
    }
  }

  async function handleToggleBot() {
    if (!conversa || !numeroAtivo) return
    const botEstaAtivo = conversa.botOn !== false

    if (botEstaAtivo) {
      await toggleBot(numeroAtivo, true)
      await humanouAssumiu(numeroAtivo, 'Atendente')
    } else {
      await reativarBot(numeroAtivo)
      await toggleBot(numeroAtivo, false)
    }

    await refetch()
    await refetchConversa()
  }

  return (
    // dvh (dynamic viewport height) para iOS com barra do Safari
    <div className="flex h-[calc(100dvh-88px)] sm:h-[calc(100dvh-100px)] -mx-4 md:-mx-6 -mt-4 md:-mt-6 overflow-hidden">

      {/* ── Coluna 1: Lista de conversas ──────────────────────── */}
      <div className={cn("shrink-0 border-r border-border-subtle flex-col bg-[#05070a]", (numeroAtivo || showConfig) ? "hidden md:flex md:w-80" : "flex w-full md:w-80")}>
        <div className="px-3 pt-3 pb-2 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-fg font-display">
              Inbox <span className="text-emerald-400 font-normal">WhatsApp</span>
            </h2>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span className="bg-emerald-500 text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {totalUnread} novas
                </span>
              )}
              <button 
                onClick={() => setShowConfig(!showConfig)}
                className={cn('text-xs transition-colors', showConfig ? 'text-emerald-400' : 'text-fg-disabled hover:text-emerald-400')}
                title="Configurar WhatsApp do Inbox"
              >
                ⚙️
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('cajado_inbox_token')
                  window.location.reload()
                }}
                className="text-fg-disabled hover:text-red-400 text-xs transition-colors"
                title="Sair do Inbox"
              >
                Sair
              </button>
            </div>
          </div>

          {/* Campo de busca com botão X para limpar */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary text-sm pointer-events-none">🔍</span>
            <input
              className="w-full text-xs py-2 pl-7 pr-8 bg-page border border-border-subtle rounded-lg text-fg placeholder:text-fg-disabled focus:outline-none focus:border-emerald-500/50 transition-colors"
              placeholder="Buscar nome, número ou ticket..."
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
            {filtro && (
              <button
                onClick={() => setFiltro('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-hover text-fg-secondary hover:bg-zinc-600 hover:text-fg flex items-center justify-center transition-colors text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-xs text-fg-disabled text-center py-8">Sincronizando com WhatsApp...</p>
          )}
          {!loading && conversasFiltradas.length === 0 && (
            <p className="text-xs text-fg-disabled text-center py-8">Caixa de entrada limpa! ✅</p>
          )}
          {conversasFiltradas.map(c => (
            <ConversaItem
              key={c.numero}
              conv={c}
              ativa={c.numero === numeroAtivo && !showConfig}
              onClick={() => { setNumeroAtivo(c.numero); setShowConfig(false); }}
            />
          ))}
        </div>
      </div>

      {showConfig ? (
        <div className={cn("overflow-y-auto bg-page p-4 md:p-8", showConfig ? "flex-1 flex flex-col w-full" : "hidden md:flex")}>
          <button onClick={() => setShowConfig(false)} className="md:hidden flex items-center gap-1 text-fg-secondary mb-6 bg-muted/50 w-fit px-3 py-1.5 rounded-lg text-sm">
            <IconBack className="w-4 h-4" />
            Voltar
          </button>
          <ConfiguracoesBotClient inModal={true} />
        </div>
      ) : (
        <>
          {/* ── Coluna 2: Chat ────────────────────────────────────── */}
          <div className={cn("flex-col min-w-0 bg-page relative", numeroAtivo ? "flex flex-1 w-full" : "hidden md:flex flex-1")}>
            
            {/* Background pattern CSS puro — sem CDN externa */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{
                backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
              }}
            />

            {!numeroAtivo ? (
              <div className="flex items-center justify-center h-full relative z-10">
                <div className="text-center">
                  <div className="w-16 h-16 bg-muted/50 border border-border-subtle rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                    <span className="text-2xl">📱</span>
                  </div>
                  <p className="text-fg-secondary">Selecione uma conversa para iniciar o atendimento</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full relative z-10">
                {/* ── Header do chat — simplificado ── */}
                <div className="px-3 md:px-4 py-2.5 border-b border-border-subtle/80 flex items-center justify-between flex-shrink-0 bg-[#0a0d16]/90 backdrop-blur-md">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button 
                      onClick={() => { setNumeroAtivo(null); setShowConfig(false); }} 
                      className="md:hidden text-fg-secondary hover:text-fg flex items-center justify-center w-8 h-8 -ml-1 rounded-full hover:bg-surface-hover/50 transition-colors"
                    >
                      <IconBack className="w-5 h-5" />
                    </button>
                    {/* Avatar no header */}
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
                      conversa?.botOn !== false
                        ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                    )}>
                      {conversa?.nome?.[0]?.toUpperCase() || '#'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-fg truncate">{conversa?.nome || numeroAtivo}</p>
                      <p className="text-[10px] text-fg-tertiary font-mono">{numeroAtivo}</p>
                    </div>
                  </div>

                  {/* Ações no header — bot toggle + etiqueta select */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Seletor de etiqueta compacto */}
                    <select 
                      className={cn(
                        "text-[10px] px-1.5 py-1 rounded-lg border appearance-none outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium max-w-[90px] hidden sm:block",
                        conversa?.etiqueta ? (etiquetaColors[conversa.etiqueta] || 'bg-muted border-border-subtle text-fg-secondary') : 'bg-muted border-border-subtle text-fg-secondary'
                      )}
                      value={conversa?.etiqueta || ''}
                      onChange={async (e) => {
                         const nova = e.target.value
                         await mudarEtiqueta(numeroAtivo!, nova)
                         await refetch()
                         await refetchConversa()
                      }}
                    >
                      <option value="">Etiqueta</option>
                      <option value="novo">Novo</option>
                      <option value="proposta">Proposta</option>
                      <option value="cliente">Cliente Ativo</option>
                      <option value="aguardando">Aguardando</option>
                      <option value="retomar">Retomar</option>
                      <option value="perdido">Perdido</option>
                    </select>

                    {/* Botão bot/humano */}
                    <button
                      onClick={handleToggleBot}
                      className={cn(
                        'text-[10px] px-2.5 py-1.5 rounded-lg border transition-all duration-300 font-semibold flex items-center gap-1 whitespace-nowrap',
                        conversa?.botOn !== false
                          ? 'border-border-subtle text-fg-secondary hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5'
                          : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      )}
                    >
                      {conversa?.botOn !== false ? '🤖 Bot' : '👤 Humano'}
                    </button>
                  </div>
                </div>

                {/* ── Área de mensagens ── */}
                <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 scroll-smooth">
                  {!conversa?.mensagens?.length && (
                    <p className="text-xs text-fg-disabled text-center py-8">Nenhuma mensagem neste chat.</p>
                  )}
                  {conversa?.mensagens?.map(msg => (
                    <MensagemBubble key={msg.id} msg={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* ── Input de envio — WhatsApp style ── */}
                <div className={cn(
                  "px-3 py-2.5 border-t flex-shrink-0 transition-colors",
                  nota ? 'border-amber-500/20 bg-amber-500/5' : 'border-border-subtle bg-[#05070a]'
                )}>
                  {/* Menu de Snippets */}
                  {showSnippets && !nota && (
                    <div className="mb-2 bg-muted border border-border-subtle shadow-xl rounded-xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                      <p className="text-[10px] font-bold text-fg-tertiary px-2 py-1 uppercase tracking-wider">⚡ Respostas Rápidas</p>
                      <div className="flex flex-col gap-1 mt-1 max-h-48 overflow-y-auto">
                        {SNIPPETS.map(snip => (
                          <button
                            key={snip.atalho}
                            onClick={() => {
                              setTexto(snip.texto)
                              setShowSnippets(false)
                            }}
                            className="text-left px-3 py-2 rounded-lg hover:bg-surface-hover/50 transition-colors flex flex-col group"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-400/10 px-1.5 rounded">{snip.atalho}</span>
                              <span className="text-xs font-semibold text-fg group-hover:text-emerald-400">{snip.titulo}</span>
                            </div>
                            <span className="text-[10px] text-fg-tertiary truncate mt-0.5">{snip.texto}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Indicador de modo nota */}
                  {nota && (
                    <div className="flex items-center gap-1.5 mb-2 px-1">
                      <span className="text-[10px] text-amber-400 font-semibold">📝 Nota interna — apenas sua equipe verá</span>
                      <button onClick={() => setNota(false)} className="ml-auto text-fg-disabled hover:text-fg-secondary text-[10px]">✕ cancelar</button>
                    </div>
                  )}

                  {/* Row principal: textarea + botões */}
                  <div className="flex items-end gap-2">
                    {/* Botão nota → ícone inline */}
                    {!nota && (
                      <button
                        onClick={() => setNota(true)}
                        title="Nota interna"
                        className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted hover:bg-surface-hover border border-border-subtle text-fg-tertiary hover:text-amber-400 flex items-center justify-center transition-colors"
                      >
                        <IconNote className="w-4 h-4" />
                      </button>
                    )}

                    {/* Textarea auto-grow */}
                    <textarea
                      ref={textareaRef}
                      className={cn(
                        'flex-1 min-h-[40px] max-h-40 px-3 py-2.5 rounded-xl text-sm resize-none bg-page border text-fg placeholder:text-fg-disabled focus:outline-none focus:ring-1 transition-all overflow-y-auto',
                        nota
                          ? 'border-amber-500/40 focus:ring-amber-500/40 focus:border-amber-500/60'
                          : 'border-border-subtle focus:ring-emerald-500/30 focus:border-emerald-500/50'
                      )}
                      style={{ height: 'auto' }}
                      rows={1}
                      placeholder={nota ? 'Nota que apenas sua equipe verá...' : 'Digite / para respostas rápidas...'}
                      value={texto}
                      onChange={e => {
                        const val = e.target.value
                        setTexto(val)
                        autoGrow()
                        if (val === '/') setShowSnippets(true)
                        else if (!val.startsWith('/')) setShowSnippets(false)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleEnviar()
                        }
                      }}
                    />

                    {/* Botão enviar — ícone grande, 44×44px área de toque */}
                    <button
                      onClick={handleEnviar}
                      disabled={!texto.trim() || enviando}
                      className={cn(
                        "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40",
                        nota
                          ? "bg-amber-500 hover:bg-amber-400 text-zinc-900"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:scale-105"
                      )}
                      title={nota ? 'Adicionar nota' : 'Enviar mensagem'}
                    >
                      {enviando ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <IconSend className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Coluna 3: Painel CRM dinâmico ────────────────────── */}
          <div className="hidden lg:block w-72 shrink-0 border-l border-border-subtle overflow-y-auto bg-[#05070a]">
            <div className="p-4 border-b border-border-subtle bg-page/50">
              <p className="text-[10px] font-bold text-fg-tertiary uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                CRM Cajado
              </p>
            </div>
            {numeroAtivo ? (
              <PainelCRM numero={numeroAtivo} nome={conversas.find(c => c.numero === numeroAtivo)?.nome} />
            ) : (
              <div className="p-6 text-center">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3 opacity-50">
                  🎯
                </div>
                <p className="text-xs text-fg-disabled leading-relaxed">Selecione um chat para ver o lead no CRM — altere o status do funil e registre atividades sem sair do Inbox.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
