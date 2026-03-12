import { useState, useMemo, useEffect } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { GlassCard } from '@/components/GlassCard'
import { ProductGridCard } from '@/components/ProductGridCard'
import { ProductQuickViewModal } from '@/components/ProductQuickViewModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { Product } from '@/types'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { applyCommissionRate, shouldApplyCommission } from '@/lib/priceUtils'

const ITEMS_PER_PAGE = 24
const INITIAL_LOAD_SIZE = 150 // Load 150 products initially for fast render

// Type for category data used in filters
type CategoryFilterItem = { id: string; name: string; displayName: string }

// Helper function to get category IDs for filtering (main category + subcategories)
function getCategoryIdsForFilter(
  selectedCategoryId: string,
  categoriesData: CategoryFilterItem[]
): string[] {
  if (selectedCategoryId === 'all') return []

  const selectedCat = categoriesData.find(c => c.id === selectedCategoryId)
  if (!selectedCat) return [selectedCategoryId]

  // Check if this is a main category (doesn't start with indentation)
  const isMainCategory = !selectedCat.displayName.startsWith('  └')

  if (isMainCategory) {
    // Include main category and all its subcategories
    const categoryIds = [selectedCategoryId]
    const mainIdx = categoriesData.findIndex(cat => cat.id === selectedCategoryId)
    
    // Find all subcategories (they appear after the main category until the next main category)
    for (let i = mainIdx + 1; i < categoriesData.length; i++) {
      if (categoriesData[i].displayName.startsWith('  └')) {
        categoryIds.push(categoriesData[i].id)
      } else {
        // Hit the next main category, stop
        break
      }
    }
    return categoryIds
  }

  // Just filter by this specific subcategory
  return [selectedCategoryId]
}

/**
 * Apply commission-based price adjustments to products.
 * Only company users with a commission_rate > 0 get adjusted prices.
 */
function applyCommissionToProducts(
  products: Product[],
  role: string | null | undefined,
  commissionRate: number | null | undefined
): Product[] {
  // Check if we should apply commission
  if (!shouldApplyCommission(role, commissionRate)) {
    // Return products with adjusted_price = weboffer_price (no discount)
    return products.map((p) => ({
      ...p,
      adjusted_price: p.weboffer_price,
    }))
  }

  // Apply commission rate to each product
  return products.map((p) => ({
    ...p,
    adjusted_price: applyCommissionRate(p.weboffer_price, commissionRate),
  }))
}

