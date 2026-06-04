'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const NOTIF_ASKED_KEY = 'cajado-notif-asked'

interface AgendaEvento {
  id: string
  titulo: string
  data_inicio: string
  tipo: string
  descricao?: string | null
}

interface AlarmToast {
  id: string
  titulo: string
  minutosRestantes: number
  tipo: string
}

// ── Gerador de som via Web Audio API (sem arquivo externo) ──────
function tocarChime(tipo: 'aviso' | 'urgente' = 'aviso') {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return

    // Usa o contexto global se disponível (criado no gesto do usuário — iOS)
    // Caso contrário cria um novo (Android/Desktop funciona sem gesto)
    const ctx = audioCtxGlobal || new Ctx()
    if (!audioCtxGlobal) audioCtxGlobal = ctx
    if (ctx.state === 'suspended') ctx.resume()

    // Acorde: C5 - E5 - G5 (aviso) | A4 - C5 - E5 (urgente)
    const notas = tipo === 'aviso'
      ? [523.25, 659.25, 783.99]   // Dó-Mi-Sol (acorde maior, calmo)
      : [440, 523.25, 659.25, 880] // La-Dó-Mi-La (urgente, 4 notas)

    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.value = freq

      const t = ctx.currentTime + i * 0.28
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)

      osc.start(t)
      osc.stop(t + 0.6)
    })
  } catch {
    // AudioContext não disponível (SSR ou restrição)
  }
}

// ── Cache global de vozes (carrega uma vez e reutiliza) ─────────────────
let vozCache: SpeechSynthesisVoice[] = []
let vozCacheCarregado = false

function carregarVozes() {
  if (!('speechSynthesis' in window)) return
  const vs = window.speechSynthesis.getVoices()
  if (vs.length > 0) {
    vozCache = vs
    vozCacheCarregado = true
  }
}

// Dispara assim que as vozes ficarem disponíveis (lazy load do browser)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => carregarVozes()
  carregarVozes() // tenta imediatamente (já pode estar carregado)
}

function escolherVoz(): SpeechSynthesisVoice | null {
  const vs = vozCacheCarregado ? vozCache : window.speechSynthesis?.getVoices() || []
  return vs.find(v => v.lang === 'pt-BR')
    || vs.find(v => v.lang.startsWith('pt'))
    || vs[0]
    || null
}

// ── Voz sintetizada (TTS) — robusta como Shopee/Mercado Livre ───────────
function falarTexto(texto: string, urgente = false, tentativas = 0) {
  try {
    if (!('speechSynthesis' in window)) return

    const ss = window.speechSynthesis

    // Desbloqueia mobile (Chrome Android pausa speechSynthesis automaticamente)
    if (ss.paused) ss.resume()
    ss.cancel() // cancela qualquer fala anterior

    const voz = escolherVoz()

    // Se vozes ainda não carregaram e não excedeu tentativas → retry em 300ms
    if (!voz && tentativas < 5) {
      setTimeout(() => falarTexto(texto, urgente, tentativas + 1), 300)
      return
    }

    const utterance = new SpeechSynthesisUtterance()
    utterance.text = urgente
      ? `Atenção! ${texto}`
      : `Lembrete: ${texto}`
    utterance.lang = 'pt-BR'
    utterance.rate = 0.92
    utterance.pitch = 1.05
    utterance.volume = 1.0
    if (voz) utterance.voice = voz

    // Workaround Chrome Android: speechSynthesis pausa sozinho após ~15s
    // Fazemos resume() periódico enquanto fala
    let keepAlive: ReturnType<typeof setInterval> | null = null
    utterance.onstart = () => {
      keepAlive = setInterval(() => {
        if (ss.speaking && ss.paused) ss.resume()
      }, 5000)
    }
    utterance.onend = () => {
      if (keepAlive) clearInterval(keepAlive)
    }
    utterance.onerror = () => {
      if (keepAlive) clearInterval(keepAlive)
    }

    ss.speak(utterance)
  } catch { /* SpeechSynthesis indisponível */ }
}

// ── Notificação do navegador ─────────────────────────────────────
async function notificarNavegador(titulo: string, corpo: string) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
  if (Notification.permission === 'granted') {
    new Notification(`⏰ ${titulo}`, {
      body: corpo,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: titulo, // evita duplicar mesma notificação
    })
  }
}

