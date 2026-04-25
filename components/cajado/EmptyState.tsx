// components/cajado/EmptyState.tsx
import React from 'react'

type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-surface border-[0.5px] border-border-subtle flex items-center justify-center mb-4 text-fg-tertiary">
          {icon}
        </div>
      )}
      <div className="flex items-center gap-2 mb-2 max-w-xs">
        <div className="flex-1 h-px bg-border-ornament opacity-30" />
        <div className="w-1 h-1 bg-border-ornament rotate-45" />
        <div className="flex-1 h-px bg-border-ornament opacity-30" />
      </div>
      <p className="font-editorial text-base text-fg italic mb-1">{title}</p>
      {description && (
        <p className="text-xs text-fg-secondary max-w-[280px] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
