'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
  confirm: (message: string, onConfirm: () => void) => void
}

// ── Context ──────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null)

// ── Hook ─────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ── Config ───────────────────────────────────────────────────
const TOAST_CONFIG: Record<ToastType, { icon: string; bar: string; bg: string; border: string; text: string }> = {
  success: { icon: '✅', bar: 'bg-emerald-500', bg: 'bg-zinc-900', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  error:   { icon: '❌', bar: 'bg-red-500',     bg: 'bg-zinc-900', border: 'border-red-500/30',     text: 'text-red-300'     },
  warning: { icon: '⚠️', bar: 'bg-amber-500',   bg: 'bg-zinc-900', border: 'border-amber-500/30',   text: 'text-amber-300'   },
  info:    { icon: '💡', bar: 'bg-blue-500',    bg: 'bg-zinc-900', border: 'border-blue-500/30',    text: 'text-blue-300'    },
}

// ── Confirm Dialog State ─────────────────────────────────────
interface ConfirmState {
  message: string
  onConfirm: () => void
}

// ── Provider ─────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null)

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast])
  const error   = useCallback((msg: string) => toast(msg, 'error', 5000), [toast])
  const warning = useCallback((msg: string) => toast(msg, 'warning'), [toast])
  const info    = useCallback((msg: string) => toast(msg, 'info'), [toast])

  const confirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm })
  }, [])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, confirm }}>
      {children}

      {/* ── Toast Stack ────────────────────────────────── */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[200] flex flex-col-reverse gap-2 pointer-events-none"
        style={{ maxWidth: '360px' }}
      >
        {toasts.map(t => {
          const cfg = TOAST_CONFIG[t.type]
          return (
            <div
              key={t.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md',
                'pointer-events-auto animate-in slide-in-from-bottom-2 fade-in',
                cfg.bg, cfg.border
              )}
            >
              {/* colored left bar */}
              <div className={cn('w-1 self-stretch rounded-full shrink-0 -ml-1 mr-1', cfg.bar)} />
              <span className="text-base leading-none mt-0.5 shrink-0">{cfg.icon}</span>
              <p className="text-sm text-zinc-200 leading-snug flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-zinc-600 hover:text-zinc-300 transition-colors text-lg leading-none shrink-0 -mt-0.5"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Confirm Dialog ─────────────────────────────── */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* top bar */}
            <div className="h-1 bg-amber-500 w-full" />
            <div className="p-6">
              <div className="flex items-start gap-3 mb-5">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-100 mb-1">Confirmar ação</p>
                  <p className="text-sm text-zinc-400 leading-relaxed">{confirmDialog.message}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    confirmDialog.onConfirm()
                    setConfirmDialog(null)
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
