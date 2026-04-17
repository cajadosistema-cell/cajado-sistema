import { Sidebar } from '@/components/shared/sidebar'
import { BottomNav } from '@/components/shared/bottom-nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen pb-20 md:pb-0"> {/* padding-bottom to prevent content cutoff by bottom nav on mobile */}
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
