// components/cajado/StatusBadge.tsx
type BadgeVariant = 'open' | 'pending' | 'done' | 'overdue' | 'cancelled' | 'info'

const variants: Record<BadgeVariant, string> = {
  open:      'bg-brand-green-soft text-brand-green-text border-success/30',
  pending:   'bg-warning-soft text-warning-text border-warning/30',
  done:      'bg-success-soft text-success-text border-success/30',
  overdue:   'bg-danger-soft text-danger-text border-danger/30',
  cancelled: 'bg-muted text-fg-tertiary border-border-subtle',
  info:      'bg-info-soft text-info-text border-info/30',
}

export function StatusBadge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border-[0.5px] ${variants[variant]}`}
    >
      {children}
    </span>
  )
}
