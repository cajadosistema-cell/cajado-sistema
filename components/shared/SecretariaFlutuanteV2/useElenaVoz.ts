'use client'
// ── useElenaVoz.ts ────────────────────────────────────────────
// Responsável por: microfone, SpeechRecognition, modo mãos-livres.
// Completamente isolado — não sabe nada de salvamento ou IA.
//
// FIX v2: pausa curta do browser NÃO envia mais o texto parcial.
// O texto só é enviado quando o usuário clica novamente no mic (toggleMic/handleReleaseMic).

import { useState, useRef } from 'react'

interface UseElenaVozProps {
  onEnviar: (texto: string) => void
  onErro?: (msg: string) => void   // Callback para erros — evita alert() nativo
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
  onErro,
  userId,
  salvarMicAutorizado,
  micPermitidoRef,
}: UseElenaVozProps): UseElenaVozReturn {
  const [isListening, setIsListening] = useState(false)
  const [modoVozContinuo, setModoVozContinuoState] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')

  // Refs síncronos — evitam stale closure nos handlers da SpeechRecognition
  const isListeningRef       = useRef(false)
  const modoVozRef           = useRef(false)
  const recognitionRef       = useRef<any>(null)
  const transcriptRef        = useRef('')
  const silenceTimerRef      = useRef<any>(null)
  // Flag: handleReleaseMic já enviou o texto — onend não deve reenviar
  const enviadoPorReleaseRef = useRef(false)

  const setModoVozContinuo = (v: boolean) => {
    modoVozRef.current = v
    setModoVozContinuoState(v)
  }

  // ── Timer de silêncio (10s → para automaticamente apenas no modo mãos-livres) ─
  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      if (!isListeningRef.current) return
      // Auto-para SOMENTE no modo mãos-livres (contínuo)
      if (!modoVozRef.current) return
      isListeningRef.current = false
      try { recognitionRef.current?.stop() } catch {}
      recognitionRef.current = null
      setIsListening(false)
      setInterimTranscript('')
    }, 10000)
  }

  // ── Cria instância da SpeechRecognition ──────────────────────
  const criarInstancia = (): any => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return null

    const r = new SR()
    r.lang = 'pt-BR'
    r.continuous = false      // O browser finaliza por sentença — reiniciamos manualmente para acumular
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
        onErro?.('🔒 Microfone bloqueado. Toque no cadeado na barra de endereços e permita o microfone.')
      } else if (e.error === 'audio-capture') {
        isListeningRef.current = false
        setIsListening(false)
        onErro?.('🎙️ Nenhum microfone encontrado. Conecte um e tente novamente.')
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
      // ─── CASO 1: handleReleaseMic já enviou → apenas limpa ──────────────
      if (enviadoPorReleaseRef.current) {
        enviadoPorReleaseRef.current = false
        setIsListening(false)
        setInterimTranscript('')
        recognitionRef.current = null
        return
      }

      // ─── CASO 2: parou via silence-timer ou clique manual ───────────────
      if (!isListeningRef.current) {
        const texto = transcriptRef.current.trim()
        transcriptRef.current = ''
        setInterimTranscript('')
        setIsListening(false)
        recognitionRef.current = null
        if (texto) setTimeout(() => onEnviar(texto), 100)
        return
      }

      // ─── CASO 3: pausa curta do browser DURANTE a fala — NÃO ENVIA! ────
      // O usuário ainda está gravando. Reinicia silenciosamente acumulando o texto.
      setTimeout(() => {
        if (!isListeningRef.current) {
          // Usuário parou enquanto reiniciávamos → envia o acumulado
          const texto = transcriptRef.current.trim()
          transcriptRef.current = ''
          setInterimTranscript('')
          setIsListening(false)
          recognitionRef.current = null
          if (texto) onEnviar(texto)
          return
        }
        const nova = criarInstancia()
        if (!nova) return
        recognitionRef.current = nova
        try { nova.start() } catch {}
      }, 150)
    }

    return r
  }

  // ── Iniciar reconhecimento ────────────────────────────────────
  const iniciarReconhecimento = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      // iOS Safari não suporta mais — orienta sobre alternativa
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      onErro?.(isIOS
        ? '📱 Safari iOS não suporta reconhecimento de voz neste dispositivo. Tente digitar sua mensagem.'
        : '🌐 Reconhecimento de voz não disponível. Use Google Chrome ou Microsoft Edge.')
      return
    }
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }

    transcriptRef.current = ''
    enviadoPorReleaseRef.current = false
    setInterimTranscript('')

    const instancia = criarInstancia()
    if (!instancia) return
    recognitionRef.current = instancia
    instancia.start()
  }

  const handlePressMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      onErro?.(isIOS
        ? '📱 Safari iOS não suporta reconhecimento de voz neste dispositivo. Tente digitar sua mensagem.'
        : '🌐 Reconhecimento de voz não disponível. Use Google Chrome ou Microsoft Edge.')
      return
    }
    isListeningRef.current = true
    iniciarReconhecimento()
  }

  const handleReleaseMic = () => {
    isListeningRef.current = false
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)

    // Captura o texto ANTES de chamar stop() — evita race condition com onend
    const textCapturado = transcriptRef.current.trim()
    transcriptRef.current = ''
    setInterimTranscript('')

    if (recognitionRef.current) {
      // Sinaliza que o release já vai enviar → onend não duplica
      if (textCapturado) enviadoPorReleaseRef.current = true
      try { recognitionRef.current.stop() } catch {}
    }

    if (!textCapturado) {
      setIsListening(false)
      recognitionRef.current = null
      return
    }

    // Envia diretamente (não espera o onend)
    setTimeout(() => onEnviar(textCapturado), 100)
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
