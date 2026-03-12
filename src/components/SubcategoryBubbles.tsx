import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, ArrowRight } from 'lucide-react'

interface Subcategory {
  name: string
  fullCategory: string
  imageUrl: string | null
  productCount: number
}

interface SubcategoryBubblesProps {
  subcategories: Subcategory[]
  selectedSubcategory: string | null
  onSubcategorySelect: (fullCategory: string | null) => void
  isLoading?: boolean
  mainCategoryName?: string
}

export function SubcategoryBubbles({
  subcategories,
  selectedSubcategory,
  onSubcategorySelect,
  isLoading = false,
  mainCategoryName,
}: SubcategoryBubblesProps) {
  const { t } = useTranslation()
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
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

  if (subcategories.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">{t('categories.noSubcategoriesFound')}</p>
        {mainCategoryName && (
          <p className="text-sm mt-2">{t('categories.allProductsInCategory', { category: mainCategoryName })}</p>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      {/* Subcategory cards - styled like CategoryGrid */}
      {subcategories.map((subcategory) => {
        const isSelected = selectedSubcategory === subcategory.fullCategory

        return (
          <button
            key={subcategory.fullCategory}
            onClick={() => onSubcategorySelect(subcategory.fullCategory)}
            className="group flex flex-col text-left"
          >
            {/* Image container */}
            <div className={cn(
              'relative aspect-[4/3] rounded-2xl overflow-hidden',
              'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900',
              'shadow-md group-hover:shadow-xl transition-all duration-300',
              'ring-1 ring-border/30 group-hover:ring-primary/50',
              isSelected && 'ring-2 ring-primary'
            )}>
              {subcategory.imageUrl ? (
                <img
                  src={subcategory.imageUrl}
                  alt={subcategory.name}
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
                  {t('categories.productCount', { count: subcategory.productCount })}
                </span>
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>

            {/* Subcategory name */}
            <div className="mt-3 px-1">
              <h3 className={cn(
                'font-semibold text-base sm:text-lg transition-colors line-clamp-2',
                isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'
              )}>
                {subcategory.name}
              </h3>
            </div>
          </button>
        )
      })}
    </div>
  )
}
