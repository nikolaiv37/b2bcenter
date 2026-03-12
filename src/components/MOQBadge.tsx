import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface MOQBadgeProps {
  moq: number
  className?: string
}

export function MOQBadge({ moq, className }: MOQBadgeProps) {
  const getVariant = () => {
    if (moq === 1) return 'default'
    if (moq <= 10) return 'secondary'
    return 'outline'
  }

  const getColor = () => {
    if (moq === 1) return 'bg-green-500/20 text-green-700 dark:text-green-300'
    if (moq <= 10) return 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
    return 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
  }

  return (
    <Badge
      variant={getVariant()}
      className={cn('font-semibold', getColor(), className)}
    >
      MOQ: {moq}
    </Badge>
  )
}