export function ProductsPage() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all')
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false)

  const { profile } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()
  const isAdmin = profile?.role === 'admin'

  // Fetch categories from normalized categories table FIRST
  // (needed for category filtering in other queries)
  const { data: categoriesData = [] } = useQuery({
    queryKey: ['workspace', 'products', 'categories-for-filter'],
    queryFn: async () => {
      if (!tenantId) return []
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, parent_id')
        .eq('tenant_id', tenantId)
        .order('name')

      if (error) throw error

      // Build hierarchical category list with indentation for subcategories
      const mainCategories = data.filter(c => !c.parent_id)
      const result: CategoryFilterItem[] = []

      for (const main of mainCategories) {
        result.push({ id: main.id, name: main.name, displayName: main.name })
        const subs = data.filter(c => c.parent_id === main.id)
        for (const sub of subs) {
          result.push({ id: sub.id, name: sub.name, displayName: `  └ ${sub.name}` })
        }
      }

      return result
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: !!tenantId,
  })

  // Build base query with filters (for both count and data queries)
  // Using normalized category_id instead of legacy text-based category
  const buildBaseQuery = () => {
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })

    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    // Search filter (server-side) - still search legacy category text for UX
    if (searchQuery) {
      query = query.or(
        `name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`
      )
    }

    // Category filter using normalized category_id
    if (selectedCategory !== 'all') {
      const categoryIds = getCategoryIdsForFilter(selectedCategory, categoriesData)
      if (categoryIds.length > 0) {
        query = query.in('category_id', categoryIds)
      }
    }

    // Manufacturer filter
    if (selectedManufacturer !== 'all') {
      query = query.eq('manufacturer', selectedManufacturer)
    }

    // Availability filter
    if (selectedAvailability !== 'all') {
      query = query.eq('availability', selectedAvailability)
    }

    // Stock filter
    if (stockFilter === 'in-stock') {
      query = query.gt('quantity', 0)
    } else if (stockFilter === 'low-stock') {
      query = query.gt('quantity', 0).lte('quantity', 10)
    } else if (stockFilter === 'out-of-stock') {
      query = query.eq('quantity', 0)
    }

    return query.order('created_at', { ascending: false })
  }

  // Calculate pagination range
  const getPaginationRange = () => {
    // For initial load (page 1), load INITIAL_LOAD_SIZE products for fast subsequent pages
    if (currentPage === 1) {
      return { from: 0, to: INITIAL_LOAD_SIZE - 1 }
    }
    // For subsequent pages, calculate the range
    const pagesFromInitialLoad = Math.ceil(INITIAL_LOAD_SIZE / ITEMS_PER_PAGE)
    if (currentPage <= pagesFromInitialLoad) {
      // For pages 2-7, we can use cached data from page 1, but also fetch to be safe
      // Actually, let's just use the cache - no need to fetch again
      return null // Signal to use cache
    }
    // For pages beyond initial load, fetch the specific range
    const from = INITIAL_LOAD_SIZE + (currentPage - pagesFromInitialLoad - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1
    return { from, to }
  }

  // Fetch paginated products with server-side filters
  const range = getPaginationRange()
  const { data: products, isLoading } = useQuery({
    queryKey: [
      'tenant',
      tenantId,
      'products',
      'paginated',
      searchQuery,
      selectedCategory,
      selectedManufacturer,
      selectedAvailability,
      stockFilter,
      currentPage,
      categoriesData, // Include categories in key since buildBaseQuery depends on it
      profile?.id,
      profile?.commission_rate, // Include commission rate to refetch when it changes
    ],
    queryFn: async () => {
      if (!tenantId) return []
      if (!range) {
        // For pages 2-7, return empty - we'll use cached page 1 data
        return []
      }
      const query = buildBaseQuery().range(range.from, range.to)

      const { data, error } = await query

      if (error) throw error
      
      // Apply commission-based pricing
      return applyCommissionToProducts(data as Product[], profile?.role, profile?.commission_rate)
    },
    enabled: !!tenantId,
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  })

  // Get cached data from page 1 query for pages 2-7
  const cachedPage1Data = queryClient.getQueryData<Product[]>([
    'tenant',
    tenantId,
    'products',
    'paginated',
    searchQuery,
    selectedCategory,
    selectedManufacturer,
    selectedAvailability,
    stockFilter,
    1,
    categoriesData,
  ])

  // Fetch total count with same filters (using normalized category_id)
  const { data: totalCount } = useQuery({
    queryKey: [
      'tenant',
      tenantId,
      'products',
      'count',
      searchQuery,
      selectedCategory,
      selectedManufacturer,
      selectedAvailability,
      stockFilter,
      categoriesData, // Include categories data in query key since we use it for hierarchy
    ],
    queryFn: async () => {
      if (!tenantId) return 0
      // Build count query - use head: true to get only count
      let countQuery = supabase.from('products').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)

      // Apply same filters as data query
      if (searchQuery) {
        countQuery = countQuery.or(
          `name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`
        )
      }
      
      // Category filter using normalized category_id
      if (selectedCategory !== 'all') {
        const categoryIds = getCategoryIdsForFilter(selectedCategory, categoriesData)
        if (categoryIds.length > 0) {
          countQuery = countQuery.in('category_id', categoryIds)
        }
      }
      
      if (selectedManufacturer !== 'all') {
        countQuery = countQuery.eq('manufacturer', selectedManufacturer)
      }
      if (selectedAvailability !== 'all') {
        countQuery = countQuery.eq('availability', selectedAvailability)
      }
      if (stockFilter === 'in-stock') {
        countQuery = countQuery.gt('quantity', 0)
      } else if (stockFilter === 'low-stock') {
        countQuery = countQuery.gt('quantity', 0).lte('quantity', 10)
      } else if (stockFilter === 'out-of-stock') {
        countQuery = countQuery.eq('quantity', 0)
      }

      const { count, error } = await countQuery

      if (error) throw error
      return count ?? 0
    },
    enabled: !!tenantId,
  })

  // Fetch filter options (manufacturers, availability) from products
  const { data: filterOptions } = useQuery({
    queryKey: ['workspace', 'products', 'filter-options'],
    queryFn: async () => {
      if (!tenantId) return { manufacturers: [], availabilityOptions: [] }
      const { data, error } = await supabase
        .from('products')
        .select('manufacturer, availability')
        .eq('tenant_id', tenantId)
        .limit(10000) // Get enough to extract unique values

      if (error) throw error

      const manufacturers = Array.from(
        new Set(data.map((p) => p.manufacturer).filter(Boolean))
      ).sort() as string[]
      const availabilityOptions = Array.from(
        new Set(data.map((p) => p.availability).filter(Boolean))
      ).sort() as string[]

      return { manufacturers, availabilityOptions }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: !!tenantId,
  })

  const { manufacturers = [], availabilityOptions = [] } = filterOptions || {}

  // Calculate paginated products for display
  const paginatedProducts = useMemo(() => {
    // For pages 2-7, use cached data from page 1 if available
    const pagesFromInitialLoad = Math.ceil(INITIAL_LOAD_SIZE / ITEMS_PER_PAGE)
    if (currentPage > 1 && currentPage <= pagesFromInitialLoad && cachedPage1Data) {
      const start = (currentPage - 1) * ITEMS_PER_PAGE
      const end = start + ITEMS_PER_PAGE
      return cachedPage1Data.slice(start, end)
    }

    // For page 1, show first ITEMS_PER_PAGE from the initial load
    if (currentPage === 1 && products) {
      return products.slice(0, ITEMS_PER_PAGE)
    }
    
    // For later pages, use the fetched products directly
    if (products) {
      return products
    }
    
    return []
  }, [products, currentPage, cachedPage1Data])

  // Calculate total pages based on total count
  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory, selectedManufacturer, selectedAvailability, stockFilter])

  const deleteMutation = useMutation({
    mutationFn: async (productId: string | number) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('tenant_id', tenantId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products', 'count'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'products', 'filter-options'] })
      toast({
        title: t('products.productDeleted'),
        description: t('products.productRemoved'),
      })
    },
    onError: () => {
      toast({
        title: t('products.error'),
        description: t('products.failedToDelete'),
        variant: 'destructive',
      })
    },
  })

  const handleQuickView = (product: Product) => {
    setSelectedProduct(product)
    setIsQuickViewOpen(true)
  }

  const handleEdit = () => {
    // TODO: Implement edit functionality
    toast({
      title: t('products.editProduct'),
      description: t('products.editComingSoon'),
    })
  }

  const handleDelete = (product: Product) => {
    if (confirm(t('products.deleteConfirm', { name: product.name }))) {
      deleteMutation.mutate(product.id)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedManufacturer('all')
    setSelectedAvailability('all')
    setStockFilter('all')
    setCurrentPage(1)
  }

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== 'all' ||
    selectedManufacturer !== 'all' ||
    selectedAvailability !== 'all' ||
    stockFilter !== 'all'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{t('products.title')}</h1>
        <p className="text-muted-foreground">
          {isLoading && !totalCount ? t('products.loading') : `${totalCount ?? 0} ${t('products.products')}`}
        </p>
      </div>

      {/* Search and Filters */}
      <GlassCard>
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('products.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              value={selectedCategory}
              onValueChange={(value) => {
                setSelectedCategory(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('products.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('products.allCategories')}</SelectItem>
                {categoriesData.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedManufacturer}
              onValueChange={(value) => {
                setSelectedManufacturer(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('products.manufacturer')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('products.allManufacturers')}</SelectItem>
                {manufacturers.map((man) => (
                  <SelectItem key={man} value={man}>
                    {man}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedAvailability}
              onValueChange={(value) => {
                setSelectedAvailability(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('products.availability')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('products.allAvailability')}</SelectItem>
                {availabilityOptions.map((avail) => (
                  <SelectItem key={avail} value={avail}>
                    {avail}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={stockFilter}
              onValueChange={(value) => {
                setStockFilter(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('products.stockLevel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('products.allStock')}</SelectItem>
                <SelectItem value="in-stock">{t('products.inStock')}</SelectItem>
                <SelectItem value="low-stock">{t('products.lowStock')}</SelectItem>
                <SelectItem value="out-of-stock">{t('products.outOfStock')}</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                {t('products.clearFilters')}
              </Button>
            )}
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">{t('products.activeFilters')}</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  {t('products.search')}: {searchQuery}
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedCategory !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('products.category')}: {categoriesData.find(c => c.id === selectedCategory)?.name || selectedCategory}
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedManufacturer !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {t('products.manufacturer')}: {selectedManufacturer}
                  <button
                    onClick={() => setSelectedManufacturer('all')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedAvailability !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {selectedAvailability}
                  <button
                    onClick={() => setSelectedAvailability('all')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {stockFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Stock: {stockFilter.replace('-', ' ')}
                  <button
                    onClick={() => setStockFilter('all')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <GlassCard key={i} className="overflow-hidden">
              <Skeleton className="aspect-square w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
              </div>
            </GlassCard>
          ))}
        </div>
      ) : paginatedProducts && paginatedProducts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedProducts.map((product) => (
              <ProductGridCard
                key={product.id}
                product={product}
                onQuickView={handleQuickView}
                onEdit={isAdmin ? handleEdit : undefined}
                onDelete={isAdmin ? handleDelete : undefined}
                isAdmin={isAdmin}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <GlassCard>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {t('products.showing')} {(currentPage - 1) * ITEMS_PER_PAGE + 1} {t('products.to')}{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, totalCount || 0)} {t('products.of')}{' '}
                  {totalCount || 0} {t('products.products')}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('products.previous')}</span>
                  </Button>
                  <div className="hidden items-center gap-1 sm:flex">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <span className="hidden sm:inline">{t('products.next')}</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          )}
        </>
      ) : (
        <GlassCard>
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 text-muted-foreground flex items-center justify-center">
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {hasActiveFilters ? t('products.noProductsMatch') : t('products.noProductsFound')}
            </h3>
            <p className="text-muted-foreground mb-6">
              {hasActiveFilters
                ? t('products.tryAdjusting')
                : t('products.noProductsAvailable')}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                {t('products.clearAllFilters')}
              </Button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Quick View Modal */}
      <ProductQuickViewModal
        product={selectedProduct}
        open={isQuickViewOpen}
        onClose={() => {
          setIsQuickViewOpen(false)
          setSelectedProduct(null)
        }}
      />
    </div>
  )
}
