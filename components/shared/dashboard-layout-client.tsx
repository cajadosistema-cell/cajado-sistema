'use client'

import { usePathname } from 'next/navigation'

const FULLSCREEN_ROUTES = ['/inbox']

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
    </div>
  )
}
