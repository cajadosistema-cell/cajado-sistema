'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

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
    const ctx = new Ctx()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

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

// ── Voz sintetizada (TTS) ────────────────────────────────────────────
function falarTexto(texto: string, urgente = false) {
  try {
    if (!('speechSynthesis' in window)) return
    // Cancela qualquer fala em andamento
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance()
    utterance.text = urgente
      ? `Atenção! ${texto}`
      : `Lembrete: ${texto}`
    utterance.lang = 'pt-BR'
    utterance.rate = 0.95
    utterance.pitch = 1.05
    utterance.volume = 1

    // Tenta usar voz em português brasileiro
    const vozes = window.speechSynthesis.getVoices()
    const vozPtBR = vozes.find(v => v.lang === 'pt-BR')
      || vozes.find(v => v.lang.startsWith('pt'))
    if (vozPtBR) utterance.voice = vozPtBR

    // Se vozes ainda não carregaram, espera e tenta de novo
    if (vozes.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const vs = window.speechSynthesis.getVoices()
        const voz = vs.find(v => v.lang === 'pt-BR') || vs.find(v => v.lang.startsWith('pt'))
        if (voz) utterance.voice = voz
        window.speechSynthesis.speak(utterance)
      }
      return
    }

    window.speechSynthesis.speak(utterance)
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

// ── Componente Principal ─────────────────────────────────────────
export function AlarmManager({ userId }: { userId: string }) {
  const supabase = createClient()
  const [toasts, setToasts] = useState<AlarmToast[]>([])
  const [permissao, setPermissao] = useState<NotificationPermission>('default')
  const firedRef = useRef<Set<string>>(new Set())

  // Carrega eventos disparados anteriormente do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cajado_alarms_fired')
      if (saved) {
        const arr: string[] = JSON.parse(saved)
        // Só guarda do dia atual para não acumular eternamente
        const hoje = new Date().toISOString().split('T')[0]
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

  // Roda imediatamente e depois a cada 30 segundos
  // (reduzido de 60s para minimizar janela de perda de alarmes)
  // IMPORTANTE: userId pode chegar vazio na primeira renderização (assíncrono).
  useEffect(() => {
    if (!userId) return
    // Dispara imediatamente para não esperar
    verificarAlarmes()
    const interval = setInterval(verificarAlarmes, 30_000)  // 30s
    return () => clearInterval(interval)
  }, [userId, verificarAlarmes])

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

      {/* Banner de permissão (só aparece se negado ou não respondido) */}
      {permissao === 'default' && (
        <div className="fixed bottom-24 left-4 z-[9998] max-w-xs">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1a1f2e] border border-amber-500/20 shadow-lg">
            <span className="text-lg">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">Ativar lembretes sonoros?</p>
              <p className="text-[10px] text-fg-disabled">Avisos de agenda com som</p>
            </div>
            <button
              onClick={pedirPermissao}
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
