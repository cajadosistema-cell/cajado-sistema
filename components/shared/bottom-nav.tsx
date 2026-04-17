'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/inicio',       label: 'Início',    icon: '⬡',  activeColor: 'text-amber-400'  },
    { href: '/financeiro',   label: 'Cofre',     icon: '💰', activeColor: 'text-teal-400'   },
    { href: '/inbox',        label: 'WhatsApp',  icon: '💬', activeColor: 'text-green-400'  },
    { href: '/comunicacao',  label: 'Chat',      icon: '🗨️', activeColor: 'text-violet-400' },
    { href: '/pf-pessoal',   label: 'Pessoal',   icon: '💎', activeColor: 'text-rose-400'   },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0d16]/95 backdrop-blur-md border-t border-zinc-800 pb-safe">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(item => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200",
                isActive ? `${item.activeColor} scale-110` : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className="text-[9px] font-bold tracking-wider">{item.label}</span>
              {isActive && (
                <div className={cn("absolute -bottom-2 w-1 h-1 rounded-full", item.activeColor.replace('text-', 'bg-'))} />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
