import { cn } from '@/lib/utils'
import Link from 'next/link'

interface MetricCardProps {
  label: string
  value: string | number
  change?: number
  suffix?: string
  className?: string
}

export function MetricCard({ label, value, change, suffix, className }: MetricCardProps) {
  return (
    <div className={cn('metric-card', className)}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">
        {value}
        {suffix && <span className="text-sm font-normal text-fg-tertiary ml-1">{suffix}</span>}
      </p>
      {change !== undefined && (
        <p className={change >= 0 ? 'metric-change-pos' : 'metric-change-neg'}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs mês anterior
        </p>
      )}
    </div>
  )
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  children?: React.ReactNode
}

export function PageHeader({ title, subtitle, showBack = true, children }: PageHeaderProps) {
  return (
    <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        {showBack && (
          <Link
            href="/inicio"
            className="w-8 h-8 rounded-lg bg-page border border-border-subtle flex items-center justify-center text-fg-secondary hover:text-amber-500 hover:border-amber-500/50 transition-all shrink-0 mt-0.5"
            title="Voltar ao Menu"
          >
            <span className="text-lg leading-none">←</span>
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle && <p className="text-sm text-fg-tertiary mt-0.5 line-clamp-2">{subtitle}</p>}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mb-3">
        <span className="text-fg-disabled">○</span>
      </div>
      <p className="text-sm text-fg-tertiary">{message}</p>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativo: 'badge-green',
    novo: 'badge-blue',
    proposta: 'badge-amber',
    retomar: 'badge-purple',
    cliente_ativo: 'badge-green',
    perdido: 'badge-zinc',
    pendente: 'badge-amber',
    validado: 'badge-green',
    automatico: 'badge-blue',
    concluida: 'badge-green',
    execucao: 'badge-amber',
    analise: 'badge-purple',
    ideia: 'badge-zinc',
    descartada: 'badge-red',
    validada: 'badge-green',
    gain: 'badge-green',
    loss: 'badge-red',
    aberta: 'badge-blue',
    monitorando: 'badge-amber',
  }

  const labels: Record<string, string> = {
    ativo: 'Ativo',
    novo: 'Novo',
    proposta: 'Proposta',
    retomar: 'Retomar',
    cliente_ativo: 'Cliente',
    perdido: 'Perdido',
    pendente: 'Pendente',
    validado: 'Validado',
    automatico: 'Automático',
    concluida: 'Concluída',
    execucao: 'Em execução',
    analise: 'Em análise',
    ideia: 'Ideia',
    descartada: 'Descartada',
    validada: 'Validada',
    gain: 'Gain',
    loss: 'Loss',
    aberta: 'Aberta',
    monitorando: 'Monitorando',
  }

  return (
    <span className={map[status] ?? 'badge badge-zinc'}>
      {labels[status] ?? status}
    </span>
  )
}
