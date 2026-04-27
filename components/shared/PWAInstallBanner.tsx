'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'cajado-pwa-dismissed'
const INSTALLED_KEY = 'cajado-pwa-installed'

// ── Detectores de plataforma ──────────────────────────────────
function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}
function isInStandaloneMode() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

// ── Banner iOS — instrui o usuário manualmente ────────────────
function IOSInstallBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <style>{`@keyframes slideUp { from { opacity:0; transform: translate(-50%, 20px); } to { opacity:1; transform: translate(-50%, 0); } }`}</style>
      <div
        className="relative overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #0d1117 0%, #111827 100%)',
          borderColor: 'rgba(245,158,11,0.25)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Linha dourada */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1F4A2E, #0d2b1a)' }}
            >
              <img src="/icons/icon-96.png" alt="Cajado" className="w-9 h-9 object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Instalar Cajado no iPhone</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Acesso direto pela tela inicial</p>
            </div>
            <button
              onClick={onDismiss}
              className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors text-xs"
            >✕</button>
          </div>

          {/* Passos */}
          <div className="space-y-2 mb-3">
            {[
              { step: '1', icon: '⬆️', text: 'Toque no botão Compartilhar', sub: 'Ícone de seta no centro da barra inferior' },
              { step: '2', icon: '➕', text: 'Role até "Adicionar à Tela Início"', sub: 'Ícone de quadrado com + ' },
              { step: '3', icon: '✅', text: 'Toque em "Adicionar"', sub: 'O app aparece na sua tela inicial' },
            ].map(({ step, icon, text, sub }) => (
              <div key={step} className="flex items-start gap-3 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="text-base shrink-0">{icon}</span>
                <div>
                  <p className="text-xs font-semibold text-white">{text}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Seta apontando para baixo — indica a barra do Safari */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-gray-500">toque no ícone abaixo</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div className="text-center text-2xl animate-bounce">⬆️</div>
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors border border-white/10"
          >
            Entendido, vou instalar depois
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Banner Android/Desktop — usa beforeinstallprompt ──────────
function AndroidInstallBanner({
  onInstall,
  onDismiss,
  installing,
}: {
  onInstall: () => void
  onDismiss: () => void
  installing: boolean
}) {
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <style>{`@keyframes slideUp { from { opacity:0; transform: translate(-50%, 20px); } to { opacity:1; transform: translate(-50%, 0); } }`}</style>
      <div
        className="relative overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #0d1117 0%, #111827 100%)',
          borderColor: 'rgba(245,158,11,0.25)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.1)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none" style={{ background: 'rgba(245,158,11,0.12)' }} />

        <div className="relative p-4 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center shadow-lg border border-amber-500/20"
            style={{ background: 'linear-gradient(135deg, #1F4A2E, #0d2b1a)' }}
          >
            <img src="/icons/icon-96.png" alt="Cajado" className="w-10 h-10 object-contain" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">Instalar Cajado Soluções</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
              Acesso rápido, funciona offline e sem abrir o navegador.
            </p>
            <div className="flex gap-1.5 mt-2">
              {['📱 Mobile', '💻 Desktop', '⚡ Offline'].map(b => (
                <span
                  key={b}
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors text-xs"
          >✕</button>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors border border-white/10"
          >
            Agora não
          </button>
          <button
            onClick={onInstall}
            disabled={installing}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-black transition-all flex items-center justify-center gap-1.5"
            style={{
              background: installing ? 'rgba(245,158,11,0.5)' : 'linear-gradient(135deg, #F59E0B, #D97706)',
              boxShadow: '0 4px 15px rgba(245,158,11,0.35)',
            }}
          >
            {installing ? <>⏳ Instalando...</> : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                Instalar App
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [mode, setMode] = useState<'hidden' | 'android' | 'ios'>('hidden')
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Já instalado (standalone) ou usuário já dispensou/instalou antes
    if (
      isInStandaloneMode() ||
      localStorage.getItem(STORAGE_KEY) === '1' ||
      localStorage.getItem(INSTALLED_KEY) === '1'
    ) return

    if (isIOS()) {
      // iOS: mostrar banner de instrução manual após 4s
      const t = setTimeout(() => setMode('ios'), 4000)
      return () => clearTimeout(t)
    }

    // Android / Desktop: aguardar beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      ;(window as any).deferredPrompt = e
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      window.dispatchEvent(new Event('pwa-prompt-ready'))
      setTimeout(() => setMode('android'), 3000)
    }
    const installedHandler = () => {
      localStorage.setItem(INSTALLED_KEY, '1')
      setMode('hidden')
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleDismiss = () => {
    setMode('hidden')
    localStorage.setItem(STORAGE_KEY, '1')
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    // Independente do resultado (accepted ou dismissed pelo browser nativo),
    // marca como "visto" para não mostrar o banner novamente nesta sessão.
    // O evento 'appinstalled' cuida de gravar INSTALLED_KEY se realmente instalou.
    if (choice.outcome === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, '1')
    } else {
      // Usuário fechou o prompt nativo sem instalar — oculta por 7 dias
      localStorage.setItem(STORAGE_KEY, '1')
    }
    setMode('hidden')
    setInstalling(false)
    setDeferredPrompt(null)
  }

  if (mode === 'ios') return <IOSInstallBanner onDismiss={handleDismiss} />
  if (mode === 'android') return (
    <AndroidInstallBanner
      onInstall={handleInstall}
      onDismiss={handleDismiss}
      installing={installing}
    />
  )
  return null
}

export function PWAInstallButton({ className }: { className?: string }) {
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) {
      setIsStandalone(true)
    }
  }, [])

  const handleInstall = async () => {
    if (isIOS()) {
      alert('Para instalar no iPhone:\n\n1. Toque no ícone Compartilhar (quadrado com seta para cima) na barra inferior do Safari.\n2. Role para baixo e selecione "Adicionar à Tela de Início".')
      return
    }
    
    const promptEvent = (window as any).deferredPrompt
    if (promptEvent) {
      try {
        await promptEvent.prompt()
        const choice = await promptEvent.userChoice
        if (choice.outcome === 'accepted') {
          localStorage.setItem(INSTALLED_KEY, '1')
        }
      } catch (err) {
        console.error('Erro ao instalar PWA:', err)
      }
    } else {
      // Chrome escondeu o evento (cache ou já instalado)
      if (isStandalone) {
        alert('Você já está acessando pelo Aplicativo Instalado! ✅')
      } else {
        alert('O seu navegador não enviou o atalho automático.\n\nPara instalar manualmente no Android/PC:\nClique no Menu (3 pontinhos) no topo do seu navegador e escolha "Instalar Aplicativo" ou "Adicionar à Tela Inicial".')
      }
    }
  }

  return (
    <button onClick={handleInstall} className={className || "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-surface-hover/50 text-amber-400"}>
      <span className="text-lg">⬇️</span>
      <span>Instalar App</span>
    </button>
  )
}
