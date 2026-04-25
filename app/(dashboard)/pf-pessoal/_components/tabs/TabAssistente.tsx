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
  tipo: 'gasto' | 'receita' | 'agenda' | 'ocorrencia'
  dados: Record<string, any>
  label: string
  executada?: boolean
  status?: 'pending' | 'saving' | 'saved' | 'error'
  errorMsg?: string
}

// ── System Prompt com suporte a ações estruturadas ───────────
const SYSTEM_PROMPT = `Você é a Assistente Executiva IA do Sistema Cajado — plataforma de gestão integrada.

Suas responsabilidades:
- Ajudar o gestor com análises, estratégias e decisões de negócio
- Orientar sobre gestão de leads, CRM, vendas e pós-venda
- Auxiliar com organização pessoal, agenda e diário estratégico
- Interpretar dados financeiros e dar insights práticos
- **Registrar gastos, receitas, compromissos e ocorrências da equipe quando solicitado**

AÇÕES ESTRUTURADAS:
Quando o usuário pedir para registrar um gasto, receita, evento ou ocorrência, inclua ao final da sua resposta um bloco JSON:

Para gasto:
\`\`\`json
{"acao":"gasto","valor":50.00,"descricao":"Almoço restaurante","categoria":"alimentacao","forma_pagamento":"pix"}
\`\`\`

Para receita:
\`\`\`json
{"acao":"receita","valor":1500.00,"descricao":"Freelance design","categoria":"freelance"}
\`\`\`

Para agendar:
\`\`\`json
{"acao":"agenda","titulo":"Reunião com cliente","data_inicio":"2025-04-22T14:00:00","tipo":"reuniao"}
\`\`\`

Para registrar ocorrência da equipe:
\`\`\`json
{"acao":"ocorrencia","tipo":"erro","descricao":"Colaborador chegou atrasado ao plantão","colaborador_nome":"Pedro","impacto":"medio","modulo":"operacional"}
\`\`\`

CATEGORIAS válidas para gastos: alimentacao, transporte, saude, lazer, educacao, moradia, vestuario, tecnologia, investimento, outros
CATEGORIAS válidas para receitas: pro_labore, freelance, investimentos, aluguel, vendas, outros
FORMAS DE PAGAMENTO: pix, cartao_debito, cartao_credito, dinheiro, transferencia

REGRAS PARA OCORRÊNCIAS:
- Tipos válidos: "erro", "acerto", "alerta", "elogio"
- Impacto válido: "baixo", "medio", "alto"
- Módulos: "financeiro", "crm", "inbox", "vendas", "operacional"
- Se faltar algum dado, PERGUNTE antes de gerar o JSON

Regras gerais:
- Responda SEMPRE em português brasileiro
- Use formatação Markdown quando útil
- Para valores monetários, use formato R$ 1.000,00
- Seja direto e profissional
- Só inclua o JSON quando tiver TODOS os dados necessários`

