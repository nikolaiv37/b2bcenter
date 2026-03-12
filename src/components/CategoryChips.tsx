import { cn } from '@/lib/utils'
import { Package } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface MainCategory {
  name: string
  imageUrl: string | null
  productCount: number
}

interface CategoryChipsProps {
  categories: MainCategory[]
  selectedCategory: string | null
  onCategorySelect: (category: string | null) => void
  isLoading?: boolean
}

export function CategoryChips({
  categories,
  selectedCategory,
  onCategorySelect,
  isLoading = false,
}: CategoryChipsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    )
  }

  if (categories.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {/* All Products card */}
      <button
        onClick={() => onCategorySelect(null)}
        className="group flex flex-col items-center gap-2.5"
      >
        <div className={cn(
          'relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden transition-all duration-200',
          'flex items-center justify-center',
          'hover:scale-105 active:scale-95',
          'shadow-md hover:shadow-xl',
          !selectedCategory
            ? 'bg-primary ring-3 ring-primary ring-offset-2 ring-offset-background shadow-primary/30'
            : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 hover:from-slate-50 hover:to-slate-150 dark:hover:from-slate-700 dark:hover:to-slate-800'
        )}>
          <Package className={cn(
            'w-10 h-10 sm:w-12 sm:h-12 transition-transform group-hover:scale-110',
            !selectedCategory ? 'text-primary-foreground' : 'text-slate-500 dark:text-slate-400'
          )} />
        </div>
        <div className="text-center">
          <p className={cn(
            'font-semibold text-sm sm:text-base transition-colors',
            !selectedCategory ? 'text-primary' : 'text-foreground group-hover:text-primary'
          )}>
            All Products
          </p>
        </div>
      </button>

      {/* Category cards */}
      {categories.map((category) => {
        const isSelected = selectedCategory === category.name

        return (
          <button
            key={category.name}
            onClick={() => onCategorySelect(category.name)}
            className="group flex flex-col items-center gap-2.5"
          >
            {/* Image container */}
            <div className={cn(
              'relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden transition-all duration-200',
              'hover:scale-105 active:scale-95',
              'shadow-md hover:shadow-xl',
              isSelected
                ? 'ring-3 ring-primary ring-offset-2 ring-offset-background shadow-primary/30'
                : 'ring-1 ring-border/50 hover:ring-primary/50'
            )}>
              {category.imageUrl ? (
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                  <Package className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 dark:text-slate-500" />
                </div>
              )}

              {/* Product count badge */}
              <span className={cn(
                'absolute top-2 right-2 px-2 py-0.5 text-xs font-bold rounded-full',
                'bg-black/60 text-white backdrop-blur-sm'
              )}>
                {category.productCount}
              </span>

              {/* Hover overlay */}
              <div className={cn(
                'absolute inset-0 transition-opacity duration-200',
                isSelected
                  ? 'bg-primary/10'
                  : 'bg-black/0 group-hover:bg-black/10'
              )} />
            </div>

            {/* Category name - below the card */}
            <div className="text-center max-w-full px-1">
              <p className={cn(
                'font-semibold text-xs sm:text-sm leading-tight line-clamp-2 transition-colors',
                isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'
              )}>
                {category.name}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
