import { Sidebar } from '@/components/shared/sidebar'
import { BottomNav } from '@/components/shared/bottom-nav'
import { ChatNotifications } from '@/components/shared/chat-notifications'
import { ToastProvider } from '@/components/shared/toast'
import { BudgetAlertBanner } from '@/components/shared/LimitesOrcamento'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen pb-20 md:pb-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-6 md:py-8">
            {children}
          </div>
        </main>
        <BottomNav />
        {/* Notificações de chat — ativo em TODO o dashboard */}
        <ChatNotifications />
        {/* Alerta de limites de orçamento — aparece uma vez por sessão */}
        <BudgetAlertBanner />
      </div>
    </ToastProvider>
  )
}
