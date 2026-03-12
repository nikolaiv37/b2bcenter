import { useState, useEffect } from 'react'
import { useCategoryHierarchy, CategoryInfo } from '@/hooks/useCategoryHierarchy'
import { Skeleton } from './ui/skeleton'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryBubblesProps {
  selectedCategory?: string
  onCategorySelect: (category: string | null) => void
  companyId?: string
  className?: string
}

export function CategoryBubbles({
  selectedCategory,
  onCategorySelect,
  companyId,
  className,
}: CategoryBubblesProps) {
  const { data: hierarchy, isLoading, error } = useCategoryHierarchy(companyId)
  const [expandedMainCategory, setExpandedMainCategory] = useState<string | null>(null)
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [imageLoadStates, setImageLoadStates] = useState<Map<string, boolean>>(new Map())

  // Parse selected category to determine active states
  useEffect(() => {
    if (!selectedCategory || selectedCategory === 'all') {
      setSelectedMainCategory(null)
      setSelectedSubcategory(null)
      setExpandedMainCategory(null)
      return
    }

    const parts = selectedCategory.split('>').map(p => p.trim())
    if (parts.length > 1) {
      setSelectedMainCategory(parts[0])
      setSelectedSubcategory(parts.slice(1).join(' > '))
      setExpandedMainCategory(parts[0])
    } else {
      setSelectedMainCategory(selectedCategory)
      setSelectedSubcategory(null)
      setExpandedMainCategory(selectedCategory)
    }
  }, [selectedCategory])

  const handleImageLoad = (key: string) => {
    setImageLoadStates(prev => new Map(prev).set(key, true))
  }

  const handleMainCategoryClick = (mainCategory: string) => {
    if (expandedMainCategory === mainCategory) {
      // Collapse if already expanded
      setExpandedMainCategory(null)
      setSelectedMainCategory(null)
      setSelectedSubcategory(null)
      onCategorySelect(null)
    } else {
      // Expand and show subcategories
      setExpandedMainCategory(mainCategory)
      setSelectedMainCategory(mainCategory)
      setSelectedSubcategory(null)
    }
  }

  const handleSubcategoryClick = (categoryInfo: CategoryInfo) => {
    setSelectedSubcategory(categoryInfo.subcategory)
    onCategorySelect(categoryInfo.fullCategory)
  }

  if (error) {
    return null // Fail silently
  }

  if (isLoading) {
    return (
      <div className={cn('mb-8', className)}>
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-6 mb-6">
          <div className="max-w-7xl mx-auto px-4">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="w-40 h-40 rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!hierarchy || hierarchy.mainCategories.size === 0) {
    return null
  }

  const mainCategoriesArray = Array.from(hierarchy.mainCategories.values())
  const totalProducts = mainCategoriesArray.reduce((sum, cat) => sum + cat.productCount, 0)
  const totalCategories = mainCategoriesArray.length

  return (
    <div className={cn('mb-8', className)}>
      {/* Header Section - Mebeli.bg Style */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-6 mb-6">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            Разгледайте по категории
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {totalProducts}+ продукта в {totalCategories} основни категории
          </p>
        </div>
      </div>

      {/* Main Categories Grid */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {mainCategoriesArray.map((mainCat) => {
              const isSelected = selectedMainCategory === mainCat.name
              const imageKey = `main-${mainCat.name}`
              const imageLoaded = imageLoadStates.get(imageKey)

              return (
                <div key={mainCat.name} className="flex flex-col items-center flex-shrink-0 snap-center">
                  <button
                    onClick={() => handleMainCategoryClick(mainCat.name)}
                    className={cn(
                      'relative group overflow-hidden transition-all duration-300',
                      'hover:scale-[1.03] hover:shadow-lg active:scale-100',
                      'w-40 h-40 sm:w-48 sm:h-48 md:w-52 md:h-52',
                      isSelected && 'ring-2 ring-primary shadow-lg',
                      'rounded-[20px]'
                    )}
                  >
                    {/* Background Image */}
                    {mainCat.imageUrl ? (
                      <>
                        {!imageLoaded && (
                          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-[20px]" />
                        )}
                        <img
                          src={mainCat.imageUrl}
                          alt={mainCat.name}
                          className={cn(
                            'absolute inset-0 w-full h-full object-cover transition-all duration-500 rounded-[20px]',
                            'group-hover:brightness-110',
                            imageLoaded ? 'opacity-100' : 'opacity-0'
                          )}
                          loading="lazy"
                          onLoad={() => handleImageLoad(imageKey)}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-[20px]" />
                    )}

                    {/* Selected State Indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10">
                        <Check className="w-5 h-5 text-white drop-shadow-lg bg-primary/80 rounded-full p-0.5" />
                      </div>
                    )}

                    {/* Selected Border */}
                    {isSelected && (
                      <div className="absolute inset-0 border-2 border-primary rounded-[20px] pointer-events-none" />
                    )}
                  </button>
                  
                  {/* Category Name Below Image */}
                  <span className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 text-center max-w-[160px] sm:max-w-[200px] md:max-w-[210px] line-clamp-2">
                    {mainCat.name}
                  </span>
                </div>
              )
            })}
        </div>
      </div>

      {/* Subcategory Grid - Appears Below When Main Category Clicked */}
      {expandedMainCategory && hierarchy && hierarchy.mainCategories.has(expandedMainCategory) && (
        <div className="max-w-7xl mx-auto px-4 mt-6 animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {Array.from(
              hierarchy.mainCategories.get(expandedMainCategory)!.subcategories.values()
            ).map((subCat) => {
                const isSubSelected = selectedSubcategory === subCat.subcategory
                const imageKey = `sub-${subCat.subcategory}`
                const imageLoaded = imageLoadStates.get(imageKey)

                return (
                  <div key={subCat.subcategory} className="flex flex-col items-center flex-shrink-0 snap-center">
                    <button
                      onClick={() => handleSubcategoryClick(subCat)}
                      className={cn(
                        'relative group overflow-hidden transition-all duration-300',
                        'hover:scale-[1.03] hover:shadow-lg active:scale-100',
                        'w-36 h-36 sm:w-40 sm:h-40 md:w-44 md:h-44',
                        isSubSelected && 'ring-2 ring-primary shadow-lg',
                        'rounded-[20px]'
                      )}
                    >
                      {/* Background Image */}
                      {subCat.imageUrl ? (
                        <>
                          {!imageLoaded && (
                            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-[20px]" />
                          )}
                          <img
                            src={subCat.imageUrl}
                            alt={subCat.subcategory}
                            className={cn(
                              'absolute inset-0 w-full h-full object-cover transition-all duration-500 rounded-[20px]',
                              'group-hover:brightness-110',
                              imageLoaded ? 'opacity-100' : 'opacity-0'
                            )}
                            loading="lazy"
                            onLoad={() => handleImageLoad(imageKey)}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-[20px]" />
                      )}

                      {/* Selected State Indicator */}
                      {isSubSelected && (
                        <div className="absolute top-1.5 right-1.5 z-10">
                          <Check className="w-4 h-4 text-white drop-shadow-lg bg-primary/80 rounded-full p-0.5" />
                        </div>
                      )}

                      {/* Selected Border */}
                      {isSubSelected && (
                        <div className="absolute inset-0 border-2 border-primary rounded-[20px] pointer-events-none" />
                      )}
                    </button>
                    
                    {/* Subcategory Name Below Image */}
                    <span className="mt-2 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 text-center max-w-[140px] sm:max-w-[160px] md:max-w-[180px] line-clamp-2">
                      {subCat.subcategory}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
