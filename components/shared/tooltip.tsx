'use client'
import { useState, useRef, useEffect, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
}

export function Tooltip({ content, children, side = 'top', delay = 400, className }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay)
  }
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  const posClass = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side]

  const arrowClass = {
    top:    'top-full left-1/2 -translate-x-1/2 border-t-zinc-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-800',
    left:   'left-full top-1/2 -translate-y-1/2 border-l-zinc-800',
    right:  'right-full top-1/2 -translate-y-1/2 border-r-zinc-800',
  }[side]

  return (
    <span className={cn('relative inline-flex', className)}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && content && (
        <span className={cn(
          'absolute z-[200] pointer-events-none w-max max-w-[220px]',
          'px-2.5 py-1.5 rounded-lg text-[11px] leading-snug font-medium',
          'bg-zinc-800 border border-zinc-700 text-zinc-100 shadow-xl',
          'animate-in fade-in zoom-in-95 duration-150',
          posClass
        )}>
          {content}
          <span className={cn(
            'absolute w-0 h-0 border-4 border-transparent',
            arrowClass
          )} />
        </span>
      )}
    </span>
  )
}
