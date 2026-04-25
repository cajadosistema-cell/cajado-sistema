// components/cajado/Hairline.tsx
type HairlineProps = { variant?: 'plain' | 'ornament' | 'gold' }

export function Hairline({ variant = 'plain' }: HairlineProps) {
  if (variant === 'ornament') {
    return (
      <div className="flex items-center gap-2 my-4">
        <div className="flex-1 h-px bg-border-ornament opacity-40" />
        <div className="w-1 h-1 bg-border-ornament rotate-45" />
        <div className="flex-1 h-px bg-border-ornament opacity-40" />
      </div>
    )
  }
  if (variant === 'gold') {
    return <div className="h-px bg-border-ornament opacity-40 my-3" />
  }
  return <div className="h-px bg-border-subtle my-3" />
}
