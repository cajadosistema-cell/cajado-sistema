'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { cn } from '@/lib/utils'

interface ProgressoAula {
  id: string
  user_id: string
  curso: string
  licao_id: string
  status: 'iniciada' | 'concluida'
  score: number
}

interface Licao {
  id: string
  modulo: string
  titulo: string
  descricao: string
  icon: string
  nivel: 'Básico' | 'Intermediário' | 'Avançado'
}

const LICOES_INGLES: Licao[] = [
  // Módulo 1 - Primeiros Passos
  { id: 'eng_1_1', modulo: 'Módulo 1: Primeiros Passos', titulo: 'Greetings (Cumprimentos)', descricao: 'Aprenda a dizer oi, tchau e perguntar como as pessoas estão.', icon: '👋', nivel: 'Básico' },
  { id: 'eng_1_2', modulo: 'Módulo 1: Primeiros Passos', titulo: 'Verb To Be (Ser/Estar)', descricao: 'A base do inglês: I am, You are, He is.', icon: '🏗️', nivel: 'Básico' },
  { id: 'eng_1_3', modulo: 'Módulo 1: Primeiros Passos', titulo: 'Numbers & Ages', descricao: 'Aprenda a contar e dizer a sua idade.', icon: '🔢', nivel: 'Básico' },
  
  // Módulo 2 - Dia a Dia
  { id: 'eng_2_1', modulo: 'Módulo 2: Dia a Dia', titulo: 'Daily Routine', descricao: 'Acordar, trabalhar, comer. Como descrever seu dia.', icon: '⏰', nivel: 'Básico' },
  { id: 'eng_2_2', modulo: 'Módulo 2: Dia a Dia', titulo: 'Present Simple', descricao: 'Ações que acontecem com frequência e hábitos.', icon: '🔄', nivel: 'Básico' },
  { id: 'eng_2_3', modulo: 'Módulo 2: Dia a Dia', titulo: 'Food & Restaurant', descricao: 'Como pedir comida e falar de pratos favoritos.', icon: '🍔', nivel: 'Básico' },
  
  // Módulo 3 - Viagens e Passado
  { id: 'eng_3_1', modulo: 'Módulo 3: O Passado', titulo: 'Past Simple (Regular)', descricao: 'O que você fez ontem? Verbos terminados em -ed.', icon: '⏳', nivel: 'Intermediário' },
  { id: 'eng_3_2', modulo: 'Módulo 3: O Passado', titulo: 'Irregular Verbs', descricao: 'Os verbos rebeldes que mudam de forma no passado.', icon: '⚠️', nivel: 'Intermediário' },
  { id: 'eng_3_3', modulo: 'Módulo 3: O Passado', titulo: 'Travel & Airport', descricao: 'Vocabulário essencial para passar pela imigração e viajar.', icon: '✈️', nivel: 'Intermediário' },
]

