// components/cajado/KPICard.tsx
type KPICardProps = {
  label: string
  value: string | number
  variant?: 'default' | 'highlighted'
  hint?: string
}

export function KPICard({ label, value, variant = 'default', hint }: KPICardProps) {
  if (variant === 'highlighted') {
    return (
      <div className="bg-brand-green rounded-lg p-4 relative overflow-hidden">
        <p className="text-[10px] uppercase tracking-wider font-medium text-brand-gold mb-1.5">{label}</p>
        <p className="font-editorial text-2xl text-fg-on-dark">{value}</p>
        {hint && <p className="text-xs text-brand-gold/70 mt-1">{hint}</p>}
      </div>
    )
  }
  return (
    <div className="bg-surface border-[0.5px] border-border-subtle rounded-lg p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5">
      <div className="absolute top-4 left-0 w-0.5 h-3.5 bg-brand-gold" />
      <p className="text-[10px] uppercase tracking-wider font-medium text-fg-tertiary mb-1.5 ml-2">{label}</p>
      <p className="font-editorial text-2xl text-fg ml-2">{value}</p>
      {hint && <p className="text-xs text-fg-secondary mt-1 ml-2">{hint}</p>}
    </div>
  )
}
