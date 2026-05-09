'use client'
import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const calcCoords = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const GAP = 8
    let top = 0, left = 0
    if (side === 'right') {
      top  = rect.top + rect.height / 2
      left = rect.right + GAP
    } else if (side === 'left') {
      top  = rect.top + rect.height / 2
      left = rect.left - GAP
    } else if (side === 'bottom') {
      top  = rect.bottom + GAP
      left = rect.left + rect.width / 2
    } else { // top
      top  = rect.top - GAP
      left = rect.left + rect.width / 2
    }
    setCoords({ top, left })
  }

  const show = () => {
    calcCoords()
    timerRef.current = setTimeout(() => { calcCoords(); setVisible(true) }, delay)
  }
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  // Estilos de posicionamento final do balão
  const tooltipStyle: React.CSSProperties = (() => {
    if (side === 'right')  return { top: coords.top, left: coords.left, transform: 'translateY(-50%)' }
    if (side === 'left')   return { top: coords.top, left: coords.left, transform: 'translateY(-50%) translateX(-100%)' }
    if (side === 'bottom') return { top: coords.top, left: coords.left, transform: 'translateX(-50%)' }
    return { top: coords.top, left: coords.left, transform: 'translateX(-50%) translateY(-100%)' }
  })()

  const arrowClass = {
    top:    'top-full left-1/2 -translate-x-1/2 border-t-zinc-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-800',
    left:   'left-full top-1/2 -translate-y-1/2 border-l-zinc-800',
    right:  'right-full top-1/2 -translate-y-1/2 border-r-zinc-800',
  }[side]

  return (
    <span
      ref={triggerRef}
      className={cn('relative inline-flex w-full', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {mounted && visible && content && createPortal(
        <span
          className={cn(
            'fixed z-[9999] pointer-events-none w-max max-w-[240px]',
            'px-2.5 py-1.5 rounded-lg text-[11px] leading-snug font-medium',
            'bg-zinc-800 border border-zinc-700 text-zinc-100 shadow-xl',
          )}
          style={tooltipStyle}
        >
          {content}
          <span className={cn('absolute w-0 h-0 border-4 border-transparent', arrowClass)} />
        </span>,
        document.body
      )}
    </span>
  )
}
