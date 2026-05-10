'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
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

// Formata tempo de espera desde a última mensagem recebida
function formatarTempoEspera(isoTimestamp: string | null | undefined): { label: string; color: string } | null {
  if (!isoTimestamp) return null
  const diff = Date.now() - new Date(isoTimestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 5) return null // menos de 5min não mostra
  if (mins < 60) return { label: `${mins}min`, color: 'text-emerald-400' }
  const hrs = Math.floor(mins / 60)
  if (hrs < 3) return { label: `${hrs}h`, color: 'text-amber-400' }
  return { label: `${hrs}h`, color: 'text-red-400' }
}

// ── Ícones SVG inline ──────────────────────────────────────────

function IconSend({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  )
}

function IconMic({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" x2="12" y1="19" y2="22"/>
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
  const tempoEspera = formatarTempoEspera(conv.lastInboundAt)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3 border-b transition-all duration-200 relative group',
        ativa
          ? 'bg-gradient-to-r from-emerald-500/8 to-transparent border-border-subtle/40'
          : 'hover:bg-white/[0.03] border-border-subtle/40'
      )}
    >
      {/* Barra lateral esquerda — item ativo */}
      {ativa && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
      )}
      <div className="flex items-center gap-3 pl-1">
        {/* Avatar com gradiente e glow */}
        <div
          className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold shadow-md',
            conv.botOn !== false
              ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 text-emerald-300 ring-1 ring-emerald-500/40 shadow-emerald-500/10'
              : 'bg-gradient-to-br from-amber-500/30 to-amber-700/20 text-amber-300 ring-1 ring-amber-500/40 shadow-amber-500/10'
          )}
        >
          {conv.nome?.[0]?.toUpperCase() || '#'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className={cn('text-sm font-semibold truncate', ativa ? 'text-white' : 'text-fg')}>{conv.nome}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {tempoEspera && (
                <span className={cn('text-[9px] font-bold', tempoEspera.color)}>⏱ {tempoEspera.label}</span>
              )}
              <span className="text-[10px] text-fg-disabled/70">{conv.ultimoHorario}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <p className="text-xs text-fg-disabled truncate flex-1">{conv.ultimaMensagem}</p>
            {conv.unread > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-zinc-950 text-[9px] font-black flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/30">
                {conv.unread > 9 ? '9+' : conv.unread}
              </span>
            )}
          </div>
          {/* Etiqueta + status bot */}
          <div className="flex items-center gap-1.5 mt-1">
            {conv.etiqueta && (
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide', etiquetaColors[conv.etiqueta] || 'bg-surface-hover text-fg-secondary')}>
                {conv.etiqueta}
              </span>
            )}
            {conv.setor && (
              <span className="text-[9px] text-fg-disabled/60 bg-white/5 px-1.5 py-0.5 rounded-full">{conv.setor}</span>
            )}
            {!conv.botOn && (
              <span className="text-[9px] text-amber-400 font-semibold flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
                humano
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function MensagemBubble({ msg }: { msg: { id: string; tipo: string; texto: string; timestamp: string; transcricao?: string; mediaType?: string; mediaUrl?: string; mimetype?: string } }) {
  const isEnviada = msg.tipo === 'enviada' || msg.tipo === 'bot'
  const isInterna = msg.tipo === 'interna'
  const isAudio = msg.mediaType === 'audio' || msg.texto.toLowerCase().includes('[áudio]') || msg.texto.toLowerCase().includes('audio') || msg.tipo === 'audio'

  const transcricaoUI = msg.transcricao || (isAudio && !isEnviada && !msg.mediaUrl ? 'Transcrevendo áudio...' : null)

  const renderMedia = () => {
    if (!msg.mediaUrl) return null
    const type = msg.mediaType || (msg.mimetype?.startsWith('image/') ? 'image' : msg.mimetype?.startsWith('video/') ? 'video' : msg.mimetype?.startsWith('audio/') ? 'audio' : 'document')
    
    if (type === 'image') {
      return (
        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-2 overflow-hidden rounded-lg">
          <img src={msg.mediaUrl} alt="Imagem anexada" className="max-w-full max-h-60 object-contain hover:opacity-90 transition-opacity" />
        </a>
      )
    }
    if (type === 'audio') {
      return (
        <audio controls src={msg.mediaUrl} className="w-full max-w-[240px] mb-2 h-10 outline-none" />
      )
    }
    if (type === 'video') {
      return (
        <video controls src={msg.mediaUrl} className="max-w-full max-h-60 rounded-lg mb-2" />
      )
    }
    return (
      <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-black/20 hover:bg-black/30 transition-colors border border-white/10 text-white text-xs font-semibold">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-emerald-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <span className="truncate max-w-[150px]">{msg.texto.replace('📎 ', '') || 'Documento'}</span>
      </a>
    )
  }

  return (
    <div className={cn('flex mb-2', isEnviada ? 'justify-end' : isInterna ? 'justify-center' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85vw] md:max-w-[72%] px-3.5 py-2.5 text-sm leading-relaxed',
          isInterna
            ? 'bg-amber-500/10 border border-amber-500/25 text-amber-200/90 italic text-xs w-full text-center rounded-xl backdrop-blur-sm'
            : isEnviada
            ? 'rounded-2xl rounded-br-md text-white shadow-lg'
            : 'bg-white/[0.06] border border-white/10 text-fg rounded-2xl rounded-bl-md shadow-sm backdrop-blur-sm'
        )}
        style={isEnviada && !isInterna ? {
          background: 'linear-gradient(135deg, rgba(16,185,129,0.85) 0%, rgba(5,150,105,0.9) 100%)',
          boxShadow: '0 4px 16px rgba(16,185,129,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
        } : undefined}
      >
        {isInterna && <span className="text-amber-400 mr-1">📝</span>}
        
        {renderMedia()}
        
        {(!msg.mediaUrl || msg.texto !== `📎 ${msg.texto.replace('📎 ', '')}`) && (
          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.texto}</span>
        )}

        {/* Transcrição de áudio */}
        {transcricaoUI && (
          <div className="mt-2 text-xs bg-black/20 px-2.5 py-2 rounded-xl border border-white/10 backdrop-blur-sm">
            <p className="text-[10px] text-white/60 font-bold mb-0.5">✨ Transcrição</p>
            <p className="italic opacity-80">"{transcricaoUI}"</p>
          </div>
        )}

        {/* Horário + ticks */}
        <div className={cn('flex items-center gap-1 mt-1.5', isEnviada ? 'justify-end' : isInterna ? 'justify-center' : 'justify-start')}>
          <span className={cn('text-[10px]', isEnviada ? 'text-white/60' : 'text-fg-disabled/60')}>
            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isEnviada && !isInterna && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 11" className="w-3.5 h-3.5 text-white/60" fill="currentColor">
              <path d="M11.071.653a.75.75 0 0 1 .047 1.06L5.36 8.06a.75.75 0 0 1-1.08.02L1.43 5.23a.75.75 0 1 1 1.06-1.06l2.27 2.27 5.25-5.74a.75.75 0 0 1 1.061-.047ZM14.57.653a.75.75 0 0 1 .047 1.06l-5.758 6.347a.75.75 0 0 1-1.08.02l-.72-.72a.75.75 0 1 1 1.06-1.06l.19.19 5.2-5.79a.75.75 0 0 1 1.06-.047Z"/>
            </svg>
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
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string>('todos')
  const [enviando, setEnviando] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showSnippets, setShowSnippets] = useState(false)
  const [snippetIndex, setSnippetIndex] = useState(0)
  const [snippetFiltro, setSnippetFiltro] = useState('')
  const [showMobileActions, setShowMobileActions] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [prevUnread, setPrevUnread] = useState(0)
  const [abaAtiva, setAbaAtiva] = useState<'info' | 'historico'>('info')
  const [notaAtendente, setNotaAtendente] = useState('')
  const [salvandoNota, setSalvandoNota] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const { conversas, loading, refetch, clearUnreadLocal } = useInbox()
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

  // ── Gravador de Áudio ──────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' })
        const audioFile = new File([audioBlob], `audio_${Date.now()}.mp4`, { type: 'audio/mp4' })
        Object.defineProperty(audioFile, 'isVoiceNote', { value: true, writable: false })
        setArquivo(audioFile)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      alert('Erro ao acessar o microfone. Verifique se o navegador tem permissão.')
      console.error(err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop())
      }
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

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

  const conversasFiltradas = conversas.filter(c => {
    const matchFiltro = c.nome?.toLowerCase().includes(filtro.toLowerCase()) ||
      c.numero?.includes(filtro) ||
      c.etiqueta?.includes(filtro.toLowerCase())
    const matchEtiqueta = etiquetaFiltro === 'todos' || c.etiqueta === etiquetaFiltro
    return matchFiltro && matchEtiqueta
  })

  const TABS = [
    { id: 'todos',    label: 'Todos' },
    { id: 'novo',     label: 'Novo Lead' },
    { id: 'proposta', label: 'Em Proposta' },
    { id: 'retomar',  label: 'Retomar' },
    { id: 'cliente',  label: 'Cliente' },
  ]

  async function handleEnviar() {
    if ((!texto.trim() && !arquivo) || !numeroAtivo || enviando) return
    setEnviando(true)
    try {
      if (nota) {
        await enviarNota(numeroAtivo, texto)
      } else {
        let mediaPayload = undefined
        if (arquivo) {
          const fileExt = arquivo.name.split('.').pop()
          const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
          const filePath = `${numeroAtivo}/${fileName}`
          
          const { error: uploadError } = await supabase.storage
            .from('inbox-media')
            .upload(filePath, arquivo)
            
          if (uploadError) throw new Error('Erro no upload da mídia: ' + uploadError.message)
          
          const { data } = supabase.storage.from('inbox-media').getPublicUrl(filePath)
          
          mediaPayload = {
            url: data.publicUrl,
            mimetype: arquivo.type,
            tipo: arquivo.type.startsWith('image/') ? 'image' : arquivo.type.startsWith('video/') ? 'video' : arquivo.type.startsWith('audio/') ? 'audio' : 'document',
            fileName: arquivo.name
          }
        }
        await enviarMensagem(numeroAtivo, texto, mediaPayload)
      }
      setTexto('')
      setArquivo(null)
      // reset textarea height
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      await refetchConversa()
    } catch (e: any) {
      alert('Erro ao enviar: ' + e.message)
    } finally {
      setEnviando(false)
    }
  }

  async function handleToggleBot() {
    if (!conversa || !numeroAtivo) return
    const botEstaAtivo = conversa.botOn !== false

    try {
      if (botEstaAtivo) {
        await toggleBot(numeroAtivo, true)
        await humanouAssumiu(numeroAtivo, 'Atendente')
      } else {
        await reativarBot(numeroAtivo)
        await toggleBot(numeroAtivo, false)
      }
      await refetch()
      await refetchConversa()
    } catch (err) {
      console.error('[inbox] Erro ao alternar bot:', err)
      alert('Erro ao alternar bot. Verifique sua conexão e tente novamente.')
    }
  }

  async function handleSalvarNota() {
    if (!notaAtendente.trim() || !numeroAtivo) return
    setSalvandoNota(true)
    try {
      await enviarNota(numeroAtivo, notaAtendente)
      setNotaAtendente('')
      await refetchConversa()
    } finally {
      setSalvandoNota(false)
    }
  }

  async function handleAssumirConversa() {
    if (!numeroAtivo) return
    try {
      console.log('Assumindo conversa:', numeroAtivo)
      await toggleBot(numeroAtivo, true)
      await humanouAssumiu(numeroAtivo, 'Atendente')
      await refetch()
      await refetchConversa()
      console.log('Conversa assumida com sucesso!')
    } catch (err: any) {
      console.error('[inbox] Erro ao assumir:', err)
      alert('Erro ao assumir: ' + (err.message || 'Erro desconhecido'))
    }
  }

  const ETIQUETA_LABELS: Record<string, string> = {
    novo: 'Novo Lead', proposta: 'Em Proposta', cliente: 'Cliente Ativo',
    aguardando: 'Aguardando', retomar: 'Retomar', perdido: 'Perdido',
  }

  return (
    // Tela cheia — fixa no mobile para não rolar a página toda. 
    // Quando entra num chat (numeroAtivo), ganha z-[60] para cobrir o BottomNav e pb-0 para o input ficar no fundo
    <div className={cn(
      "fixed inset-0 flex overflow-hidden bg-[#05070a]",
      "md:relative md:inset-auto md:h-screen md:pb-0 md:z-auto",
      (!numeroAtivo && !showConfig) ? "pb-[65px] z-40" : "pb-0 z-[60]"
    )}>

      {/* ── Coluna 1: Lista de conversas ──────────────────────── */}
      <div className={cn("shrink-0 border-r border-border-subtle flex-col bg-[#05070a]", (numeroAtivo || showConfig) ? "hidden md:flex md:w-80" : "flex w-full md:w-80")}>
        <div className="px-3 pt-3 pb-2 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              {/* Botão voltar ao sistema */}
              <Link
                href="/inicio"
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted/60 border border-border-subtle text-fg-tertiary hover:text-fg hover:bg-surface-hover transition-all"
                title="Voltar ao sistema"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </Link>
              <h2 className="text-sm font-semibold text-fg font-display">
                Inbox <span className="text-emerald-400 font-normal">WhatsApp</span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span className="bg-emerald-500 text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {totalUnread} novas
                </span>
              )}
              <button 
                onClick={() => setShowConfig(!showConfig)}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all border',
                  showConfig
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-muted/60 border-border-subtle text-fg-secondary hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                )}
                title="Configurar WhatsApp do Inbox"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('cajado_inbox_token')
                  window.location.reload()
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/60 border border-border-subtle text-fg-disabled hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                title="Sair do Inbox"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Campo de busca premium */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary/60 text-xs pointer-events-none">🔍</span>
            <input
              className="w-full text-xs py-2 pl-7 pr-8 bg-white/[0.04] border border-white/10 rounded-xl text-fg placeholder:text-fg-disabled/50 focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_0_1px_rgba(16,185,129,0.2)] transition-all"
              placeholder="Buscar nome, número ou ticket..."
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
            {filtro && (
              <button
                onClick={() => setFiltro('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 text-fg-secondary hover:bg-white/20 hover:text-fg flex items-center justify-center transition-colors text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Abas de filtro premium */}
          <div className="flex gap-1 mt-2.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setEtiquetaFiltro(tab.id)}
                className={cn(
                  'shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full transition-all duration-200 border',
                  etiquetaFiltro === tab.id
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                    : 'bg-white/[0.03] border-white/10 text-fg-disabled hover:text-fg-secondary hover:bg-white/[0.05]'
                )}
              >
                {tab.label}
                {tab.id !== 'todos' && (
                  <span className={cn('ml-1', etiquetaFiltro === tab.id ? 'opacity-80' : 'opacity-40')}>
                    {conversas.filter(c => c.etiqueta === tab.id).length || ''}
                  </span>
                )}
              </button>
            ))}
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
              onClick={() => {
                setNumeroAtivo(c.numero)
                setShowConfig(false)
                if (c.unread > 0) clearUnreadLocal(c.numero)
              }}
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
                {/* ── Header do chat — simplificado e FIXO no topo ── */}
                <div className="sticky top-0 z-30 px-3 md:px-4 py-2.5 border-b border-border-subtle/80 flex flex-col flex-shrink-0 bg-[#0a0d16]/95 backdrop-blur-md">
                  <div className="flex items-center justify-between">
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

                  {/* ── Barra Inferior do Header (Ações Mobile) ── */}
                  <div className="lg:hidden mt-2.5 pt-2 border-t border-border-subtle/50 flex items-center gap-2 overflow-x-auto custom-scrollbar-hide pb-0.5">
                    <button onClick={handleAssumirConversa}
                      className="whitespace-nowrap px-3 py-1.5 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 rounded-lg text-[11px] font-bold border border-emerald-500/20 transition-colors">
                      ✋ Assumir
                    </button>
                    <button
                      onClick={async () => { const s = prompt('Setor destino: (vendas, suporte, financeiro, cursos, reciclagem, mopp)'); if (s) { await mudarSetor(numeroAtivo!, s); await refetch(); await refetchConversa(); } }}
                      className="whitespace-nowrap px-3 py-1.5 bg-muted text-fg-secondary hover:text-fg hover:bg-surface-hover rounded-lg text-[11px] font-semibold border border-border-subtle transition-colors">
                      → Transferir
                    </button>
                    <button
                      onClick={async () => { await mudarEtiqueta(numeroAtivo!, 'perdido'); await refetch(); setNumeroAtivo(null) }}
                      className="whitespace-nowrap px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-[11px] font-semibold border border-red-500/20 transition-colors">
                      ✕ Arquivar
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
                  {/* Menu de Snippets — popover inteligente com filtro e navegação por teclado */}
                  {showSnippets && !nota && (() => {
                    const filtrados = SNIPPETS.filter(s =>
                      snippetFiltro === '' ||
                      s.atalho.includes(snippetFiltro) ||
                      s.titulo.toLowerCase().includes(snippetFiltro.toLowerCase())
                    )
                    return (
                      <div className="mb-2 bg-[#0d1117] border border-emerald-500/20 shadow-2xl shadow-emerald-500/5 rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
                          <span className="text-emerald-400 font-mono text-xs font-bold">/{snippetFiltro}</span>
                          <span className="text-[10px] text-fg-disabled">— use ↑↓ para navegar, Enter para inserir, Esc para fechar</span>
                        </div>
                        <div className="flex flex-col max-h-52 overflow-y-auto custom-scrollbar">
                          {filtrados.length === 0 ? (
                            <p className="text-xs text-fg-disabled text-center py-4">Nenhum atalho encontrado para /{snippetFiltro}</p>
                          ) : filtrados.map((snip, idx) => (
                            <button
                              key={snip.atalho}
                              onMouseDown={e => e.preventDefault()} // evita blur do textarea
                              onClick={() => {
                                setTexto(snip.texto)
                                setShowSnippets(false)
                                setSnippetFiltro('')
                                setSnippetIndex(0)
                                setTimeout(() => textareaRef.current?.focus(), 0)
                              }}
                              className={cn(
                                'text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors border-b border-border-subtle/30 last:border-0',
                                idx === snippetIndex
                                  ? 'bg-emerald-500/10'
                                  : 'hover:bg-white/[0.04]'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">{snip.atalho}</span>
                                <span className="text-xs font-semibold text-fg">{snip.titulo}</span>
                              </div>
                              <p className="text-[10px] text-fg-disabled truncate pl-0.5">{snip.texto.substring(0, 80)}...</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Indicador de modo nota */}
                  {nota && (
                    <div className="flex items-center gap-1.5 mb-2 px-1">
                      <span className="text-[10px] text-amber-400 font-semibold">📝 Nota interna — apenas sua equipe verá</span>
                      <button onClick={() => setNota(false)} className="ml-auto text-fg-disabled hover:text-fg-secondary text-[10px]">✕ cancelar</button>
                    </div>
                  )}

                  {/* Preview de Arquivo */}
                  {arquivo && (
                    <div className="flex items-center justify-between mb-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in fade-in">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-emerald-400 text-lg shrink-0">📎</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-400 truncate">{arquivo.name}</p>
                          <p className="text-[10px] text-emerald-400/70">{(arquivo.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button onClick={() => setArquivo(null)} className="p-1 text-emerald-400/70 hover:text-emerald-400 shrink-0">
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Row principal: textarea + botões */}
                  <div className="flex items-end gap-1.5 sm:gap-2">
                    {/* Botões anexo e nota */}
                    {!nota && (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          title="Anexar arquivo"
                          className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted hover:bg-surface-hover border border-border-subtle text-fg-tertiary hover:text-emerald-400 flex items-center justify-center transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              setArquivo(e.target.files[0])
                            }
                          }}
                        />
                        <button
                          onClick={() => setNota(true)}
                          title="Nota interna"
                          className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted hover:bg-surface-hover border border-border-subtle text-fg-tertiary hover:text-amber-400 flex items-center justify-center transition-colors"
                        >
                          <IconNote className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Área de Input ou Gravação */}
                    {isRecording ? (
                      <div className="flex-1 flex items-center justify-between bg-page border border-red-500/30 rounded-xl px-4 py-2.5 h-[44px]">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-sm font-medium text-red-400">{formatRecordingTime(recordingTime)}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={cancelRecording} className="text-xs text-fg-disabled hover:text-red-400 font-semibold transition-colors uppercase tracking-wider">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
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
                        placeholder={nota ? 'Nota que apenas sua equipe verá...' : 'Mensagem... (ou grave um áudio)'}
                        value={texto}
                        onChange={e => {
                          const val = e.target.value
                          setTexto(val)
                          autoGrow()
                          if (val === '/') {
                            setShowSnippets(true)
                            setSnippetFiltro('')
                            setSnippetIndex(0)
                          } else if (val.startsWith('/') && !val.includes(' ')) {
                            setShowSnippets(true)
                            setSnippetFiltro(val.slice(1))
                            setSnippetIndex(0)
                          } else {
                            setShowSnippets(false)
                            setSnippetFiltro('')
                          }
                        }}
                        onKeyDown={e => {
                          // Navegação do snippet com teclado
                          if (showSnippets) {
                            const filtrados = SNIPPETS.filter(s =>
                              snippetFiltro === '' ||
                              s.atalho.includes(snippetFiltro) ||
                              s.titulo.toLowerCase().includes(snippetFiltro.toLowerCase())
                            )
                            if (e.key === 'ArrowDown') {
                              e.preventDefault()
                              setSnippetIndex(i => Math.min(i + 1, filtrados.length - 1))
                              return
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault()
                              setSnippetIndex(i => Math.max(i - 1, 0))
                              return
                            }
                            if (e.key === 'Enter' && filtrados[snippetIndex]) {
                              e.preventDefault()
                              setTexto(filtrados[snippetIndex].texto)
                              setShowSnippets(false)
                              setSnippetFiltro('')
                              setSnippetIndex(0)
                              return
                            }
                            if (e.key === 'Escape') {
                              setShowSnippets(false)
                              setSnippetFiltro('')
                              return
                            }
                          }
                          if (e.key === 'Enter' && !e.shiftKey && !showSnippets) {
                            e.preventDefault()
                            handleEnviar()
                          }
                        }}
                      />
                    )}

                    {/* Botão de Envio / Gravar / Parar */}
                    {isRecording ? (
                      <button
                        onClick={stopRecording}
                        className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:scale-105 flex items-center justify-center transition-all duration-200"
                        title="Enviar Áudio"
                      >
                        <IconSend className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={(!texto.trim() && !arquivo && !nota) ? startRecording : handleEnviar}
                        disabled={enviando}
                        className={cn(
                          "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40",
                          (!texto.trim() && !arquivo && !nota)
                            ? "bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20"
                            : nota
                              ? "bg-amber-500 hover:bg-amber-400 text-zinc-900"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:scale-105"
                        )}
                        title={(!texto.trim() && !arquivo && !nota) ? 'Gravar áudio' : nota ? 'Adicionar nota' : 'Enviar mensagem'}
                      >
                        {enviando ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (!texto.trim() && !arquivo && !nota) ? (
                          <IconMic className="w-5 h-5" />
                        ) : (
                          <IconSend className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Coluna 3: Painel Atendimento estilo VisioPro ── */}
          <div className="hidden lg:flex flex-col w-72 shrink-0 border-l border-border-subtle bg-[#07090f]">

            {/* Contact header */}
            <div className="p-4 border-b border-border-subtle flex-shrink-0">
              {numeroAtivo && conversa ? (
                <div className="flex items-start gap-3">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ring-1', conversa.botOn !== false ? 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30' : 'bg-amber-500/20 text-amber-400 ring-amber-500/30')}>
                    {conversa.nome?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-fg truncate">{conversa.nome || '—'}</p>
                    <p className="text-[10px] text-fg-tertiary font-mono truncate">{numeroAtivo}</p>
                    <span className={cn('mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full', etiquetaColors[conversa.etiqueta || 'novo'] || 'bg-blue-500/15 text-blue-400')}>
                      {ETIQUETA_LABELS[conversa.etiqueta || ''] || 'Novo Lead'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] font-bold text-fg-tertiary uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  CRM Cajado
                </p>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border-subtle flex-shrink-0">
              {(['info', 'historico'] as const).map(aba => (
                <button key={aba} onClick={() => setAbaAtiva(aba)}
                  className={cn('flex-1 py-2 text-xs font-semibold transition-colors', abaAtiva === aba ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-fg-tertiary hover:text-fg')}
                >
                  {aba === 'info' ? 'Info' : 'Histórico'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {abaAtiva === 'info' && numeroAtivo && conversa ? (
                <div className="p-4 space-y-4">
                  {/* Etiqueta */}
                  <div>
                    <label className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1.5 block">Etiqueta</label>
                    <select value={conversa.etiqueta || 'novo'} onChange={async e => { await mudarEtiqueta(numeroAtivo, e.target.value); await refetch() }}
                      className="w-full text-xs py-1.5 px-2.5 bg-muted border border-border-subtle rounded-lg text-fg outline-none cursor-pointer">
                      <option value="novo">Novo Lead</option>
                      <option value="proposta">Em Proposta</option>
                      <option value="cliente">Cliente Ativo</option>
                      <option value="aguardando">Aguardando</option>
                      <option value="retomar">Retomar</option>
                      <option value="perdido">Perdido</option>
                    </select>
                  </div>
                  {/* Setor */}
                  <div>
                    <label className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1.5 block">Setor</label>
                    <select value={conversa.setor || ''} onChange={async e => { await mudarSetor(numeroAtivo, e.target.value); await refetch() }}
                      className="w-full text-xs py-1.5 px-2.5 bg-muted border border-border-subtle rounded-lg text-fg outline-none cursor-pointer">
                      <option value="">Pendente / Sem Setor</option>
                      <option value="vendas">Vendas</option>
                      <option value="suporte">Suporte</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="cursos">Cursos</option>
                      <option value="reciclagem">Reciclagem CNH</option>
                      <option value="mopp">MOPP</option>
                      <option value="transporte_escolar">Transp. Escolar</option>
                    </select>
                  </div>
                  {/* Bot toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-xs font-semibold text-fg-secondary">Bot IA</p>
                      <p className="text-[10px] text-fg-tertiary">{conversa.botOn !== false ? 'Ativo' : 'Pausado'}</p>
                    </div>
                    <button onClick={handleToggleBot} className={cn('relative w-10 h-5 rounded-full transition-all duration-300', conversa.botOn !== false ? 'bg-emerald-500' : 'bg-zinc-700')}>
                      <span className={cn('absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300', conversa.botOn !== false ? 'translate-x-[20px]' : 'translate-x-0')} />
                    </button>
                  </div>
                  {/* Responsável */}
                  <div>
                    <label className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1 block">Responsável</label>
                    <p className="text-xs text-fg-secondary">{(conversa as any).assumido_nome || '— Sem atendente'}</p>
                  </div>
                  {/* Canal */}
                  <div>
                    <label className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1 block">Canal</label>
                    <p className="text-xs text-fg-secondary">💬 WhatsApp{(conversa as any).instanceName ? ` (${(conversa as any).instanceName})` : ''}</p>
                  </div>
                  <div className="border-t border-border-subtle" />
                  {/* Notas Internas */}
                  <div>
                    <p className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-2">Notas Internas</p>
                    <textarea placeholder="Adicionar nota sobre este cliente..." value={notaAtendente} onChange={e => setNotaAtendente(e.target.value)} rows={3}
                      className="w-full text-xs py-2 px-3 bg-muted border border-border-subtle rounded-lg text-fg placeholder:text-fg-disabled resize-none outline-none focus:border-emerald-500/50 transition-colors" />
                    <button onClick={handleSalvarNota} disabled={!notaAtendente.trim() || salvandoNota}
                      className="mt-2 w-full py-1.5 text-xs font-semibold bg-muted hover:bg-surface-hover border border-border-subtle rounded-lg text-fg-secondary hover:text-fg transition-colors disabled:opacity-40">
                      {salvandoNota ? 'Salvando...' : '💾 Salvar nota'}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-border-subtle">
                    <a href="/cajado" className="block w-full text-center text-xs text-amber-400/70 hover:text-amber-400 font-semibold transition-colors py-2 bg-amber-500/5 hover:bg-amber-500/10 rounded-lg">
                      Ver perfil completo no CRM →
                    </a>
                  </div>
                </div>
              ) : abaAtiva === 'historico' && numeroAtivo ? (
                <PainelCRM numero={numeroAtivo} nome={conversas.find(c => c.numero === numeroAtivo)?.nome} />
              ) : (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3 opacity-50">🎯</div>
                  <p className="text-xs text-fg-disabled leading-relaxed">Selecione um chat para ver o lead no CRM.</p>
                </div>
              )}
            </div>

            {/* Ações Rápidas */}
            {numeroAtivo && (
              <div className="p-3 space-y-2 border-t border-border-subtle flex-shrink-0">
                <p className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1">Ações Rápidas</p>
                <button onClick={handleAssumirConversa}
                  className="w-full py-2 text-xs font-bold rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all hover:border-emerald-500/50">
                  ✋ Assumir conversa
                </button>
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="w-full py-2 text-xs font-bold rounded-lg bg-muted hover:bg-surface-hover text-fg-secondary border border-border-subtle transition-all">
                  → Transferir setor
                </button>
                <button
                  onClick={async () => { await mudarEtiqueta(numeroAtivo, 'perdido'); await refetch(); setNumeroAtivo(null) }}
                  className="w-full py-1.5 text-[10px] font-semibold rounded-lg text-fg-tertiary hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors">
                  ✕ Arquivar
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Transferência de Setor */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowTransferModal(false) }}>
          <div className="bg-page border border-border-subtle rounded-xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-sm font-bold text-fg">Transferir Setor</h2>
              <button onClick={() => setShowTransferModal(false)} className="text-fg-tertiary hover:text-fg text-lg leading-none">×</button>
            </div>
            <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <p className="text-xs text-fg-secondary mb-3">Escolha o setor de destino para <strong>{conversa?.nome || numeroAtivo}</strong>:</p>
              {[
                { id: 'vendas', nome: 'Vendas' },
                { id: 'suporte', nome: 'Suporte' },
                { id: 'financeiro', nome: 'Financeiro' },
                { id: 'cursos', nome: 'Cursos' },
                { id: 'reciclagem', nome: 'Reciclagem CNH' },
                { id: 'mopp', nome: 'MOPP' },
                { id: 'transporte_escolar', nome: 'Transp. Escolar' },
                { id: '', nome: 'Pendente / Sem Setor' }
              ].map(s => (
                <button key={s.id}
                  onClick={async () => {
                    if (numeroAtivo) {
                      await mudarSetor(numeroAtivo, s.id);
                      await refetch();
                      await refetchConversa();
                    }
                    setShowTransferModal(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg text-xs font-semibold transition-colors border",
                    conversa?.setor === s.id
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-muted hover:bg-surface-hover border-border-subtle text-fg"
                  )}
                >
                  {s.nome}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
