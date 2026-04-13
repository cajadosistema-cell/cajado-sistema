'use client'

import { useState, useRef, useEffect } from 'react'
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
  perdido:    'bg-zinc-700 text-zinc-400',
  aguardando: 'bg-yellow-500/15 text-yellow-400',
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^55/, '')
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
        'w-full text-left px-3 py-3 border-b border-zinc-800 transition-colors',
        ativa ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <span className="text-amber-400 text-xs font-semibold">
              {conv.nome?.[0]?.toUpperCase() || '#'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{conv.nome}</p>
            <p className="text-xs text-zinc-500 truncate">{conv.ultimaMensagem}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-zinc-600">{conv.ultimoHorario}</span>
          {conv.unread > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-zinc-950 text-[9px] font-bold flex items-center justify-center">
              {conv.unread}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 pl-10">
        {conv.etiqueta && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', etiquetaColors[conv.etiqueta] || 'bg-zinc-700 text-zinc-400')}>
            {conv.etiqueta}
          </span>
        )}
        {conv.setor && (
          <span className="text-[10px] text-zinc-600">{conv.setor}</span>
        )}
        {!conv.botOn && (
          <span className="text-[10px] text-emerald-400">humano</span>
        )}
      </div>
    </button>
  )
}

function MensagemBubble({ msg }: { msg: { tipo: string; texto: string; timestamp: string; transcricao?: string } }) {
  const isEnviada = msg.tipo === 'enviada' || msg.tipo === 'bot'
  const isInterna = msg.tipo === 'interna'
  const isAudio = msg.texto.toLowerCase().includes('[áudio]') || msg.texto.toLowerCase().includes('audio') || msg.tipo === 'audio'
  
  // Fake transcription for demo purposes if it's an audio message but doesn't have transcription yet
  const transcricaoUI = msg.transcricao || (isAudio && !isEnviada ? "Transcrevendo áudio..." : null)

  return (
    <div className={cn('flex mb-2', isEnviada ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] px-3 py-2 rounded-xl text-sm',
          isInterna
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300 italic text-xs w-full max-w-full text-center'
            : isEnviada
            ? 'bg-zinc-700 text-zinc-100 rounded-br-sm'
            : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
        )}
      >
        {isInterna && <span className="text-amber-500 mr-1">📝</span>}
        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.texto}</span>
        
        {/* Bloco de Transcrição de Áudio gerado por IA */}
        {transcricaoUI && (
          <div className="mt-2 text-xs bg-zinc-900/50 p-2 rounded border border-zinc-700/50">
            <p className="text-[10px] text-zinc-500 font-bold mb-0.5 flex items-center gap-1">
              ✨ Transcrição de Áudio
            </p>
            <p className="text-zinc-300 italic">"{transcricaoUI}"</p>
          </div>
        )}

        <p className="text-[10px] mt-1 opacity-50 text-right">
          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
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
  perdido:       { label: 'Perdido',       color: 'text-zinc-500',    bg: 'bg-zinc-800' },
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
      <p className="text-xs text-zinc-600 animate-pulse">Buscando no CRM...</p>
    </div>
  )

  if (!lead && !criando) return (
    <div className="p-4 space-y-3">
      <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 text-center space-y-2">
        <p className="text-2xl">🔍</p>
        <p className="text-sm font-medium text-zinc-300">Não encontrado no CRM</p>
        <p className="text-xs text-zinc-600 font-mono">{telefone}</p>
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
      <p className="text-xs text-zinc-400 font-semibold">Novo lead via WhatsApp</p>
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
          <p className="text-sm font-semibold text-zinc-200 truncate">{lead.nome}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Trocar status no funil diretamente do inbox */}
      <div>
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Mover no funil</p>
        <div className="flex flex-wrap gap-1">
          {STATUS_PIPELINE.map(s => (
            <button key={s} onClick={() => mudarStatus(s)}
              className={`text-[10px] px-2 py-1 rounded-full border font-medium transition-all ${
                lead.status === s
                  ? `${STATUS_CONFIG_CRM[s].bg} ${STATUS_CONFIG_CRM[s].color} border-current`
                  : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-500'
              }`}>
              {STATUS_CONFIG_CRM[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-800/40 rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-amber-400">
            {lead.valor_estimado ? formatCurrency(lead.valor_estimado) : '—'}
          </p>
          <p className="text-[10px] text-zinc-600">pipeline</p>
        </div>
        <div className="bg-zinc-800/40 rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-zinc-300">{lead.origem || '—'}</p>
          <p className="text-[10px] text-zinc-600">origem</p>
        </div>
      </div>

      {/* Follow-up */}
      {lead.proximo_followup && (
        <div className={`rounded-lg p-2.5 border text-xs ${followupAtrasado ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-zinc-800/40 border-zinc-700 text-zinc-400'}`}>
          📅 {followupAtrasado ? '⚠ Atrasado! ' : 'Follow-up: '}
          {new Date(lead.proximo_followup).toLocaleDateString('pt-BR')}
        </div>
      )}

      {/* Notas do lead */}
      {lead.notas && (
        <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-2.5">
          <p className="text-[10px] text-zinc-500 mb-1">Notas</p>
          <p className="text-xs text-zinc-400 leading-relaxed">{lead.notas}</p>
        </div>
      )}

      {/* Registrar atividade rápida */}
      <div className="space-y-2">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Registrar no CRM</p>
        <textarea
          className="input w-full text-xs resize-none bg-zinc-900"
          rows={2}
          placeholder="Ex: Enviou proposta, confirmou reunião..."
          value={novaAtiv}
          onChange={e => setNovaAtiv(e.target.value)}
        />
        <button onClick={registrarAtividade} disabled={salvando || !novaAtiv.trim()}
          className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-300 font-medium transition-colors disabled:opacity-40">
          {salvando ? 'Salvando...' : '+ Registrar atividade'}
        </button>
      </div>

      {/* Histórico rápido */}
      {atividades.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Histórico ({atividades.length})</p>
          {atividades.map((a: any) => (
            <div key={a.id} className="bg-zinc-800/30 rounded-lg px-3 py-2">
              <p className="text-xs text-zinc-400">{a.descricao}</p>
              <p className="text-[10px] text-zinc-700 mt-0.5">
                {new Date(a.realizado_em).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Link para o CRM completo */}
      <a href="/cajado" className="block text-center text-[10px] text-zinc-600 hover:text-amber-400 transition-colors pt-1">
        Ver perfil completo no CRM →
      </a>
    </div>
  )
}

// ── Login com o backend inbox ──────────────────────────────────

// ── Snippets / Respostas Rápidas ───────────────────────────
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
  const [prevUnread, setPrevUnread] = useState(0) // Controla a notificação
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { conversas, loading, refetch } = useInbox()
  const { conversa, refetch: refetchConversa } = useConversaDetalhe(!showConfig ? numeroAtivo : null)

  const totalUnread = conversas.reduce((a, c) => a + (c.unread || 0), 0)

  // System Notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (totalUnread > prevUnread) {
      // Toca um som de notificação padrão do navegador/sistema
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
      await refetchConversa()
    } finally {
      setEnviando(false)
    }
  }

  async function handleToggleBot() {
    if (!conversa || !numeroAtivo) return
    const botEstaAtivo = conversa.botOn !== false

    if (botEstaAtivo) {
      // PAUSAR: humano vai assumir
      await toggleBot(numeroAtivo, true)
      await humanouAssumiu(numeroAtivo, 'Atendente')
    } else {
      // REATIVAR: devolver para o bot
      await reativarBot(numeroAtivo)
      await toggleBot(numeroAtivo, false)
    }

    await refetch()
    await refetchConversa()
  }

  return (
    <div className="flex h-[calc(100vh-88px)] -mx-6 -mt-6 overflow-hidden">

      {/* ── Coluna 1: Lista de conversas ──────────────────────── */}
      <div className="w-80 shrink-0 border-r border-zinc-800 flex flex-col bg-[#05070a]">
        <div className="p-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-100 font-display">
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
                className={cn('text-xs transition-colors', showConfig ? 'text-emerald-400' : 'text-zinc-600 hover:text-emerald-400')}
                title="Configurar WhatsApp do Inbox"
              >
                ⚙️ Configurar
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('cajado_inbox_token')
                  window.location.reload()
                }}
                className="text-zinc-600 hover:text-red-400 text-xs transition-colors ml-1"
                title="Sair do Inbox"
              >
                Sair
              </button>
            </div>
          </div>
          <input
            className="input w-full text-xs py-2 bg-zinc-900 border-zinc-800 focus:border-emerald-500/50"
            placeholder="🔍 Buscar nome, número ou ticket..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-xs text-zinc-600 text-center py-8">Sincronizando com WhatsApp...</p>
          )}
          {!loading && conversasFiltradas.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-8">Caixa de entrada limpa! ✅</p>
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
        <div className="flex-1 overflow-y-auto bg-[#080b14] p-8">
          <ConfiguracoesBotClient inModal={true} />
        </div>
      ) : (
        <>
          {/* ── Coluna 2: Chat ────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#080b14] relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        {!numeroAtivo ? (
          <div className="flex items-center justify-center h-full relative z-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-zinc-800/50 border border-zinc-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                <span className="text-2xl">📱</span>
              </div>
              <p className="text-zinc-400">Selecione uma conversa para iniciar o atendimento</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full relative z-10">
            {/* Header do chat */}
            <div className="px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between flex-shrink-0 bg-[#0a0d16]/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <span className="text-emerald-400 text-sm font-bold">
                    {conversa?.nome?.[0]?.toUpperCase() || '#'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-100">{conversa?.nome || numeroAtivo}</p>
                  <p className="text-xs text-zinc-500 font-mono">{numeroAtivo}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {conversa?.setor && (
                  <span className="text-[10px] text-zinc-400 bg-zinc-800/80 border border-zinc-700 px-2 py-1 rounded">
                    {conversa.setor}
                  </span>
                )}
                
                {/* Seletor Rápido de Etiqueta */}
                <select 
                  className={cn("text-xs px-2 py-1 rounded-lg border appearance-none outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium",
                    conversa?.etiqueta ? (etiquetaColors[conversa.etiqueta] || 'bg-zinc-800 border-zinc-700 text-zinc-300') : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  )}
                  value={conversa?.etiqueta || ''}
                  onChange={async (e) => {
                     const nova = e.target.value
                     await mudarEtiqueta(numeroAtivo!, nova)
                     await refetch()
                     await refetchConversa()
                  }}
                >
                  <option value="">+ Adicionar Etiqueta</option>
                  <option value="novo">Novo</option>
                  <option value="proposta">Proposta</option>
                  <option value="cliente">Cliente Ativo</option>
                  <option value="aguardando">Aguardando Docs</option>
                  <option value="retomar">Retomar</option>
                  <option value="perdido">Perdido</option>
                </select>

                <button
                  onClick={handleToggleBot}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border transition-all duration-300 font-medium tracking-wide flex items-center gap-1.5',
                    conversa?.botOn !== false
                      ? 'border-zinc-700 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5'
                      : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  )}
                >
                  {conversa?.botOn !== false ? '🤖 Bot Ativo' : '👤 Humano'}
                </button>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-5 scroll-smooth">
              {!conversa?.mensagens?.length && (
                <p className="text-xs text-zinc-600 text-center py-8">Nenhuma mensagem neste chat.</p>
              )}
              {conversa?.mensagens?.map(msg => (
                <MensagemBubble key={msg.id} msg={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de envio */}
            <div className="p-4 border-t border-zinc-800 flex-shrink-0 bg-[#05070a]">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setNota(false)}
                  className={cn('text-[10px] px-3 py-1 rounded-full transition-colors font-medium border',
                    !nota ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  Mensagem WhatsApp
                </button>
                <button
                  onClick={() => setNota(true)}
                  className={cn('text-[10px] px-3 py-1 rounded-full transition-colors font-medium border flex items-center gap-1',
                    nota ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  📝 Nota Interna Oculta
                </button>
              </div>
              <div className="flex gap-2">
                <textarea
                  className={cn(
                    'input resize-none text-sm flex-1 bg-zinc-900 border-zinc-800 transition-colors focus:ring-0',
                    nota ? 'border-amber-500/30 focus:border-amber-500' : 'focus:border-emerald-500/50'
                  )}
                  rows={2}
                  placeholder={nota ? 'Escreva uma nota que apenas sua equipe verá...' : 'Digite / para respostas rápidas...'}
                  value={texto}
                  onChange={e => {
                    const val = e.target.value
                    setTexto(val)
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
                
                {/* Menu de Snippets / Respostas Rápidas */}
                {showSnippets && !nota && (
                  <div className="absolute bottom-16 left-4 right-20 bg-zinc-800 border border-zinc-700 shadow-xl rounded-xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-[10px] font-bold text-zinc-500 px-2 py-1 uppercase tracking-wider">⚡ Respostas Rápidas</p>
                    <div className="flex flex-col gap-1 mt-1 max-h-48 overflow-y-auto">
                      {SNIPPETS.map(snip => (
                        <button
                          key={snip.atalho}
                          onClick={() => {
                            setTexto(snip.texto)
                            setShowSnippets(false)
                          }}
                          className="text-left px-3 py-2 rounded-lg hover:bg-zinc-700/50 transition-colors flex flex-col group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-400/10 px-1.5 rounded">{snip.atalho}</span>
                            <span className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-400">{snip.titulo}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 truncate mt-0.5">{snip.texto}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={handleEnviar}
                  disabled={!texto.trim() || enviando}
                  className={cn("px-5 rounded-lg flex items-center justify-center font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-40",
                    nota ? "bg-amber-500 hover:bg-amber-400 text-zinc-900" : "btn-primary hover:scale-105"
                  )}
                >
                  {enviando ? '...' : nota ? 'Anotar' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Coluna 3: Painel CRM dinâmico ────────────────────── */}
      <div className="w-72 shrink-0 border-l border-zinc-800 overflow-y-auto bg-[#05070a]">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            CRM Cajado
          </p>
        </div>
        {numeroAtivo ? (
          <PainelCRM numero={numeroAtivo} nome={conversas.find(c => c.numero === numeroAtivo)?.nome} />
        ) : (
          <div className="p-6 text-center">
            <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center mx-auto mb-3 opacity-50">
              🎯
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">Selecione um chat para ver o lead no CRM — altere o status do funil e registre atividades sem sair do Inbox.</p>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}