// ── Sugestões rápidas ────────────────────────────────────────
const SUGESTOES = [
  '💸 Gastei R$ 80 de gasolina',
  '📅 Agendar reunião amanhã 10h',
  '🚨 Abrir ocorrência de erro',
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
      } else if (dados.acao === 'ocorrencia') {
        const tipoEmoji: Record<string, string> = { erro: '❌', acerto: '✅', alerta: '⚠️', elogio: '⭐' }
        const impactoLabel: Record<string, string> = { baixo: '🟢 Baixo', medio: '🟡 Médio', alto: '🔴 Alto' }
        acoes.push({
          tipo: 'ocorrencia',
          dados,
          label: `${tipoEmoji[dados.tipo] || '📋'} Ocorrência ${dados.tipo}: ${dados.descricao?.substring(0, 50)}${dados.descricao?.length > 50 ? '...' : ''} · ${impactoLabel[dados.impacto] || dados.impacto}`,
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
  const [colaboradores, setColaboradores] = useState<{id: string, nome: string}[]>([])
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: '0',
      role: 'ai',
      texto: 'Olá, chefe! 👋 Sou sua **Assistente Executiva IA**.\n\nPosso **registrar gastos, receitas, ocorrências da equipe** e **agendar compromissos**.\n\nExemplos:\n- *"Gastei R$ 50 de almoço"*\n- *"Abrir ocorrência de erro para o Pedro"*\n- *"Agendar reunião amanhã às 14h"*',
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
    // Carregar colaboradores para resolver nome -> ID nas ocorrências
    supabase.from('funcionarios').select('id, nome').eq('ativo', true).then(({ data }) => {
      if (data) setColaboradores(data as {id: string, nome: string}[])
    })
  }, [supabase])

  // ── Helper para atualizar status de uma ação ──────────────
  const setAcaoStatus = (msgId: string, acaoIdx: number, status: AcaoIA['status'], errorMsg?: string) => {
    setMensagens(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, acoes: m.acoes?.map((a, i) => i === acaoIdx ? { ...a, status, executada: status === 'saved', errorMsg } : a) }
        : m
    ))
  }

  // ── Execução automática (sem clique) ──────────────────────
  const executarAcaoAuto = async (msgId: string, acaoIdx: number) => {
    // Busca o estado atual diretamente (sem captura de closure)
    let uid = userId
    if (!uid) {
      const { data } = await supabase.auth.getUser()
      uid = data.user?.id || ''
      if (uid) setUserId(uid)
    }
    if (!uid) return

    // Precisa buscar a ação do estado atual
    setMensagens(prev => {
      const msg = prev.find(m => m.id === msgId)
      const acao = msg?.acoes?.[acaoIdx]
      if (!acao || acao.status === 'saving' || acao.status === 'saved') return prev
      return prev.map(m =>
        m.id === msgId
          ? { ...m, acoes: m.acoes?.map((a, i) => i === acaoIdx ? { ...a, status: 'saving' as const } : a) }
          : m
      )
    })

    // Busca a ação do estado (usando ref para evitar closure stale)
    setMensagens(prev => {
      const msg = prev.find(m => m.id === msgId)
      const acao = msg?.acoes?.[acaoIdx]
      if (!acao || acao.status !== 'saving') return prev

      // Executa a ação assincronamente
      salvarAcao(msgId, acaoIdx, acao, uid).catch(() => {})
      return prev
    })
  }

  const salvarAcao = async (msgId: string, acaoIdx: number, acao: AcaoIA, uid: string) => {
    try {
      if (acao.tipo === 'gasto') {
        const { error } = await (supabase.from('gastos_pessoais') as any).insert({
          user_id: uid,
          descricao: acao.dados.descricao || 'Gasto via IA',
          valor: Number(acao.dados.valor) || 0,
          categoria: acao.dados.categoria || 'outros',
          forma_pagamento: acao.dados.forma_pagamento || 'pix',
          data: new Date().toISOString().split('T')[0],
          tipo: 'variavel',
          pago: true,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        success(`✅ Gasto de R$ ${Number(acao.dados.valor).toFixed(2)} registrado automaticamente!`)

      } else if (acao.tipo === 'receita') {
        const { error } = await (supabase.from('receitas_pessoais') as any).insert({
          user_id: uid,
          descricao: acao.dados.descricao || 'Receita via IA',
          valor: Number(acao.dados.valor) || 0,
          categoria: acao.dados.categoria || 'Outros',
          data: new Date().toISOString().split('T')[0],
          recorrente: false,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        success(`✅ Receita de R$ ${Number(acao.dados.valor).toFixed(2)} registrada automaticamente!`)

      } else if (acao.tipo === 'agenda') {
        const dataInicio = acao.dados.data_inicio
          ? new Date(acao.dados.data_inicio).toISOString()
          : new Date(Date.now() + 86400000).toISOString()
        const { error } = await (supabase.from('agenda_eventos') as any).insert({
          user_id: uid,
          titulo: acao.dados.titulo || 'Evento via IA',
          tipo: acao.dados.tipo || 'compromisso',
          data_inicio: dataInicio,
          status: 'pendente',
          prioridade: 'normal',
          cor: '#3b82f6',
          origem: 'ia',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        success(`📅 "${acao.dados.titulo}" agendado automaticamente!`)

      } else if (acao.tipo === 'ocorrencia') {
        let colaboradorId: string | null = null
        if (acao.dados.colaborador_nome && colaboradores.length > 0) {
          const nomeBusca = acao.dados.colaborador_nome.toLowerCase()
          const encontrado = colaboradores.find(c =>
            c.nome.toLowerCase().includes(nomeBusca) || nomeBusca.includes(c.nome.toLowerCase().split(' ')[0])
          )
          colaboradorId = encontrado?.id || null
        }
        const tiposValidos = ['erro', 'acerto', 'alerta', 'elogio']
        const impactosValidos = ['baixo', 'medio', 'alto']
        const { error } = await (supabase.from('ocorrencias') as any).insert({
          tipo: tiposValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'alerta',
          descricao: acao.dados.descricao || 'Ocorrência registrada via IA',
          colaborador_id: colaboradorId,
          modulo: acao.dados.modulo || null,
          impacto: impactosValidos.includes(acao.dados.impacto) ? acao.dados.impacto : 'medio',
          resolvida: false,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        const colaboradorNome = acao.dados.colaborador_nome || ''
        success(`📋 Ocorrência ${colaboradorNome ? `para ${colaboradorNome}` : ''} registrada automaticamente!`)
      }
    } catch (err: any) {
      console.error('[Assistente] Falha ao salvar automaticamente:', err)
      setAcaoStatus(msgId, acaoIdx, 'error', err.message || 'Erro ao salvar')
      toastError('Falha ao salvar: ' + (err.message || 'tente novamente'))
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
          if (acoes.length > 0) {
            // Define as ações com status 'pending'
            const acoesComStatus = acoes.map(a => ({ ...a, status: 'pending' as const }))
            setMensagens(prev =>
              prev.map(m => m.id === aiMsgId ? { ...m, acoes: acoesComStatus } : m)
            )
            // Executa automaticamente após 600ms (tempo para UX visualizar)
            setTimeout(() => {
              acoesComStatus.forEach((_, idx) => executarAcaoAuto(aiMsgId, idx))
            }, 600)
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
    <div className="bg-surface border border-white/5 rounded-2xl flex flex-col h-[620px] overflow-hidden shadow-2xl relative">

      {/* Glow decorativo */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-fuchsia-500/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/8 rounded-full blur-[80px] pointer-events-none" />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-border-subtle/80 bg-[#0a0d16]/80 flex items-center gap-3 relative z-10 shrink-0">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(217,70,239,0.3)]">
            <span className="text-lg">🤖</span>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0d16]" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-fg">Assistente IA Executiva</h2>
          <p className="text-[10px] text-fuchsia-400 font-medium">Registra gastos, receitas e agenda • {modelo.split('/')[1]}</p>
        </div>
        <select
          value={modelo}
          onChange={e => setModelo(e.target.value)}
          className="text-[10px] bg-muted border border-border-subtle text-fg-secondary rounded-lg px-2 py-1 focus:outline-none focus:border-fuchsia-500/40 cursor-pointer"
        >
          <option value="openai/gpt-4o-mini">GPT-4o mini 🚀</option>
          <option value="openai/gpt-4o">GPT-4o 🧠</option>
          <option value="anthropic/claude-3-haiku">Claude Haiku ⚡</option>
          <option value="anthropic/claude-3.5-sonnet">Claude Sonnet 💎</option>
          <option value="google/gemini-flash-1.5">Gemini Flash 🔥</option>
          <option value="meta-llama/llama-3.1-8b-instruct:free">Llama 3.1 (Free)</option>
        </select>
        <button onClick={limparChat} title="Limpar" className="text-fg-disabled hover:text-fg-secondary text-xs px-2 py-1 rounded-lg hover:bg-muted">🗑</button>
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
                className="text-left text-[11px] text-fg-secondary border border-border-subtle bg-page/50 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5 hover:text-fuchsia-300 rounded-xl px-3 py-2 transition-all leading-snug"
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
                      : 'bg-muted text-fg border border-border-subtle/50 rounded-tl-sm'
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

              {/* ── Badges de ação automática ─────────────── */}
              {isAi && msg.acoes && msg.acoes.length > 0 && (
                <div className="ml-9 mt-2 flex flex-col gap-1.5 w-full max-w-[72%]">
                  {msg.acoes.map((acao, idx) => {
                    const tipoEmoji = acao.tipo === 'gasto' ? '💸' : acao.tipo === 'receita' ? '💰' : acao.tipo === 'ocorrencia' ? '📋' : '📅'
                    if (acao.status === 'saving' || (!acao.status && !acao.executada)) {
                      return (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300">
                          <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          <span>Salvando automaticamente...</span>
                        </div>
                      )
                    }
                    if (acao.status === 'saved' || acao.executada) {
                      return (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border bg-emerald-500/10 border-emerald-500/25 text-emerald-400">
                          <span className="text-sm">✅</span>
                          <span className="font-medium">Registrado automaticamente</span>
                          <span className="ml-auto text-emerald-600 text-[10px]">{tipoEmoji} {acao.tipo}</span>
                        </div>
                      )
                    }
                    if (acao.status === 'error') {
                      return (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border bg-red-500/10 border-red-500/25 text-red-400">
                          <span className="text-sm">❌</span>
                          <span className="flex-1">{acao.errorMsg || 'Erro ao salvar'}</span>
                          <button
                            onClick={() => executarAcaoAuto(msg.id, idx)}
                            className="shrink-0 px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300 text-[10px] font-medium transition-colors"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      )
                    }
                    // Status 'pending' — aguardando execução
                    return (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border bg-blue-500/10 border-blue-500/20 text-blue-300 animate-pulse">
                        <span className="text-sm">{tipoEmoji}</span>
                        <span>{acao.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <div ref={chatEndRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────── */}
      <div className="p-4 border-t border-border-subtle/80 bg-[#0a0d16] relative z-10 shrink-0">
        <div className="flex items-end gap-2 bg-[#111625] border border-border-subtle/80 rounded-2xl px-3 py-2 focus-within:border-fuchsia-500/40 transition-colors">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent text-sm text-fg placeholder-zinc-600 resize-none max-h-28 min-h-[40px] py-2 px-1 focus:outline-none focus:ring-0"
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
                  : 'text-fg-tertiary hover:text-fuchsia-400 hover:bg-muted'
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
              className="bg-fuchsia-600 hover:bg-fuchsia-500 active:scale-95 disabled:bg-muted disabled:text-fg-disabled text-white p-2.5 rounded-xl transition-all shadow-lg disabled:shadow-none"
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
