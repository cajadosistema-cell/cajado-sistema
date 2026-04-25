'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const mainItems = [
  { href: '/inicio',      label: 'Início',    icon: '⬡',  activeColor: 'text-amber-400'  },
  { href: '/financeiro',  label: 'Cofre',     icon: '💰', activeColor: 'text-teal-400'   },
  { href: '/inbox',       label: 'WhatsApp',  icon: '💬', activeColor: 'text-green-400'  },
  { href: '/cajado',      label: 'CRM',       icon: '🤝', activeColor: 'text-amber-400'  },
  { href: '/vendas',      label: 'Vendas',    icon: '📋', activeColor: 'text-emerald-400'},
]

const moreItems = [
  { href: '/comunicacao',  label: 'Chat Equipe',      icon: '🗨️' },
  { href: '/pf-pessoal',   label: 'Fin. Pessoal',     icon: '💎' },
  { href: '/diario',       label: 'Diário',           icon: '📓' },
  { href: '/organizacao',  label: 'Tarefas',          icon: '✅' },
  { href: '/inteligencia', label: 'IA',               icon: '🧠' },
  { href: '/investimentos',label: 'Investimentos',    icon: '📈' },
  { href: '/patrimonio',   label: 'Patrimônio',       icon: '🏠' },
  { href: '/pos-venda',    label: 'Pós-venda',        icon: '⭐' },
  { href: '/configuracoes',label: 'Configurações',    icon: '⚙️' },
]

export function BottomNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {/* ── Drawer "Mais" ──────────────────────────────── */}
      {showMore && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-[65px] left-0 right-0 bg-[#0a0d16] border-t border-border-subtle rounded-t-2xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-surface-hover rounded-full mx-auto mb-4" />
            <p className="text-[10px] text-fg-disabled uppercase tracking-widest font-bold mb-3">Mais módulos</p>
            <div className="grid grid-cols-4 gap-2">
              {moreItems.map(item => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-xl gap-1 transition-all',
                      isActive
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'text-fg-secondary hover:text-fg hover:bg-muted border border-transparent'
                    )}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-[9px] font-semibold text-center leading-tight">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Nav Bar ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0d16]/95 backdrop-blur-md border-t border-border-subtle pb-safe">
        <div className="flex items-center justify-around px-1 py-2">
          {mainItems.map(item => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 min-w-0 flex-1',
                  isActive ? `${item.activeColor} scale-105` : 'text-fg-tertiary hover:text-fg-secondary'
                )}
              >
                <span className="text-lg mb-0.5">{item.icon}</span>
                <span className="text-[9px] font-bold tracking-wide truncate w-full text-center">{item.label}</span>
                {isActive && (
                  <div className={cn('absolute -bottom-2 w-1 h-1 rounded-full', item.activeColor.replace('text-', 'bg-'))} />
                )}
              </Link>
            )
          })}

          {/* Botão "Mais" */}
          <button
            onClick={() => setShowMore(prev => !prev)}
            className={cn(
              'relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 min-w-0 flex-1',
              showMore ? 'text-amber-400 scale-105' : 'text-fg-tertiary hover:text-fg-secondary'
            )}
          >
            <span className="text-lg mb-0.5">⋯</span>
            <span className="text-[9px] font-bold tracking-wide">Mais</span>
          </button>
        </div>
      </nav>
    </>
  )
}
