import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const { t } = useTranslation()
  const pages = React.useMemo(() => {
    const items: (number | 'ellipsis')[] = []
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(i)
      }
    } else {
      items.push(1)
      
      if (currentPage > 3) {
        items.push('ellipsis')
      }
      
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        items.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        items.push('ellipsis')
      }
      
      items.push(totalPages)
    }
    
    return items
  }, [currentPage, totalPages])

  if (totalPages <= 1) return null

  return (
    <nav
      role="navigation"
      aria-label={t('general.pagination')}
      className={cn('flex justify-center', className)}
    >
      <ul className="flex items-center gap-1">
        <li>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label={t('general.paginationPrevious')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </li>
        {pages.map((page, i) => (
          <li key={`${page}-${i}`}>
            {page === 'ellipsis' ? (
              <span className="flex h-8 w-8 items-center justify-center">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </span>
            ) : (
              <Button
                variant={currentPage === page ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-8 w-8 p-0 text-xs font-medium',
                  currentPage === page && 'pointer-events-none'
                )}
                onClick={() => onPageChange(page)}
                aria-label={t('general.paginationPage', { page })}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </Button>
            )}
          </li>
        ))}
        <li>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label={t('general.paginationNext')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </li>
      </ul>
    </nav>
  )
}
