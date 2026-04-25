// components/cajado/Avatar.tsx
type AvatarProps = {
  name: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
  status?: 'online' | 'away' | 'offline' | null
}

const sizes = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
}

const statusColors = {
  online: 'bg-success',
  away:   'bg-warning',
  offline: 'bg-fg-tertiary',
}

export function Avatar({ name, src, size = 'md', status }: AvatarProps) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <div className="relative inline-block shrink-0">
      <div className={`${sizes[size]} rounded-full bg-brand-green flex items-center justify-center overflow-hidden`}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-editorial text-brand-gold font-medium">{initial}</span>
        )}
      </div>
      {status && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[0.5px] border-surface ${statusColors[status]}`}
        />
      )}
    </div>
  )
}