// ── Toast visual in-app ─────────────────────────────────────────
function AlarmToastUI({ alarms, onDismiss }: {
  alarms: AlarmToast[]
  onDismiss: (id: string) => void
}) {
  if (alarms.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {alarms.map(alarm => (
        <div
          key={alarm.id}
          className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl border max-w-xs animate-slideIn"
          style={{
            background: 'linear-gradient(135deg, #1a1f2e, #0d1220)',
            borderColor: alarm.minutosRestantes === 0 ? '#ef4444' : '#f59e0b',
            boxShadow: `0 0 20px ${alarm.minutosRestantes === 0 ? '#ef444440' : '#f59e0b40'}`,
          }}
        >
          <span className="text-2xl shrink-0">{alarm.minutosRestantes === 0 ? '🔔' : '⏰'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{alarm.titulo}</p>
            <p className="text-xs mt-0.5" style={{ color: alarm.minutosRestantes === 0 ? '#ef4444' : '#f59e0b' }}>
              {alarm.minutosRestantes === 0
                ? '🔴 AGORA!'
                : `Em ${alarm.minutosRestantes} min`}
            </p>
          </div>
          <button
            onClick={() => onDismiss(alarm.id + '_dismissed')}
            className="text-white/40 hover:text-white text-lg leading-none shrink-0 mt-0.5 transition-colors"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  )
}

// ── AudioContext global reutilizável (iOS exige ser criado em gesture) ──
let audioCtxGlobal: AudioContext | null = null
let audioDesbloqueado = false

function desbloquearAudio() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!audioCtxGlobal) audioCtxGlobal = new Ctx()
    if (audioCtxGlobal.state === 'suspended') audioCtxGlobal.resume()
    audioDesbloqueado = true
    // Testa fala silenciosa para desbloqueio do iOS
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
    }
  } catch {}
}

