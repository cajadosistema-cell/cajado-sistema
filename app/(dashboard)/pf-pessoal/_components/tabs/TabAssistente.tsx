'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/toast'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────
interface Mensagem {
  id: string
  role: 'user' | 'ai'
  texto: string
  loading?: boolean
  erro?: boolean
  acoes?: AcaoIA[]
}

interface AcaoIA {
  tipo: 'gasto' | 'receita' | 'agenda' | 'tarefa'
  dados: Record<string, any>
  label: string
  executada?: boolean
}

// ── System Prompt com suporte a ações estruturadas ───────────
const SYSTEM_PROMPT = `Você é a Assistente Executiva IA do Sistema Cajado — plataforma de gestão integrada.

Suas responsabilidades:
- Ajudar o gestor com análises, estratégias e decisões de negócio
- Orientar sobre gestão de leads, CRM, vendas e pós-venda
- Auxiliar com organização pessoal, agenda e diário estratégico
- Interpretar dados financeiros e dar insights práticos
- **Registrar gastos, receitas e compromissos quando solicitado**

AÇÕES ESTRUTURADAS:
Quando o usuário pedir para registrar um gasto, receita ou evento, inclua ao final da sua resposta um bloco JSON assim:

\`\`\`json
{"acao":"gasto","valor":50.00,"descricao":"Almoço restaurante","categoria":"Alimentação"}
\`\`\`

Para receita:
\`\`\`json
{"acao":"receita","valor":1500.00,"descricao":"Freelance design","categoria":"Renda Extra"}
\`\`\`

Para agendar:
\`\`\`json
{"acao":"agenda","titulo":"Reunião com cliente","data_inicio":"2025-04-22T14:00:00","tipo":"reuniao"}
\`\`\`

Regras:
- Responda SEMPRE em português brasileiro
- Use formatação Markdown quando útil
- Para valores monetários, use formato R$ 1.000,00
- Seja direto e profissional
- Quando detectar pedido de registro, SEMPRE inclua o bloco JSON`

// ── Sugestões rápidas ────────────────────────────────────────
const SUGESTOES = [
  '💸 Gastei R$ 80 de gasolina',
  '📅 Agendar reunião amanhã 10h',
  '💡 Como melhorar meu funil de vendas?',
  '💰 Recebi R$ 500 de um freela',
]

// ── Formata markdown simples → HTML básico ───────────────────
function formatarTexto(texto: string) {
  // Remove blocos JSON antes de formatar
  const semJson = texto.replace(/```json[\s\S]*?```/g, '').trim()
  return semJson
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/((<li>[\s\S]*?<\/li>\s*)+)/, '<ul class="list-disc pl-4 space-y-1">$1</ul>')
    .replace(/\n/g, '<br/>')
}

// ── Extrai ações JSON do texto da IA ────────────────────────
function extrairAcoes(texto: string): AcaoIA[] {
  const acoes: AcaoIA[] = []
  const regex = /```json\s*([\s\S]*?)```/g
  let match
  while ((match = regex.exec(texto)) !== null) {
    try {
      const dados = JSON.parse(match[1].trim())
      if (dados.acao === 'gasto') {
        acoes.push({
          tipo: 'gasto',
          dados,
          label: `💸 Registrar gasto: R$ ${dados.valor?.toFixed(2)} — ${dados.descricao}`,
        })
      } else if (dados.acao === 'receita') {
        acoes.push({
          tipo: 'receita',
          dados,
          label: `💰 Registrar receita: R$ ${dados.valor?.toFixed(2)} — ${dados.descricao}`,
        })
      } else if (dados.acao === 'agenda') {
        acoes.push({
          tipo: 'agenda',
          dados,
          label: `📅 Agendar: ${dados.titulo} — ${dados.data_inicio ? new Date(dados.data_inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}`,
        })
      }
    } catch {}
  }
  return acoes
}

