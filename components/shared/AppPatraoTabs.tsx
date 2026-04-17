'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const APP_PATRAO_MODULES = [
  { href: '/pf-pessoal', label: 'Financeiro', emoji: '💰' },
  { href: '/patrimonio', label: 'Patrimônio', emoji: '🏠' },
  { href: '/investimentos', label: 'Investimentos', emoji: '📈' },
  { href: '/trader', label: 'Day Trader', emoji: '⚡' },
  { href: '/gestao-pessoal', label: 'Equipe/Hábitos', emoji: '👥' },
]

export function AppPatraoTabs() {
  const pathname = usePathname()

  // Only render if we are in one of these modules
  if (!APP_PATRAO_MODULES.some(m => pathname?.startsWith(m.href))) return null

  return (
    <div className="flex items-center gap-1 bg-[#111827] border border-white/5 rounded-xl p-1 mb-6 w-full max-w-full overflow-x-auto scrollbar-hide">
      {APP_PATRAO_MODULES.map(m => {
        const isActive = pathname === m.href
        return (
          <Link
            key={m.href}
            href={m.href}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2',
              isActive 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
            )}
          >
            <span>{m.emoji}</span> {m.label}
          </Link>
        )
      })}
    </div>
  )
}
