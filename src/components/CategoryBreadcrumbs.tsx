import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Home, Grid3X3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTenantPath } from '@/lib/tenant/TenantProvider'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface CategoryBreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function CategoryBreadcrumbs({ items, className }: CategoryBreadcrumbsProps) {
  const { t } = useTranslation()
  const { withBase } = useTenantPath()
  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)} aria-label={t('general.breadcrumb')}>
      <ol className="flex items-center gap-1 flex-wrap">
        {/* Home link */}
        <li className="flex items-center">
          <Link
            to={withBase('/dashboard')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="sr-only sm:not-sr-only">{t('header.home')}</span>
          </Link>
        </li>

        <li className="flex items-center">
          <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
        </li>

        {/* Categories link */}
        <li className="flex items-center">
          <Link
            to={withBase('/dashboard/categories')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Grid3X3 className="w-4 h-4" />
            <span>{t('nav.categories')}</span>
          </Link>
        </li>

        {/* Dynamic breadcrumb items */}
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
            {item.href ? (
              <Link
                to={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
