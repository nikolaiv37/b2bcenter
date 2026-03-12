import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  children: React.ReactNode
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

const Tooltip = ({ children, content, side = 'top' }: TooltipProps) => {
  const [isVisible, setIsVisible] = React.useState(false)

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-800 rounded shadow-lg whitespace-nowrap pointer-events-none',
            side === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-2',
            side === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-2',
            side === 'left' && 'right-full top-1/2 -translate-y-1/2 mr-2',
            side === 'right' && 'left-full top-1/2 -translate-y-1/2 ml-2'
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              'absolute w-0 h-0 border-4 border-transparent',
              side === 'top' && 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-800',
              side === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-800',
              side === 'left' && 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-800',
              side === 'right' && 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-800'
            )}
          />
        </div>
      )}
    </div>
  )
}

const TooltipTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>

const TooltipContent = ({ children }: { children: React.ReactNode }) => <>{children}</>

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

