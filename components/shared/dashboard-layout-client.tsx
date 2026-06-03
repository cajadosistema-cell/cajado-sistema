'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlarmManager } from '@/components/shared/AlarmManager'

const FULLSCREEN_ROUTES = ['/inbox']

// ── AlarmManager Global — funciona em TODAS as páginas do dashboard ──
// Obtém o userId do Supabase auth e monta o AlarmManager globalmente,
// substituindo a montagem anterior que ficava apenas em /pf-pessoal.
function GlobalAlarmManager() {
  const [userId, setUserId] = useState('')
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])
  if (!userId) return null
  return <AlarmManager userId={userId} />
}

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFullscreen = FULLSCREEN_ROUTES.some(r => pathname.startsWith(r))

  if (isFullscreen) {
    // Inbox: sem container, sem padding, altura total da viewport
    return <>{children}</>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-6 md:py-8">
      {children}
      {/* AlarmManager global — notificações de agenda em todas as páginas */}
      <GlobalAlarmManager />
    </div>
  )
}