export function TabIdiomas({ userId }: { userId: string }) {
  const supabase = createClient()
  const [aulaAtiva, setAulaAtiva] = useState<Licao | null>(null)
  
  // Chat state
  const [mensagens, setMensagens] = useState<{ role: 'user'|'assistant', content: string }[]>([])
  const [inputStr, setInputStr] = useState('')
  const [carregandoResposta, setCarregandoResposta] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const { data: progressos, refetch } = useSupabaseQuery<ProgressoAula>('curso_progresso', {
    filters: { user_id: userId, curso: 'ingles' }
  })

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [mensagens])

  const abrirAula = async (licao: Licao) => {
    setAulaAtiva(licao)
    setMensagens([
      { role: 'assistant', content: `Olá! Vamos começar a lição **${licao.titulo}**.\n\nVou te explicar brevemente sobre o tema, dar alguns exemplos e depois faremos um exercício prático, ok? Diga "Pronto" quando quiser começar.` }
    ])
    
    // Marca como iniciada no banco
    const progExistente = progressos.find(p => p.licao_id === licao.id)
    if (!progExistente) {
      await (supabase.from('curso_progresso') as any).insert({
        user_id: userId, curso: 'ingles', licao_id: licao.id, status: 'iniciada'
      })
      refetch()
    }
  }

  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputStr.trim() || carregandoResposta) return

    const novaMensagem = { role: 'user' as const, content: inputStr }
    setMensagens(prev => [...prev, novaMensagem])
    setInputStr('')
    setCarregandoResposta(true)

    try {
      const contexto = mensagens.map(m => `${m.role === 'user' ? 'Aluno' : 'Professora'}: ${m.content}`).join('\n')
      
      const prompt = `Você é a Elena, uma professora de inglês paciente e encorajadora.
Estamos na lição "${aulaAtiva?.titulo}" (Nível ${aulaAtiva?.nivel}).
O aluno acabou de enviar a seguinte mensagem: "${novaMensagem.content}"

Histórico da conversa:
${contexto}

Instruções:
1. Se o aluno disse que está pronto, comece a lição explicando o tema de forma clara e objetiva (use português para explicar).
2. Dê exemplos práticos (em inglês e com tradução).
3. Depois da explicação, faça UMA pergunta ou pequeno exercício prático para o aluno responder em inglês.
4. Se o aluno estiver respondendo um exercício, avalie a resposta. Corrija com gentileza se houver erro, ou elogie se acertar.
5. Quando a lição for concluída com sucesso, diga claramente a frase "[AULA_CONCLUIDA]" no final da sua mensagem.
Seja natural e amigável. Use emojis.`

      const resp = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'system', content: prompt }],
          max_tokens: 1500
        }),
      })

      const data = await resp.json()
      let textoRetorno = data.choices?.[0]?.message?.content || 'Ops, tive um problema de conexão. Podemos tentar de novo?'
      
      // Verifica se a aula foi concluída
      if (textoRetorno.includes('[AULA_CONCLUIDA]')) {
        textoRetorno = textoRetorno.replace('[AULA_CONCLUIDA]', '')
        // Atualiza banco para concluída
        await (supabase.from('curso_progresso') as any).update({ status: 'concluida' })
          .match({ user_id: userId, curso: 'ingles', licao_id: aulaAtiva?.id })
        refetch()
      }

      setMensagens(prev => [...prev, { role: 'assistant', content: textoRetorno.trim() }])
    } catch (e) {
      setMensagens(prev => [...prev, { role: 'assistant', content: '❌ Erro de comunicação com o servidor.' }])
    }
    setCarregandoResposta(false)
  }

  // Agrupando lições por módulo
  const modulos = Array.from(new Set(LICOES_INGLES.map(l => l.modulo)))
  
  const totalConcluidas = progressos.filter(p => p.status === 'concluida').length
  const pctGeral = Math.round((totalConcluidas / LICOES_INGLES.length) * 100) || 0

  if (aulaAtiva) {
    return (
      <div className="bg-surface border border-white/10 rounded-2xl flex flex-col h-[600px] overflow-hidden shadow-2xl relative">
        {/* Header da Aula */}
        <div className="bg-white/5 border-b border-white/10 p-4 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setAulaAtiva(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              ←
            </button>
            <div>
              <p className="text-[10px] text-fg-tertiary uppercase tracking-wider font-bold">{aulaAtiva.modulo}</p>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                {aulaAtiva.icon} {aulaAtiva.titulo}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
               {aulaAtiva.nivel}
             </span>
             {progressos.find(p => p.licao_id === aulaAtiva.id)?.status === 'concluida' && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 font-bold">
                  ✓ Concluída
                </span>
             )}
          </div>
        </div>

        {/* Chat Area */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth bg-[#080b13]">
          {mensagens.map((msg, idx) => (
            <div key={idx} className={cn("flex flex-col max-w-[85%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
              <span className="text-[10px] text-fg-disabled mb-1 ml-1">{msg.role === 'user' ? 'Você' : '👩‍🏫 Professora Elena'}</span>
              <div className={cn(
                "p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === 'user' 
                  ? "bg-amber-500/20 text-amber-50 border border-amber-500/30 rounded-tr-sm" 
                  : "bg-white/10 text-fg-secondary border border-white/5 rounded-tl-sm shadow-md"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {carregandoResposta && (
            <div className="flex items-center gap-2 mr-auto bg-white/5 p-3 rounded-2xl rounded-tl-sm border border-white/5">
              <div className="w-1.5 h-1.5 bg-fg-tertiary rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-fg-tertiary rounded-full animate-bounce delay-75" />
              <div className="w-1.5 h-1.5 bg-fg-tertiary rounded-full animate-bounce delay-150" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-surface shrink-0 relative z-10">
          <form onSubmit={enviarMensagem} className="flex gap-2">
            <input 
              type="text" 
              className="input flex-1 bg-black/40" 
              placeholder="Digite sua resposta em inglês (ou tire dúvidas em português)..."
              value={inputStr}
              onChange={e => setInputStr(e.target.value)}
              disabled={carregandoResposta}
              autoFocus
            />
            <button 
              type="submit" 
              disabled={!inputStr.trim() || carregandoResposta}
              className="btn-primary w-12 flex justify-center items-center"
            >
              ➤
            </button>
          </form>
          <p className="text-[9px] text-fg-disabled mt-2 text-center">
            A Elena entende se você errar a grafia ou mandar frases misturando português e inglês. Não tenha medo de errar!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Geral do Curso */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 bg-gradient-to-r from-blue-900/40 to-indigo-900/20 border border-blue-500/20 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            🇺🇸 Curso de Inglês IA
          </h2>
          <p className="text-sm text-blue-200/70 mt-1 max-w-lg">
            Aprenda no seu ritmo com a Elena atuando como sua professora particular. Aulas interativas focadas na conversação e prática real.
          </p>
        </div>
        <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-center min-w-[140px] relative z-10">
          <p className="text-[10px] text-fg-disabled uppercase font-bold tracking-widest mb-1">Progresso</p>
          <p className="text-3xl font-black text-blue-400">{pctGeral}%</p>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${pctGeral}%` }} />
          </div>
          <p className="text-[10px] text-fg-tertiary mt-2">{totalConcluidas} de {LICOES_INGLES.length} lições</p>
        </div>
      </div>

      {/* Grade de Módulos */}
      <div className="grid grid-cols-1 gap-8">
        {modulos.map(mod => {
          const licoesMod = LICOES_INGLES.filter(l => l.modulo === mod)
          const licoesConcluidasMod = licoesMod.filter(l => progressos.find(p => p.licao_id === l.id)?.status === 'concluida').length
          
          return (
            <div key={mod} className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-sm font-bold text-fg-secondary uppercase tracking-widest">{mod}</h3>
                <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-fg-tertiary">
                  {licoesConcluidasMod}/{licoesMod.length}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {licoesMod.map(licao => {
                  const prog = progressos.find(p => p.licao_id === licao.id)
                  const isConcluida = prog?.status === 'concluida'
                  const isIniciada = prog?.status === 'iniciada'
                  
                  return (
                    <button
                      key={licao.id}
                      onClick={() => abrirAula(licao)}
                      className={cn(
                        "text-left p-4 rounded-xl border transition-all flex flex-col gap-2 relative overflow-hidden group",
                        isConcluida ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40" :
                        isIniciada ? "bg-blue-500/5 border-blue-500/30 hover:border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]" :
                        "bg-surface border-white/5 hover:border-white/20 hover:bg-white/5"
                      )}
                    >
                      {/* Glow on hover */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex items-start justify-between w-full relative z-10">
                        <span className="text-2xl drop-shadow-md">{licao.icon}</span>
                        {isConcluida && <span className="text-emerald-400 text-sm">✅</span>}
                        {!isConcluida && isIniciada && <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold border border-blue-500/30">Em Andamento</span>}
                      </div>
                      
                      <div className="relative z-10 mt-1">
                        <h4 className="text-sm font-bold text-fg group-hover:text-amber-300 transition-colors">{licao.titulo}</h4>
                        <p className="text-[11px] text-fg-tertiary mt-1 line-clamp-2 leading-relaxed">
                          {licao.descricao}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
