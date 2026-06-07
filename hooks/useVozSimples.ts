'use client'
/**
 * useVozSimples — Hook leve de SpeechRecognition reutilizável.
 *
 * Diferente do useElenaVoz (acoplado ao chat da Elena), este hook é genérico:
 * - Usa SpeechRecognition / webkitSpeechRecognition nativo (iOS Safari + Chrome + Edge)
 * - Retorna texto transcrito ao parar o mic
 * - Zero custo de API — tudo no browser
 * - Sem dependência de userId, chat ou IA
 */

import { useState, useRef, useCallback } from 'react'

interface UseVozSimplesReturn {
  /** true se o mic está ativo e gravando */
  isListening: boolean
  /** Texto acumulado em tempo real (interim + final) */
  transcript: string
  /** Toggle: inicia ou para a gravação */
  toggleMic: () => void
  /** true se o browser suporta SpeechRecognition */
  suportado: boolean
  /** Limpa o transcript manualmente */
  limpar: () => void
}

export function useVozSimples(onTextoFinal?: (texto: string) => void): UseVozSimplesReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')

  const isListeningRef = useRef(false)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')

  // Verifica suporte (client-side only)
  const suportado = typeof window !== 'undefined'
    && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  const criarInstancia = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return null

    const r = new SR()
    r.lang = 'pt-BR'
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 1

    r.onresult = (e: any) => {
      let textoFinal = ''
      let textoInterim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) textoFinal += e.results[i][0].transcript
        else textoInterim += e.results[i][0].transcript
      }
      if (textoFinal) {
        transcriptRef.current = (transcriptRef.current + textoFinal + ' ').trimStart()
      }
      const display = (transcriptRef.current + textoInterim).trim()
      setTranscript(display || transcriptRef.current.trim())
    }

    r.onerror = () => {
      // Silencioso — erros como 'no-speech' ou 'aborted' são normais
    }

    r.onend = () => {
      if (!isListeningRef.current) {
        // Usuário parou → entrega o texto final
        const texto = transcriptRef.current.trim()
        setTranscript(texto)
        setIsListening(false)
        recognitionRef.current = null
        if (texto && onTextoFinal) {
          onTextoFinal(texto)
        }
        return
      }
      // Pausa curta do browser → reinicia silenciosamente
      setTimeout(() => {
        if (!isListeningRef.current) {
          const texto = transcriptRef.current.trim()
          setTranscript(texto)
          setIsListening(false)
          recognitionRef.current = null
          if (texto && onTextoFinal) onTextoFinal(texto)
          return
        }
        const nova = criarInstancia()
        if (!nova) return
        recognitionRef.current = nova
        try { nova.start() } catch {}
      }, 150)
    }

    return r
  }, [onTextoFinal])

  const iniciar = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
    transcriptRef.current = ''
    setTranscript('')
    isListeningRef.current = true
    setIsListening(true)

    const instancia = criarInstancia()
    if (!instancia) return
    recognitionRef.current = instancia
    try { instancia.start() } catch {}
  }, [criarInstancia])

  const parar = useCallback(() => {
    isListeningRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    // onend handler vai cuidar do rest
  }, [])

  const toggleMic = useCallback(() => {
    if (isListening) parar()
    else iniciar()
  }, [isListening, iniciar, parar])

  const limpar = useCallback(() => {
    transcriptRef.current = ''
    setTranscript('')
  }, [])

  return {
    isListening,
    transcript,
    toggleMic,
    suportado,
    limpar,
  }
}
