'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/inicio', label: 'Início', icon: '⬡' },
    { href: '/financeiro', label: 'Cofre', icon: '💰' },
    { href: '/inbox', label: 'WhatsApp', icon: '💬' },
    { href: '/pf-pessoal', label: 'Pessoal', icon: '💎' },
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
                "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200",
                isActive ? "text-amber-400 scale-110" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className="text-[9px] font-bold tracking-wider">{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-2 w-1 h-1 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
