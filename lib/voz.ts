// lib/voz.ts
// ─────────────────────────────────────────────────────────────────────────
// Síntese de voz (TTS) compartilhada. Extraída do AlarmManager para ser
// reutilizada pelo briefing matinal da Elena (useElenaSession) sem duplicar
// os workarounds de Android/iOS.
//
// Uso:
//   falar('Bom dia, Sr. Max. Você tem 2 vencimentos esta semana.')
//   falar('Reunião em 3 minutos', { prefixo: 'Lembrete: ' })
// ─────────────────────────────────────────────────────────────────────────

let vozCache: SpeechSynthesisVoice[] = []
let vozCacheCarregado = false

function carregarVozes() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const vs = window.speechSynthesis.getVoices()
  if (vs.length > 0) {
    vozCache = vs
    vozCacheCarregado = true
  }
}

// Dispara assim que as vozes ficarem disponíveis (lazy load do browser)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => carregarVozes()
  carregarVozes()
}

function escolherVoz(): SpeechSynthesisVoice | null {
  const vs = vozCacheCarregado ? vozCache : window.speechSynthesis?.getVoices() || []
  return vs.find(v => v.lang === 'pt-BR')
    || vs.find(v => v.lang.startsWith('pt'))
    || vs[0]
    || null
}

interface FalarOpts {
  /** Texto colado antes da frase, ex.: 'Atenção! ' ou 'Lembrete: '. Padrão: nenhum. */
  prefixo?: string
  rate?: number
  pitch?: number
}

/**
 * Fala um texto em pt-BR. Silencioso e seguro: se o navegador não suportar
 * ou bloquear áudio, apenas não faz nada (não lança).
 *
 * ⚠️ O navegador pode silenciar TTS se não houve interação do usuário na
 * página. Se a fala partir de um clique do usuário (ex.: abrir a Elena),
 * o áudio já vem desbloqueado.
 */
export function falar(texto: string, opts: FalarOpts = {}, _tentativas = 0) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const ss = window.speechSynthesis

    // Desbloqueia mobile (Chrome Android pausa speechSynthesis sozinho)
    if (ss.paused) ss.resume()
    ss.cancel() // cancela qualquer fala anterior

    const voz = escolherVoz()

    // Se as vozes ainda não carregaram, tenta de novo (até 5x)
    if (!voz && _tentativas < 5) {
      setTimeout(() => falar(texto, opts, _tentativas + 1), 300)
      return
    }

    const utterance = new SpeechSynthesisUtterance()
    utterance.text = (opts.prefixo ?? '') + texto
    utterance.lang = 'pt-BR'
    utterance.rate = opts.rate ?? 0.95
    utterance.pitch = opts.pitch ?? 1.05
    utterance.volume = 1.0
    if (voz) utterance.voice = voz

    // Workaround Chrome Android: speechSynthesis pausa sozinho após ~15s
    let keepAlive: ReturnType<typeof setInterval> | null = null
    utterance.onstart = () => {
      keepAlive = setInterval(() => {
        if (ss.speaking && ss.paused) ss.resume()
      }, 5000)
    }
    const limpar = () => { if (keepAlive) clearInterval(keepAlive) }
    utterance.onend = limpar
    utterance.onerror = limpar

    ss.speak(utterance)
  } catch { /* SpeechSynthesis indisponível */ }
}
