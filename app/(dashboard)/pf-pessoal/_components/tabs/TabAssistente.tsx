'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// Simulação de IA Local Executiva
export function TabAssistente() {
  const [mensagens, setMensagens] = useState([
    { id: '1', role: 'ai', texto: 'Olá, chefe. Sou a sua Assistente Executiva. Como posso ajudar com sua agenda, registros no diário ou lançamentos de gastos hoje?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // Referência para podermos parar a gravação manualmente se necessário
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const handleEnviar = async () => {
    if (!input.trim() || loading) return

    const userText = input
    setMensagens(prev => [...prev, { id: Date.now().toString(), role: 'user', texto: userText }])
    setInput('')
    setLoading(true)

    // Simulador de Lógica NLP (Agendar, Inserir Gasto, Diário)
    setTimeout(() => {
      let resposta = ''
      const l = userText.toLowerCase()

      if (l.includes('gasto') || l.includes('comprei') || l.includes('paguei') || l.includes('lançar')) {
        resposta = 'Ouvido! Identifiquei a intenção de registrar um Gasto Pessoal. Os dados foram computados na sua aba de Lançamentos.'
      } else if (l.includes('diario') || l.includes('diário') || l.includes('anotar') || l.includes('pensamento')) {
        resposta = 'Perfeito. Registrei essa nota no seu Diário de Bordo para futura análise estratégica.'
      } else if (l.includes('reunião') || l.includes('reuniao') || l.includes('agenda') || l.includes('lembrar')) {
        resposta = 'Agendamento mapeado. Adicionei à sua lista de pendências do Gestão Pessoal / CRM.'
      } else {
        resposta = 'Entendido, chefe. O sistema está sendo alimentado e estruturado com base nas suas ordens.'
      }

      setMensagens(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', texto: resposta }])
      setLoading(false)
    }, 1500)
  }

  const handleListen = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não é suportado no seu navegador atual. Use o Safari (iOS) ou Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('')
      setInput(transcript)
    }

    recognition.onerror = (event: any) => {
      console.error('Erro no reconhecimento de voz:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl flex flex-col h-[500px] overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Header Assitente */}
      <div className="px-6 py-4 border-b border-zinc-800/80 bg-[#0a0d16]/80 flex items-center gap-4 relative z-10">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(217,70,239,0.3)]">
          <span className="text-xl">🤖</span>
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-100">Assistente IA Executiva</h2>
          <p className="text-xs text-fuchsia-400 font-medium">Online e pronta para ordens</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 relative z-10 scroll-smooth">
        {mensagens.map(msg => {
          const isAi = msg.role === 'ai'
          return (
            <div key={msg.id} className={cn("flex", isAi ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] md:max-w-[70%] p-3 px-4 rounded-2xl text-sm leading-relaxed",
                  isAi
                    ? "bg-zinc-800 text-zinc-200 rounded-tl-sm border border-zinc-700/50"
                    : "bg-fuchsia-600 text-white rounded-tr-sm shadow-[0_4px_15px_rgba(192,38,211,0.3)]"
                )}
              >
                {msg.texto}
              </div>
            </div>
          )
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm border border-zinc-700/50">
              <span className="flex gap-1 items-center h-5">
                <span className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-800/80 bg-[#0a0d16] relative z-10">
        <div className="flex items-end gap-2 relative">
          <textarea
            className="input w-full bg-zinc-900 border-zinc-700 resize-none rounded-xl pr-14 custom-scrollbar text-sm"
            rows={1}
            style={{ minHeight: '48px', maxHeight: '120px' }}
            placeholder="Mande sua ordem... (Ex: Lance R$150 de uber no meu cartão)"
            value={input}
            onChange={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
              setInput(e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleEnviar()
              }
            }}
          />
          <div className="absolute right-2 bottom-1.5 flex items-center gap-1.5">
            <button
              onClick={handleListen}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                isListening 
                  ? "bg-red-500/20 text-red-500 animate-pulse border border-red-500/50" 
                  : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
              )}
              title={isListening ? "Gravando... Clique para parar" : "Falar com a Assistente"}
            >
              {isListening ? (
                 <span className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              )}
            </button>
            <button
              onClick={handleEnviar}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white flex items-center justify-center disabled:opacity-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
