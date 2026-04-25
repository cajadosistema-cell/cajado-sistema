'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const APP_PATRAO_MODULES = [
  {
    href: '/pf-pessoal',
    label: 'Financeiro',
    labelMobile: 'Finanças',
    emoji: '💰',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  {
    href: '/patrimonio',
    label: 'Patrimônio',
    labelMobile: 'Patrimônio',
    emoji: '🏠',
    gradient: 'from-blue-500/20 to-indigo-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
  {
    href: '/investimentos',
    label: 'Investimentos',
    labelMobile: 'Invest.',
    emoji: '📈',
    gradient: 'from-violet-500/20 to-purple-500/10',
    border: 'border-violet-500/30',
    text: 'text-violet-400',
    glow: 'shadow-violet-500/20',
  },
  {
    href: '/trader',
    label: 'Day Trader',
    labelMobile: 'Trader',
    emoji: '⚡',
    gradient: 'from-amber-500/20 to-orange-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  {
    href: '/gestao-pessoal',
    label: 'Equipe',
    labelMobile: 'Equipe',
    emoji: '👥',
    gradient: 'from-rose-500/20 to-pink-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    glow: 'shadow-rose-500/20',
  },
]

export function AppPatraoTabs() {
  const pathname = usePathname()
  const isInModule = APP_PATRAO_MODULES.some(m => pathname?.startsWith(m.href))
  if (!isInModule) return null

  return (
    <div className="mb-6">
      {/* Header identidade "App do Patrão" — só desktop */}
      <div className="hidden md:flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-amber-500/60">
          App do Patrão
        </span>
      </div>

      {/* Barra de navegação */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 -mx-0.5 px-0.5">
        {APP_PATRAO_MODULES.map(m => {
          const isActive = pathname?.startsWith(m.href)
          return (
            <Link
              key={m.href}
              href={m.href}
              className={cn(
                // Base
                'flex items-center gap-2 rounded-xl border transition-all duration-200',
                'shrink-0 font-semibold whitespace-nowrap',
                // Mobile: compacto com emoji + texto curto
                'px-3 py-2 text-xs',
                // Desktop: maior
                'md:px-4 md:py-2.5 md:text-sm',
                // Estado
                isActive
                  ? [
                      'bg-gradient-to-r',
                      m.gradient,
                      m.border,
                      m.text,
                      'shadow-md',
                      m.glow,
                    ]
                  : 'bg-page border-border-subtle text-fg-tertiary hover:text-fg-secondary hover:bg-muted/60 hover:border-border-subtle'
              )}
            >
              <span className={cn('text-base leading-none', isActive ? '' : 'opacity-60')}>
                {m.emoji}
              </span>
              <span className="hidden sm:inline">{m.label}</span>
              <span className="sm:hidden">{m.labelMobile}</span>
              {isActive && (
                <span className={cn('ml-auto w-1.5 h-1.5 rounded-full hidden md:block', m.text.replace('text-', 'bg-'))} />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
