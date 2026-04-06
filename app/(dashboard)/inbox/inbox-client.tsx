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

function MensagemBubble({ msg }: { msg: { tipo: string; texto: string; timestamp: string } }) {
  const isEnviada = msg.tipo === 'enviada' || msg.tipo === 'bot'
  const isInterna = msg.tipo === 'interna'

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
        <p className="text-[10px] mt-1 opacity-50 text-right">
          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ── Painel de contexto do cliente (dados do Cajado) ────────────

function PainelCliente({ numero }: { numero: string }) {
  const [cliente, setCliente] = useState<ClienteCajado | null>(null)
  const [vendas, setVendas] = useState<VendaCajado[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!numero) return
    const telefone = normalizePhone(numero)
    setLoading(true)

    Promise.all([
      supabase
        .from('clientes')
        .select('id, nome, telefone, total_compras, total_gasto, ultima_compra')
        .ilike('telefone', `%${telefone}%`)
        .limit(1)
        .single(),
    ]).then(([{ data }]) => {
      const cli = data as any;
      if (cli) {
        setCliente(cli as ClienteCajado)
        supabase
          .from('vendas')
          .select('id, numero, status, status_pagamento, total, total_a_receber, data_abertura')
          .eq('cliente_id', cli.id)
          .order('data_abertura', { ascending: false })
          .limit(5)
          .then(({ data }) => setVendas((data as VendaCajado[]) || []))
      } else {
        setCliente(null)
        setVendas([])
      }
      setLoading(false)
    })
  }, [numero])

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <p className="text-xs text-zinc-600">Buscando cliente...</p>
    </div>
  )

  if (!cliente) return (
    <div className="p-4">
      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
        <p className="text-sm text-zinc-400 mb-1">Cliente não encontrado</p>
        <p className="text-xs text-zinc-600 mb-3">Número: {numero}</p>
        <a
          href={`/clientes/novo?telefone=${numero}`}
          className="btn-primary text-xs block text-center"
        >
          + Criar cliente
        </a>
      </div>
    </div>
  )

  const aReceber = vendas.reduce((a, v) => a + (v.total_a_receber || 0), 0)

  return (
    <div className="p-4 space-y-4">
      {/* Info do cliente */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="text-amber-400 font-bold text-sm">{cliente.nome[0]}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">{cliente.nome}</p>
            <p className="text-xs text-zinc-500">{cliente.telefone}</p>
          </div>
        </div>
        <a href={`/clientes/${cliente.id}`} className="btn-secondary text-xs w-full block text-center">
          Ver perfil completo →
        </a>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-zinc-100">{cliente.total_compras}</p>
          <p className="text-[10px] text-zinc-500">compras</p>
        </div>
        <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-emerald-400">{formatCurrency(cliente.total_gasto)}</p>
          <p className="text-[10px] text-zinc-500">total gasto</p>
        </div>
      </div>

      {aReceber > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
          <p className="text-xs text-red-400 font-medium">Saldo em aberto</p>
          <p className="text-sm font-bold text-red-300">{formatCurrency(aReceber)}</p>
        </div>
      )}

      {/* Últimas OS */}
      {vendas.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Últimas OS</p>
          <div className="space-y-2">
            {vendas.map(v => (
              <a
                key={v.id}
                href={`/vendas/${v.id}`}
                className="block bg-zinc-800/50 rounded-lg p-2.5 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <p className="text-xs font-mono text-zinc-300">{v.numero}</p>
                  <p className="text-xs font-semibold text-zinc-200">{formatCurrency(v.total)}</p>
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-[10px] text-zinc-600">{formatDate(v.data_abertura)}</p>
                  <span className={cn('text-[10px] font-medium',
                    v.status_pagamento === 'pago' ? 'text-emerald-400' :
                    v.status_pagamento === 'parcial' ? 'text-blue-400' : 'text-amber-400'
                  )}>
                    {v.status_pagamento}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="space-y-2">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Ações rápidas</p>
        <a href={`/vendas/nova?cliente=${cliente.id}`} className="btn-secondary text-xs w-full block text-center">
          + Nova OS para este cliente
        </a>
        <a href={`/vendas?cliente=${cliente.id}`} className="btn-ghost text-xs w-full block text-center">
          Ver todas as OS
        </a>
      </div>
    </div>
  )
}

// ── Login com o backend inbox ──────────────────────────────────

function InboxLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginInbox(email, senha)
      onLogin()
    } catch {
      setError('Credenciais inválidas para o Inbox')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
      <div className="card w-full max-w-sm border border-zinc-800 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-2xl text-emerald-400">
            💬
          </div>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-1 text-center font-display">Inbox WhatsApp</h2>
        <p className="text-sm text-zinc-500 mb-6 text-center">Use as credenciais do backend integrado (Railway)</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1">E-mail</label>
            <input className="input w-full" placeholder="exemplo@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1">Senha</label>
            <input className="input w-full" placeholder="••••••••" type="password" value={senha} onChange={e => setSenha(e.target.value)} required />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-500/20 px-2 py-1.5 rounded">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2 hover:scale-105 transition-transform">
            {loading ? 'Conectando...' : 'Conectar agora'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────

export default function InboxClient() {
  const [autenticado, setAutenticado] = useState(false)
  const [numeroAtivo, setNumeroAtivo] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [nota, setNota] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { conversas, loading, refetch } = useInbox()
  const { conversa, refetch: refetchConversa } = useConversaDetalhe(autenticado ? numeroAtivo : null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cajado_inbox_token') : null
    if (token) setAutenticado(true)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversa?.mensagens?.length])

  if (!autenticado) return <InboxLogin onLogin={() => setAutenticado(true)} />

  const conversasFiltradas = conversas.filter(c =>
    c.nome?.toLowerCase().includes(filtro.toLowerCase()) ||
    c.numero?.includes(filtro) ||
    c.etiqueta?.includes(filtro.toLowerCase())
  )

  const totalUnread = conversas.reduce((a, c) => a + (c.unread || 0), 0)

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
    const pausar = conversa.botOn !== false
    await toggleBot(numeroAtivo, pausar)
    if (!pausar) await reativarBot(numeroAtivo)
    else await humanouAssumiu(numeroAtivo, 'Atendente')
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
                onClick={() => {
                  localStorage.removeItem('cajado_inbox_token')
                  setAutenticado(false)
                }}
                className="text-zinc-600 hover:text-red-400 text-xs transition-colors"
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
              ativa={c.numero === numeroAtivo}
              onClick={() => setNumeroAtivo(c.numero)}
            />
          ))}
        </div>
      </div>

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
                <button
                  onClick={handleToggleBot}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border transition-all duration-300 font-medium tracking-wide flex items-center gap-1.5',
                    conversa?.botOn !== false
                      ? 'border-zinc-700 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5'
                      : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  )}
                >
                  {conversa?.botOn !== false ? '🤖 Bot Ativo' : '👤 Atendimento Humano'}
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
                  placeholder={nota ? 'Escreva uma nota que apenas sua equipe verá...' : 'Digite sua mensagem para o cliente...'}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleEnviar()
                    }
                  }}
                />
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

      {/* ── Coluna 3: Contexto do cliente (Cajado) ───────────── */}
      <div className="w-72 shrink-0 border-l border-zinc-800 overflow-y-auto bg-[#05070a]">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Contexto Cajado
          </p>
        </div>
        {numeroAtivo ? (
          <PainelCliente numero={numeroAtivo} />
        ) : (
          <div className="p-6 text-center">
            <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center mx-auto mb-3 opacity-50">
              🗃️
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">As informações táticas do CRM Cajado aparecerão aqui automaticamente quando você selecionar um chat.</p>
          </div>
        )}
      </div>
    </div>
  )
}