// ── Categorias padrão ────────────────────────────────────────
const CATEGORIAS_GASTO = [
  'Alimentação','Transporte','Saúde','Lazer','Educação',
  'Moradia','Vestuário','Tecnologia','Investimento','Outros'
]

// ── Componente principal ─────────────────────────────────────
export function TabAssistente() {
  const { warning, success, error: toastError } = useToast()
  const supabase = createClient()
  const [userId, setUserId] = useState('')
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: '0',
      role: 'ai',
      texto: 'Olá, chefe! 👋 Sou sua **Assistente Executiva IA**.\n\nPosso **registrar gastos e receitas**, **agendar compromissos** e responder sobre estratégia de negócios.\n\nDita um comando de voz ou escreva algo como:\n- *"Gastei R$ 50 de almoço"*\n- *"Recebi R$ 500 de freela"*\n- *"Agenda reunião amanhã às 14h"*',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [modelo, setModelo] = useState('openai/gpt-4o-mini')

  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [supabase])

  // ── Executar ação estruturada no Supabase ──────────────────
  const executarAcao = async (msgId: string, acaoIdx: number) => {
    const msg = mensagens.find(m => m.id === msgId)
    const acao = msg?.acoes?.[acaoIdx]
    if (!acao || acao.executada || !userId) return

    try {
      if (acao.tipo === 'gasto') {
        const { error } = await (supabase.from('gastos_pessoais') as any).insert({
          user_id: userId,
          descricao: acao.dados.descricao || 'Gasto via IA',
          valor: Number(acao.dados.valor) || 0,
          categoria: acao.dados.categoria || 'Outros',
          data: new Date().toISOString().split('T')[0],
          tipo: 'variavel',
          pago: true,
        })
        if (error) throw error
        success(`✅ Gasto de R$ ${Number(acao.dados.valor).toFixed(2)} registrado!`)
      } else if (acao.tipo === 'receita') {
        const { error } = await (supabase.from('receitas_pessoais') as any).insert({
          user_id: userId,
          descricao: acao.dados.descricao || 'Receita via IA',
          valor: Number(acao.dados.valor) || 0,
          categoria: acao.dados.categoria || 'Outros',
          data: new Date().toISOString().split('T')[0],
          recorrente: false,
        })
        if (error) throw error
        success(`✅ Receita de R$ ${Number(acao.dados.valor).toFixed(2)} registrada!`)
      } else if (acao.tipo === 'agenda') {
        const dataInicio = acao.dados.data_inicio
          ? new Date(acao.dados.data_inicio).toISOString()
          : new Date(Date.now() + 86400000).toISOString()
        const { error } = await (supabase.from('agenda_eventos') as any).insert({
          user_id: userId,
          titulo: acao.dados.titulo || 'Evento via IA',
          tipo: acao.dados.tipo || 'compromisso',
          data_inicio: dataInicio,
          status: 'pendente',
          prioridade: 'normal',
          cor: '#3b82f6',
          origem: 'ia',
        })
        if (error) throw error
        success(`📅 Evento "${acao.dados.titulo}" agendado!`)
      }

      // Marcar como executada
      setMensagens(prev => prev.map(m =>
        m.id === msgId
          ? {
              ...m,
              acoes: m.acoes?.map((a, i) => i === acaoIdx ? { ...a, executada: true } : a)
            }
          : m
      ))
    } catch (err: any) {
      toastError('Erro ao registrar: ' + (err.message || 'tente novamente'))
    }
  }

  // ── Enviar mensagem ────────────────────────────────────────
  const handleEnviar = useCallback(async (textoOverride?: string) => {
    const textoEnvio = (textoOverride ?? input).trim()
    if (!textoEnvio || loading) return

    const userMsgId = Date.now().toString()
    const aiMsgId = (Date.now() + 1).toString()

    setMensagens(prev => [
      ...prev,
      { id: userMsgId, role: 'user', texto: textoEnvio },
      { id: aiMsgId, role: 'ai', texto: '', loading: true },
    ])
    setInput('')
    setLoading(true)

    const historico = mensagens.slice(-8).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.texto,
    }))

    try {
      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textoEnvio,
          model: modelo,
          systemInstruction: SYSTEM_PROMPT,
          context: historico.length > 0
            ? historico.map(h => `${h.role === 'assistant' ? 'IA' : 'Usuário'}: ${h.content}`).join('\n')
            : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro na resposta da IA')

      const resposta: string = data.result ?? '(sem resposta)'
      const acoes = extrairAcoes(resposta)

      // Efeito de digitação
      setMensagens(prev =>
        prev.map(m => m.id === aiMsgId ? { ...m, loading: false, texto: '' } : m)
      )

      let idx = 0
      const interval = setInterval(() => {
        idx++
        setMensagens(prev =>
          prev.map(m =>
            m.id === aiMsgId
              ? { ...m, texto: resposta.slice(0, idx) }
              : m
          )
        )
        if (idx >= resposta.length) {
          clearInterval(interval)
          // Após animação, adicionar ações
          if (acoes.length > 0) {
            setMensagens(prev =>
              prev.map(m => m.id === aiMsgId ? { ...m, acoes } : m)
            )
          }
        }
      }, 10)

    } catch (err: any) {
      setMensagens(prev =>
        prev.map(m =>
          m.id === aiMsgId
            ? { ...m, loading: false, erro: true, texto: `❌ ${err.message || 'Falha ao conectar com a IA.'}` }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }, [input, loading, mensagens, modelo])

  // ── Voz ───────────────────────────────────────────────────
  const handleListen = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      warning('Reconhecimento de voz não é suportado neste navegador.')
      return
    }
    const r = new SR()
    recognitionRef.current = r
    r.lang = 'pt-BR'
    r.continuous = false
    r.interimResults = true
    r.onstart = () => setIsListening(true)
    r.onresult = (e: any) => {
      setInput(Array.from(e.results).map((x: any) => x[0].transcript).join(''))
    }
    r.onerror = () => setIsListening(false)
    r.onend   = () => {
      setIsListening(false)
      // Auto-envia ao parar de falar
      setTimeout(() => {
        if (textareaRef.current?.value.trim()) handleEnviar(textareaRef.current.value)
      }, 400)
    }
    r.start()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  const limparChat = () => {
    setMensagens([{ id: Date.now().toString(), role: 'ai', texto: 'Chat reiniciado. Como posso ajudar?' }])
  }

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl flex flex-col h-[620px] overflow-hidden shadow-2xl relative">

      {/* Glow decorativo */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-fuchsia-500/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/8 rounded-full blur-[80px] pointer-events-none" />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-zinc-800/80 bg-[#0a0d16]/80 flex items-center gap-3 relative z-10 shrink-0">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(217,70,239,0.3)]">
            <span className="text-lg">🤖</span>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0d16]" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-zinc-100">Assistente IA Executiva</h2>
          <p className="text-[10px] text-fuchsia-400 font-medium">Registra gastos, receitas e agenda • {modelo.split('/')[1]}</p>
        </div>
        <select
          value={modelo}
          onChange={e => setModelo(e.target.value)}
          className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg px-2 py-1 focus:outline-none focus:border-fuchsia-500/40 cursor-pointer"
        >
          <option value="openai/gpt-4o-mini">GPT-4o mini 🚀</option>
          <option value="openai/gpt-4o">GPT-4o 🧠</option>
          <option value="anthropic/claude-3-haiku">Claude Haiku ⚡</option>
          <option value="anthropic/claude-3.5-sonnet">Claude Sonnet 💎</option>
          <option value="google/gemini-flash-1.5">Gemini Flash 🔥</option>
          <option value="meta-llama/llama-3.1-8b-instruct:free">Llama 3.1 (Free)</option>
        </select>
        <button onClick={limparChat} title="Limpar" className="text-zinc-600 hover:text-zinc-400 text-xs px-2 py-1 rounded-lg hover:bg-zinc-800">🗑</button>
      </div>

      {/* ── Mensagens ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 relative z-10 scroll-smooth custom-scrollbar">

        {/* Sugestões iniciais */}
        {mensagens.length === 1 && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            {SUGESTOES.map(s => (
              <button
                key={s}
                onClick={() => handleEnviar(s)}
                className="text-left text-[11px] text-zinc-400 border border-zinc-800 bg-zinc-900/50 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5 hover:text-fuchsia-300 rounded-xl px-3 py-2 transition-all leading-snug"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {mensagens.map(msg => {
          const isAi = msg.role === 'ai'
          return (
            <div key={msg.id} className={cn('flex flex-col', isAi ? 'items-start' : 'items-end')}>
              <div className={cn('flex', isAi ? 'justify-start' : 'justify-end')}>
                {isAi && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-xs shrink-0 mr-2 mt-0.5">
                    🤖
                  </div>
                )}
                <div className={cn(
                  'max-w-[82%] md:max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                  isAi
                    ? msg.erro
                      ? 'bg-red-900/30 text-red-300 border border-red-500/20 rounded-tl-sm'
                      : 'bg-zinc-800 text-zinc-200 border border-zinc-700/50 rounded-tl-sm'
                    : 'bg-fuchsia-600 text-white rounded-tr-sm shadow-[0_4px_15px_rgba(192,38,211,0.25)]'
                )}>
                  {msg.loading ? (
                    <span className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </span>
                  ) : isAi ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: formatarTexto(msg.texto) }}
                      className="prose prose-sm prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_strong]:text-white"
                    />
                  ) : (
                    <p style={{ whiteSpace: 'pre-wrap' }}>{msg.texto}</p>
                  )}
                </div>
              </div>

              {/* ── Botões de ação estruturada ─────────────── */}
              {isAi && msg.acoes && msg.acoes.length > 0 && (
                <div className="ml-9 mt-2 flex flex-col gap-1.5 w-full max-w-[72%]">
                  {msg.acoes.map((acao, idx) => (
                    <button
                      key={idx}
                      onClick={() => executarAcao(msg.id, idx)}
                      disabled={acao.executada}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left',
                        acao.executada
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 cursor-not-allowed'
                          : acao.tipo === 'gasto'
                            ? 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20'
                            : acao.tipo === 'receita'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20'
                              : 'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20'
                      )}
                    >
                      {acao.executada ? '✅ Registrado no sistema' : acao.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div ref={chatEndRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────── */}
      <div className="p-4 border-t border-zinc-800/80 bg-[#0a0d16] relative z-10 shrink-0">
        <div className="flex items-end gap-2 bg-[#111625] border border-zinc-800/80 rounded-2xl px-3 py-2 focus-within:border-fuchsia-500/40 transition-colors">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 resize-none max-h-28 min-h-[40px] py-2 px-1 focus:outline-none focus:ring-0"
            rows={1}
            placeholder="Diga: Gastei R$ 50, Recebi R$ 200, Agendar reunião..."
            value={input}
            disabled={loading}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="flex gap-1 pb-1 shrink-0">
            <button
              onClick={handleListen}
              className={cn(
                'p-2.5 rounded-xl transition-all',
                isListening
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                  : 'text-zinc-500 hover:text-fuchsia-400 hover:bg-zinc-800'
              )}
              title={isListening ? 'Gravando — solte para enviar' : 'Falar'}
            >
              {isListening ? (
                <span className="w-3 h-3 bg-red-500 rounded-full block animate-ping" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
            </button>
            <button
              onClick={() => handleEnviar()}
              disabled={!input.trim() || loading}
              className="bg-fuchsia-600 hover:bg-fuchsia-500 active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600 text-white p-2.5 rounded-xl transition-all shadow-lg disabled:shadow-none"
            >
              {loading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-zinc-700 text-center mt-2">
          🎤 Fale um comando · IA registra gastos, receitas e agenda automaticamente
        </p>
      </div>
    </div>
  )
}
