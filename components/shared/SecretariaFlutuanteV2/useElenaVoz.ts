'use client'
// ── useElenaVoz.ts ────────────────────────────────────────────
// Responsável por: microfone, SpeechRecognition, modo mãos-livres.
// Completamente isolado — não sabe nada de salvamento ou IA.

import { useState, useRef } from 'react'

interface UseElenaVozProps {
  onEnviar: (texto: string) => void
  userId: string
  salvarMicAutorizado: (uid: string) => Promise<void>
  micPermitidoRef: React.MutableRefObject<boolean>
}

interface UseElenaVozReturn {
  isListening: boolean
  modoVozContinuo: boolean
  interimTranscript: string
  toggleMic: () => void
  setModoVozContinuo: (v: boolean) => void
  modoVozRef: React.MutableRefObject<boolean>
  handlePressMic: () => void
  handleReleaseMic: () => void
}

export function useElenaVoz({
  onEnviar,
  userId,
  salvarMicAutorizado,
  micPermitidoRef,
}: UseElenaVozProps): UseElenaVozReturn {
  const [isListening, setIsListening] = useState(false)
  const [modoVozContinuo, setModoVozContinuoState] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')

  // Refs síncronos — evitam stale closure nos handlers da SpeechRecognition
  const isListeningRef  = useRef(false)
  const modoVozRef      = useRef(false)
  const recognitionRef  = useRef<any>(null)
  const transcriptRef   = useRef('')
  const silenceTimerRef = useRef<any>(null)

  const setModoVozContinuo = (v: boolean) => {
    modoVozRef.current = v
    setModoVozContinuoState(v)
  }

  // ── Timer de silêncio (8s sem fala → para automaticamente) ───
  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      if (!isListeningRef.current) return
      isListeningRef.current = false
      try { recognitionRef.current?.stop() } catch {}
      recognitionRef.current = null
      setIsListening(false)
      setInterimTranscript('')
    }, 8000)
  }

  // ── Cria instância da SpeechRecognition ──────────────────────
  const criarInstancia = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return null

    const r = new SR()
    r.lang = 'pt-BR'
    r.continuous = false      // Anti-duplicação: cada sentença é independente
    r.interimResults = true
    r.maxAlternatives = 1

    r.onstart = () => {
      setIsListening(true)
      resetSilenceTimer()
    }

    r.onresult = (e: any) => {
      let textoFinal = ''
      let textoInterim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) textoFinal += e.results[i][0].transcript
        else textoInterim += e.results[i][0].transcript
      }
      if (textoFinal) {
        transcriptRef.current = (transcriptRef.current + textoFinal + ' ').trimStart()
        resetSilenceTimer()
      }
      const display = (transcriptRef.current + textoInterim).trim()
      setInterimTranscript(display || transcriptRef.current.trim())
    }

    r.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        isListeningRef.current = false
        setIsListening(false)
        alert('Microfone não acessível. Toque no cadeado 🔒 na barra de endereços e permita o microfone.')
      } else if (e.error === 'audio-capture') {
        isListeningRef.current = false
        setIsListening(false)
        alert('Nenhum microfone encontrado. Conecte um e tente novamente.')
      }
      // 'no-speech' e 'aborted' → silenciosos
    }

    r.onspeechstart = () => {
      if (!micPermitidoRef.current && userId) {
        micPermitidoRef.current = true
        salvarMicAutorizado(userId)
      }
    }

    r.onend = () => {
      if (!isListeningRef.current) {
        // Usuário parou manualmente → envia o que tiver
        const texto = transcriptRef.current.trim()
        transcriptRef.current = ''
        setInterimTranscript('')
        setIsListening(false)
        if (texto) setTimeout(() => onEnviar(texto), 100)
        return
      }

      // Ainda no modo escuta (mãos-livres)
      const texto = transcriptRef.current.trim()
      if (texto) {
        // Tem texto acumulado → auto-envia e continua escutando
        transcriptRef.current = ''
        setInterimTranscript('🎤 Enviado! Pode falar novamente...')
        onEnviar(texto)
        setTimeout(() => {
          if (!isListeningRef.current) return
          setInterimTranscript('')
          const nova = criarInstancia()
          if (!nova) return
          recognitionRef.current = nova
          try { nova.start() } catch {}
        }, 600)
      } else {
        // Sem texto (pausa antes de falar) → reinicia imediatamente
        setTimeout(() => {
          if (!isListeningRef.current) return
          const nova = criarInstancia()
          if (!nova) return
          recognitionRef.current = nova
          try { nova.start() } catch {}
        }, 100)
      }
    }

    return r
  }

  // ── Iniciar reconhecimento ────────────────────────────────────
  const iniciarReconhecimento = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Use o Google Chrome para usar o microfone.'); return }
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }

    transcriptRef.current = ''
    setInterimTranscript('')

    const instancia = criarInstancia()
    if (!instancia) return
    recognitionRef.current = instancia
    instancia.start()
  }

  const handlePressMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Use Google Chrome ou Edge para usar o microfone.'); return }
    isListeningRef.current = true
    iniciarReconhecimento()
  }

  const handleReleaseMic = () => {
    isListeningRef.current = false
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    const textCapturado = transcriptRef.current.trim()
    transcriptRef.current = ''
    setInterimTranscript('')
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    if (!textCapturado) {
      setIsListening(false)
      recognitionRef.current = null
    }
  }

  const toggleMic = () => {
    if (isListening) handleReleaseMic()
    else handlePressMic()
  }

  return {
    isListening,
    modoVozContinuo,
    interimTranscript,
    toggleMic,
    setModoVozContinuo,
    modoVozRef,
    handlePressMic,
    handleReleaseMic,
  }
}
