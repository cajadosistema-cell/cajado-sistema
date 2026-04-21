'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/toast'

// ── Types ────────────────────────────────────────────────────
interface Mensagem {
  id: string
  role: 'user' | 'ai'
  texto: string
  loading?: boolean
  erro?: boolean
}

// ── System Prompt ────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é a Assistente Executiva IA do Sistema Cajado — plataforma de gestão integrada para negócios.

Suas responsabilidades:
- Ajudar o gestor com análises, estratégias e decisões de negócio
- Orientar sobre gestão de leads, CRM, vendas e pós-venda
- Auxiliar com organização pessoal, agenda e diário estratégico
- Interpretar dados financeiros e dar insights práticos
- Ser direta, profissional e objetiva — sem enrolação

Regras:
- Responda SEMPRE em português brasileiro
- Use formatação Markdown quando útil (listas, negrito)
- Para valores monetários, use formato R$ 1.000,00
- Se não souber algo, diga claramente em vez de inventar
- Mantenha respostas concisas (máx 3 parágrafos) a menos que pedido mais detalhe`

// ── Sugestões rápidas ────────────────────────────────────────
const SUGESTOES = [
  '📊 Como melhorar meu funil de vendas?',
  '💡 Estratégias para reativar clientes inativos',
  '📅 Me ajude a planejar minha semana',
  '💰 Como calcular o ticket médio ideal?',
]

// ── Formata markdown simples → HTML básico ───────────────────
function formatarTexto(texto: string) {
  return texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/((<li>[\s\S]*?<\/li>\s*)+)/, '<ul class="list-disc pl-4 space-y-1">$1</ul>')
    .replace(/\n/g, '<br/>')
}

// ── Componente principal ─────────────────────────────────────
export function TabAssistente() {
  const { warning } = useToast()
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: '0',
      role: 'ai',
      texto: 'Olá, chefe! 👋 Sou sua **Assistente Executiva IA**, integrada ao Sistema Cajado via OpenRouter.\n\nComo posso ajudar hoje? Pode me perguntar sobre leads, vendas, planejamento ou qualquer estratégia de negócio.',
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

  // ── Enviar mensagem ────────────────────────────────────────
  const handleEnviar = useCallback(async (textoOverride?: string) => {
    const textoEnvio = (textoOverride ?? input).trim()
    if (!textoEnvio || loading) return

    const userMsgId = Date.now().toString()
    const aiMsgId = (Date.now() + 1).toString()

    // Adiciona msg do usuário
    setMensagens(prev => [
      ...prev,
      { id: userMsgId, role: 'user', texto: textoEnvio },
      { id: aiMsgId, role: 'ai', texto: '', loading: true },
    ])
    setInput('')
    setLoading(true)

    // Monta histórico para contexto (últimas 8 msgs)
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

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Erro na resposta da IA')
      }

      const resposta: string = data.result ?? '(sem resposta)'

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
        if (idx >= resposta.length) clearInterval(interval)
      }, 12)

    } catch (err: any) {
      setMensagens(prev =>
        prev.map(m =>
          m.id === aiMsgId
            ? { ...m, loading: false, erro: true, texto: `❌ ${err.message || 'Falha ao conectar com a IA. Verifique a chave OPENROUTER_API_KEY.'}` }
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
      warning('Reconhecimento de voz não é suportado neste navegador. Use o Chrome ou Safari.')
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
    r.onend = () => setIsListening(false)
    r.start()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  const limparChat = () => {
    setMensagens([{
      id: Date.now().toString(),
      role: 'ai',
      texto: 'Chat reiniciado. Como posso ajudar?',
    }])
  }

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl flex flex-col h-[580px] overflow-hidden shadow-2xl relative">

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
          <p className="text-[10px] text-fuchsia-400 font-medium">Powered by OpenRouter · {modelo.split('/')[1]}</p>
        </div>
        {/* Seletor de modelo */}
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
        <button
          onClick={limparChat}
          title="Limpar conversa"
          className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs px-2 py-1 rounded-lg hover:bg-zinc-800"
        >
          🗑
        </button>
      </div>

      {/* ── Mensagens ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 relative z-10 scroll-smooth custom-scrollbar">

        {/* Sugestões (só quando 1 msg) */}
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
            <div key={msg.id} className={cn('flex', isAi ? 'justify-start' : 'justify-end')}>
              {isAi && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-xs shrink-0 mr-2 mt-0.5 shadow-[0_0_10px_rgba(217,70,239,0.3)]">
                  🤖
                </div>
              )}
              <div
                className={cn(
                  'max-w-[82%] md:max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                  isAi
                    ? msg.erro
                      ? 'bg-red-900/30 text-red-300 border border-red-500/20 rounded-tl-sm'
                      : 'bg-zinc-800 text-zinc-200 border border-zinc-700/50 rounded-tl-sm'
                    : 'bg-fuchsia-600 text-white rounded-tr-sm shadow-[0_4px_15px_rgba(192,38,211,0.25)]'
                )}
              >
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
            placeholder="Mande uma ordem... (Enter para enviar)"
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
            {/* Mic */}
            <button
              onClick={handleListen}
              className={cn(
                'p-2.5 rounded-xl transition-all',
                isListening
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                  : 'text-zinc-500 hover:text-fuchsia-400 hover:bg-zinc-800'
              )}
              title={isListening ? 'Gravando...' : 'Falar'}
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
            {/* Enviar */}
            <button
              onClick={() => handleEnviar()}
              disabled={!input.trim() || loading}
              className="bg-fuchsia-600 hover:bg-fuchsia-500 active:bg-fuchsia-700 active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600 text-white p-2.5 rounded-xl transition-all shadow-lg disabled:shadow-none"
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
          IA pode cometer erros. Sempre valide decisões importantes.
        </p>
      </div>
    </div>
  )
}
