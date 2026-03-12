import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function GlassCard({ children, className, hover = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass-card',
        hover && 'glass-hover cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

