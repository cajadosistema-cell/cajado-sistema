import { Sidebar } from '@/components/shared/sidebar'
import { BottomNav } from '@/components/shared/bottom-nav'
import { ChatNotifications } from '@/components/shared/chat-notifications'
import { ToastProvider } from '@/components/shared/toast'
import { BudgetAlertBanner } from '@/components/shared/LimitesOrcamento'
import { HelpButton } from '@/components/shared/help-button'
import { DashboardLayoutClient } from '@/components/shared/dashboard-layout-client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen pb-20 md:pb-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          <DashboardLayoutClient>
            {children}
          </DashboardLayoutClient>
        </main>
        <BottomNav />
        {/* Notificações de chat — ativo em TODO o dashboard */}
        <ChatNotifications />
        {/* Alerta de limites de orçamento — aparece uma vez por sessão */}
        <BudgetAlertBanner />
        {/* Botão de ajuda rápida — guia do sistema */}
        <HelpButton />
      </div>
    </ToastProvider>
  )
}
