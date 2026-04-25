'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'cajado-pwa-dismissed'

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Já instalado ou descartado anteriormente
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      localStorage.getItem(STORAGE_KEY) === '1'
    ) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Aguarda 3s para não aparecer imediatamente
      setTimeout(() => setVisible(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Detecta instalação bem-sucedida via outro meio
    window.addEventListener('appinstalled', () => {
      setVisible(false)
      setInstalled(true)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
      setVisible(false)
    }
    setInstalling(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500"
      role="dialog"
      aria-label="Instalar Cajado como aplicativo"
    >
      <div
        className="relative overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #0d1117 0%, #111827 100%)',
          borderColor: 'rgba(245,158,11,0.25)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.1)',
        }}
      >
        {/* Brilho dourado no topo */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none" style={{ background: 'rgba(245,158,11,0.12)' }} />

        <div className="relative p-4 flex items-center gap-4">
          {/* Ícone */}
          <div
            className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center shadow-lg border border-amber-500/20"
            style={{ background: 'linear-gradient(135deg, #1F4A2E, #0d2b1a)' }}
          >
            <img src="/icons/icon-96.png" alt="Cajado" className="w-10 h-10 object-contain" />
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">
              Instalar Cajado Soluções
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
              Acesso rápido, funciona offline e sem abrir o navegador.
            </p>

            {/* Badges */}
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

          {/* Botão fechar */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors text-xs"
            aria-label="Dispensar"
          >
            ✕
          </button>
        </div>

        {/* Botões */}
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors border border-white/10"
          >
            Agora não
          </button>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-black transition-all flex items-center justify-center gap-1.5"
            style={{
              background: installing
                ? 'rgba(245,158,11,0.5)'
                : 'linear-gradient(135deg, #F59E0B, #D97706)',
              boxShadow: '0 4px 15px rgba(245,158,11,0.35)',
            }}
          >
            {installing ? (
              <>⏳ Instalando...</>
            ) : (
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