// ── Componente Principal ─────────────────────────────────────────
export function AlarmManager({ userId }: { userId: string }) {
  const supabase = createClient()
  const [toasts, setToasts] = useState<AlarmToast[]>([])
  const [permissao, setPermissao] = useState<NotificationPermission>('default')
  const [audioAtivado, setAudioAtivado] = useState(audioDesbloqueado)
  const firedRef = useRef<Set<string>>(new Set())
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

  // ── Registra SW + push subscription (iOS PWA + Android) ─────────────
  usePushNotifications(userId || null)

  // ── Dispara Edge Function server-side (para alertas com app fechado) ─
  // Chama a cada 30s enquanto app está aberto; o servidor também pode chamar via cron
  const chamarEdgeFunction = useCallback(async () => {
    if (!userId) return
    try {
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supaUrl) return
      await fetch(`${supaUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ userId }),
      })
    } catch { /* silencioso */ }
  }, [userId])

  // Carrega eventos disparados anteriormente do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cajado_alarms_fired')
      if (saved) {
        const arr: string[] = JSON.parse(saved)
        // Usa data LOCAL (não UTC) para não perder alarmes na virada do dia
        const hoje = new Date().toLocaleDateString('sv') // YYYY-MM-DD local
        arr.forEach(id => {
          if (id.startsWith(hoje)) firedRef.current.add(id)
        })
      }
    } catch {}

    // Verifica permissão atual
    if ('Notification' in window) {
      const currentPerm = Notification.permission
      setPermissao(currentPerm)
      // Se já foi solicitado antes (independente do resultado), não mostra mais o banner
      if (currentPerm !== 'default' || localStorage.getItem(NOTIF_ASKED_KEY) === '1') {
        setPermissao(currentPerm === 'default' ? 'denied' : currentPerm) // trata 'default+já pedido' como oculto
      }
    }
  }, [])

  const salvarFired = (id: string) => {
    firedRef.current.add(id)
    try {
      localStorage.setItem('cajado_alarms_fired', JSON.stringify(Array.from(firedRef.current)))
    } catch {}
  }

  const dispensar = useCallback((key: string) => {
    salvarFired(key)
    setToasts(prev => prev.filter(t => t.id + '_dismissed' !== key && t.id !== key))
  }, [])

  const verificarAlarmes = useCallback(async () => {
    if (!userId) return
    const agora = new Date()

    // ── Busca eventos em janela ampla: -5 min a +20 min ───────────────
    // -5 min: captura eventos que passaram enquanto a aba estava fechada
    // +20 min: garante que o alerta de 3 min seja capturado no próximo poll
    const haAtras = new Date(agora.getTime() - 5 * 60 * 1000)
    const emFrente = new Date(agora.getTime() + 20 * 60 * 1000)

    const { data } = await (supabase.from('agenda_eventos') as any)
      .select('id,titulo,data_inicio,tipo,descricao')
      .eq('user_id', userId)
      .neq('status', 'cancelado')
      .gte('data_inicio', haAtras.toISOString())
      .lte('data_inicio', emFrente.toISOString())
      .order('data_inicio')

    if (!data) return

    // ── Chave usa data LOCAL (não UTC) para evitar bug de virada do dia ─
    const hojeLocal = agora.toLocaleDateString('sv') // YYYY-MM-DD local

    for (const evento of data as AgendaEvento[]) {
      const dataEvento = new Date(evento.data_inicio)
      const diffMs = dataEvento.getTime() - agora.getTime()
      const diffMin = diffMs / 60000 // pode ser negativo (passou)

      // Ignora eventos que passaram há mais de 5 min (não faz sentido alertar)
      if (diffMin < -5) continue

      // ── Define janela de disparo ───────────────────────────────────────
      // '3min'  → entre 2 min e 5 min antes (janela ampla para não perder no poll de 30s)
      // '0min'  → no momento: entre -5 min (passou) e +2 min
      let janela: string | null = null
      if (diffMin >= 2 && diffMin <= 5) {
        janela = '3min'  // ⏰ alerta antecipado
      } else if (diffMin < 2) {
        janela = '0min'  // 🔔 hora do evento ou passou
      }

      if (!janela) continue

      const chave = `${hojeLocal}_${evento.id}_${janela}`
      if (firedRef.current.has(chave)) continue
      salvarFired(chave)

      // ── Som ─────────────────────────────────────────────────────────────
      const urgente = janela === '0min'
      tocarChime(urgente ? 'urgente' : 'aviso')

      // ── Voz (delay pra terminar o chime) ────────────────────────────────
      const textoVoz = janela === '3min'
        ? `Em 3 minutos: ${evento.titulo}`
        : evento.titulo
      setTimeout(() => falarTexto(textoVoz, urgente), 800)

      // ── Notificação do navegador ──────────────────────────────────────────
      const minPassados = Math.round(Math.abs(diffMin))
      await notificarNavegador(
        evento.titulo,
        urgente
          ? diffMin < 0
            ? `Lembrete tardio — passou há ${minPassados} min`
            : 'O evento está começando AGORA!'
          : '⏰ Começa em 3 minutos!'
      )

      // ── Toast visual ─────────────────────────────────────────────────────
      const toastId = `${evento.id}_${janela}`
      setToasts(prev => {
        if (prev.find(t => t.id === toastId)) return prev
        return [...prev, {
          id: toastId,
          titulo: evento.titulo,
          minutosRestantes: urgente ? 0 : 3,
          tipo: evento.tipo,
        }]
      })

      // Auto-remove toast após 45 segundos
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId))
      }, 45000)
    }
  }, [userId, supabase])

  // Polling local (app aberto) + Edge Function server-side (iOS background / app fechado)
  useEffect(() => {
    if (!userId) return
    verificarAlarmes()
    chamarEdgeFunction() // envia push server-side imediatamente
    const interval = setInterval(() => {
      verificarAlarmes()
      chamarEdgeFunction()
    }, 30_000)
    return () => clearInterval(interval)
  }, [userId, verificarAlarmes, chamarEdgeFunction])

  // Solicita permissão de notificação se ainda não concedida
  const pedirPermissao = async () => {
    if (!('Notification' in window)) return
    // Marca que já pediu para nunca mais mostrar o banner
    localStorage.setItem(NOTIF_ASKED_KEY, '1')
    const result = await Notification.requestPermission()
    setPermissao(result)
  }

  return (
    <>
      {/* Toast visual */}
      <AlarmToastUI alarms={toasts} onDismiss={dispensar} />

      {/* Banner iOS: toque para ativar áudio */}
      {isIOS && !audioAtivado && (
        <div className="fixed bottom-24 left-4 z-[9998] max-w-xs">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1a1f2e] border border-amber-500/20 shadow-lg">
            <span className="text-lg">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">Ativar alertas sonoros</p>
              <p className="text-[10px] text-fg-disabled">iPhone requer um toque para liberar o som</p>
            </div>
            <button
              onClick={() => {
                desbloquearAudio()
                setAudioAtivado(true)
                if (!('Notification' in window)) return
                localStorage.setItem(NOTIF_ASKED_KEY, '1')
                Notification.requestPermission().then(r => setPermissao(r))
              }}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-all shrink-0 animate-pulse"
            >
              🔊 Ativar
            </button>
          </div>
        </div>
      )}

      {/* Banner Android/Desktop: pedir permissão de notificação */}
      {!isIOS && permissao === 'default' && (
        <div className="fixed bottom-24 left-4 z-[9998] max-w-xs">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1a1f2e] border border-amber-500/20 shadow-lg">
            <span className="text-lg">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">Ativar lembretes sonoros?</p>
              <p className="text-[10px] text-fg-disabled">Avisos de agenda com som</p>
            </div>
            <button
              onClick={() => { desbloquearAudio(); setAudioAtivado(true); pedirPermissao() }}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all shrink-0"
            >
              Ativar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
