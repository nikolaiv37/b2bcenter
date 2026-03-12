import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Package, ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTenantPath } from '@/lib/tenant/TenantProvider'

interface Category {
  name: string
  slug: string
  imageUrl: string | null
  productCount: number
}

interface CategoryGridProps {
  categories: Category[]
  isLoading?: boolean
  basePath?: string
}

// Convert category name to URL-safe slug
// eslint-disable-next-line react-refresh/only-export-components
export function categoryToSlug(name: string): string {
  return encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'))
}

// Convert slug back to category name (approximate - for display)
// eslint-disable-next-line react-refresh/only-export-components
export function slugToCategory(slug: string): string {
  return decodeURIComponent(slug).replace(/-/g, ' ')
}

export function CategoryGrid({
  categories,
  isLoading = false,
  basePath,
}: CategoryGridProps) {
  const { t } = useTranslation()
  const { withBase } = useTenantPath()
  const resolvedBasePath = basePath || withBase('/dashboard/categories')
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-16">
        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold mb-2">{t('categories.noCategoriesFound')}</h3>
        <p className="text-muted-foreground">{t('categories.noCategoriesDescription')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      {categories.map((category) => (
        <Link
          key={category.name}
          to={`${resolvedBasePath}/${categoryToSlug(category.name)}`}
          className="group flex flex-col"
        >
          {/* Image container */}
          <div className={cn(
            'relative aspect-[4/3] rounded-2xl overflow-hidden',
            'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900',
            'shadow-md group-hover:shadow-xl transition-all duration-300',
            'ring-1 ring-border/30 group-hover:ring-primary/50'
          )}>
            {category.imageUrl ? (
              <img
                src={category.imageUrl}
                alt={category.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

            {/* Product count */}
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
              <span className="text-white/90 text-sm font-medium">
                {t('categories.productCount', { count: category.productCount })}
              </span>
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>

          {/* Category name */}
          <div className="mt-3 px-1">
            <h3 className="font-semibold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {category.name}
            </h3>
          </div>
        </Link>
      ))}
    </div>
  )
}
