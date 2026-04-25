// components/cajado/ThemeToggle.tsx
'use client'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme-provider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md hover:bg-surface transition-colors text-left"
      aria-label={`Mudar para tema ${isDark ? 'claro' : 'escuro'}`}
    >
      <div className="w-7 h-7 rounded-full bg-brand-gold-soft flex items-center justify-center">
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-brand-gold-text" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-brand-gold-text" />
        )}
      </div>
      <span className="text-xs text-fg-secondary">
        Tema {isDark ? 'escuro' : 'claro'}
      </span>
    </button>
  )
}
