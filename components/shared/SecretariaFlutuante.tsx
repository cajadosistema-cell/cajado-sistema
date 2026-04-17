'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function SecretariaFlutuante() {
  const [isOpen, setIsOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 }) 
  const [isClient, setIsClient] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, distance: 0 })

  const [mensagens, setMensagens] = useState([
    { id: '1', role: 'ai', texto: 'Olá, chefe. Sou a sua Assistente Executiva Premium. Como posso ajustar a sua agenda ou registrar ativos hoje?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Initial position bottom-right
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 150 })
    setIsClient(true)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, isOpen])

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only capture on the avatar button
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: pos.x,
      initialY: pos.y,
      distance: 0
    }
  }

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return
      
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      dragRef.current.distance = Math.sqrt(dx * dx + dy * dy)

      let newX = dragRef.current.initialX + dx
      let newY = dragRef.current.initialY + dy
      
      // Boundaries
      newX = Math.max(10, Math.min(newX, window.innerWidth - 70))
      newY = Math.max(10, Math.min(newY, window.innerHeight - 100))

      setPos({ x: newX, y: newY })
    }

    const handlePointerUp = () => {
      if (!isDragging) return
      setIsDragging(false)
      if (dragRef.current.distance < 5) {
        // Was a tap/click
        setIsOpen(prev => !prev)
      }
    }

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging])

  const transcriptRef = useRef('')

  const handleEnviar = async (textToSubmit?: string) => {
    const userText = typeof textToSubmit === 'string' ? textToSubmit : input
    if (!userText.trim() || loading) return
    
    setMensagens(prev => [...prev, { id: Date.now().toString(), role: 'user', texto: userText }])
    setInput('')
    transcriptRef.current = ''
    setLoading(true)

    try {
      const contextoHistorico = mensagens.map(m => `${m.role === 'ai' ? 'Secretária' : 'Usuário'}: ${m.texto}`).join('\n')
      
      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          context: contextoHistorico,
          systemInstruction: 'Você é a Elena, Secretária Executiva Premium do sistema Cajado Soluções. Você ajuda o "Patrão" (usuário) a gerenciar agenda, gastos, finanças, investimentos e dar conselhos de gestão de alto nível. Seja breve, muito educada, use um tom profissional e levemente entusiasmado. Responda de forma concisa. Se ele pedir para agendar ou registrar gastos, confirme que foi anotado com sucesso.'
        })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao consultar IA')
      
      setMensagens(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', texto: data.result }])
    } catch (err) {
      setMensagens(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', texto: 'Perdão, chefe. Tive um problema de comunicação com meus servidores. Tente novamente em instantes.' }])
    } finally {
      setLoading(false)
    }
  }

  const handlePressMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não suportado neste navegador.')
      return
    }

    transcriptRef.current = ''
    setInput('')
    
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('')
      setInput(transcript)
      transcriptRef.current = transcript
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognition.start()
  }

  const handleReleaseMic = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      
      // Delay slightly to let the last words be processed by onresult
      setTimeout(() => {
        if (transcriptRef.current.trim()) {
           handleEnviar(transcriptRef.current)
        }
      }, 500)
    }
  }

  if (!isClient) return null

  return (
    <>
      {/* Botão Flutuante (Draggable) */}
      <div 
        className="fixed z-[100] cursor-grab active:cursor-grabbing"
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30"></div>
          <div className="w-16 h-16 rounded-full border-[3px] border-amber-400 p-0.5 shadow-[0_10px_25px_rgba(251,191,36,0.5)] bg-zinc-900 transition-transform active:scale-95">
            <img 
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop" 
              alt="Secretária Executiva" 
              className="w-full h-full rounded-full object-cover pointer-events-none"
            />
          </div>
          {/* Badge Red / Status */}
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-zinc-900 rounded-full"></div>
        </div>
      </div>

      {/* Janela de Chat Aberta */}
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all" onClick={() => setIsOpen(false)}>
          <div 
            className="w-full max-w-md bg-[#0a0d16] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh] md:h-[600px]"
            onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
            style={{ animation: 'slideUp 0.3s ease-out forwards' }}
          >
            {/* Header da Janela */}
            <div className="p-4 bg-gradient-to-r from-[#0d1522] to-[#080b14] border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop" 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full object-cover border border-amber-400/50"
                />
                <div>
                  <h3 className="font-bold text-zinc-100 text-sm">Elena (Secretária)</h3>
                  <p className="text-[10px] text-amber-400 font-medium">Aguardando instruções...</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Area do Chat */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {mensagens.map(msg => {
                const isAi = msg.role === 'ai'
                return (
                  <div key={msg.id} className={cn("flex", isAi ? "justify-start" : "justify-end")}>
                    <div className={cn(
                      "max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed",
                      isAi ? "bg-zinc-800 text-zinc-200 rounded-tl-sm" : "bg-amber-600 text-white rounded-tr-sm"
                    )}>
                      {msg.texto}
                    </div>
                  </div>
                )
              })}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm text-zinc-400 text-xs flex gap-1">
                    <span className="animate-bounce">●</span><span className="animate-bounce" style={{animationDelay: '0.1s'}}>●</span><span className="animate-bounce" style={{animationDelay: '0.2s'}}>●</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-[#0a0d16] border-t border-zinc-800">
               <div className="flex items-center gap-2 relative bg-zinc-900 rounded-2xl p-1 border border-zinc-800 focus-within:border-amber-500/50 transition-colors">
                  <button 
                    onPointerDown={handlePressMic}
                    onPointerUp={handleReleaseMic}
                    onPointerLeave={handleReleaseMic}
                    style={{ touchAction: 'none' }}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
                      isListening ? "bg-red-500 text-white animate-pulse" : "text-zinc-400 hover:text-amber-400"
                    )}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                  </button>
                  <input 
                    type="text"
                    className="flex-1 bg-transparent border-0 focus:ring-0 text-sm text-white placeholder-zinc-500 h-10"
                    placeholder="Comande por texto ou voz..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEnviar()}
                  />
                  <button 
                    onClick={handleEnviar}
                    disabled={!input.trim() || loading}
                    className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 flex items-center justify-center shrink-0 disabled:opacity-50"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  </button>
               </div>
            </div>
            
            <style jsx>{`
              @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>
          </div>
        </div>
      )}
    </>
  )
}
