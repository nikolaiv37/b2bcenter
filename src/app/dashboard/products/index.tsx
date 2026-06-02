import { useState, useMemo, useEffect } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { GlassCard } from '@/components/GlassCard'
import { ProductGridCard } from '@/components/ProductGridCard'
import { ProductListTable } from '@/components/ProductListTable'
import { ProductQuickViewModal } from '@/components/ProductQuickViewModal'
import { BulkProductCategoryMoveBar } from '@/components/BulkProductCategoryMoveBar'
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
import { Grid3X3, List, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { applyPolicyToProducts } from '@/lib/pricing'
import { usePricingContext } from '@/hooks/usePricingContext'
import { fetchManufacturerOptions } from '@/lib/manufacturers'

const ITEMS_PER_PAGE = 24
const INITIAL_LOAD_SIZE = 150 // Load 150 products initially for fast render

// Type for category data used in filters
type CategoryFilterItem = { id: string; name: string; displayName: string }
type ProductLifecycleFilter = 'active' | 'archived' | 'all'

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

export function ProductsPage() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [lifecycleFilter, setLifecycleFilter] = useState<ProductLifecycleFilter>('active')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { profile } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { workspaceId: tenantId } = useAppContext()
  const isAdmin = profile?.role === 'admin'
  const pricingCtx = usePricingContext()

  const applyLifecycleFilter = <T,>(query: T): T => {
    const productQuery = query as T & {
      eq: (column: string, value: boolean) => T
    }

    if (!isAdmin || lifecycleFilter === 'active') {
      return productQuery.eq('is_visible', true)
    }
    if (lifecycleFilter === 'archived') {
      return productQuery.eq('is_visible', false)
    }
    return query
  }

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

    query = applyLifecycleFilter(query)

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
  const {
    data: productsRaw,
    isLoading,
    isError: isProductsError,
    error: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: [
      'tenant',
      tenantId,
      'products',
      'paginated',
      searchQuery,
      selectedCategory,
      selectedManufacturer,
      stockFilter,
      lifecycleFilter,
      currentPage,
      categoriesData,
      profile?.id,
    ],
    queryFn: async () => {
      if (!tenantId) return []
      if (!range) {
        // For pages 2-7, return empty - we'll use cached page 1 data
        return []
      }
      const query = buildBaseQuery().range(range.from, range.to)

      const { data, error } = await query

      if (error) {
        console.error('[ProductsPage] products query failed', error)
        throw error
      }

      // Raw rows — pricing is folded in below via `applyPolicyToProducts`.
      return (data ?? []) as Product[]
    },
    enabled: !!tenantId,
    placeholderData: (previousData) => previousData, // Keep previous data while loading
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  // Apply policy-aware pricing (product → category → default → legacy commission_rate).
  const products = useMemo(
    () => applyPolicyToProducts(productsRaw, pricingCtx),
    [productsRaw, pricingCtx],
  )

  // Get cached data from page 1 query for pages 2-7
  const cachedPage1Raw = queryClient.getQueryData<Product[]>([
    'tenant',
    tenantId,
    'products',
    'paginated',
    searchQuery,
    selectedCategory,
    selectedManufacturer,
    stockFilter,
    lifecycleFilter,
    1,
    categoriesData,
    profile?.id,
  ])
  const cachedPage1Data = useMemo(
    () => (cachedPage1Raw ? applyPolicyToProducts(cachedPage1Raw, pricingCtx) : undefined),
    [cachedPage1Raw, pricingCtx],
  )

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
      stockFilter,
      lifecycleFilter,
      categoriesData,
    ],
    queryFn: async () => {
      if (!tenantId) return 0
      let countQuery = supabase.from('products').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)

      countQuery = applyLifecycleFilter(countQuery)

      if (searchQuery) {
        countQuery = countQuery.or(
          `name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`
        )
      }

      if (selectedCategory !== 'all') {
        const categoryIds = getCategoryIdsForFilter(selectedCategory, categoriesData)
        if (categoryIds.length > 0) {
          countQuery = countQuery.in('category_id', categoryIds)
        }
      }

      if (selectedManufacturer !== 'all') {
        countQuery = countQuery.eq('manufacturer', selectedManufacturer)
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
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  // Fetch manufacturer filter options from ALL products.
  // Uses the shared paginated resolver so the list is never truncated by the
  // server-side PostgREST row cap (the previous single-request approach only
  // ever returned the first 1000 arbitrary rows).
  const manufacturerVisibilityScope: boolean | null =
    !isAdmin || lifecycleFilter === 'active'
      ? true
      : lifecycleFilter === 'archived'
        ? false
        : null
  const { data: manufacturers = [] } = useQuery({
    queryKey: ['workspace', 'products', 'manufacturer-options', tenantId, manufacturerVisibilityScope],
    queryFn: () =>
      fetchManufacturerOptions({
        tenantId: tenantId as string,
        isVisible: manufacturerVisibilityScope,
      }),
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60_000,
    enabled: !!tenantId,
  })

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
  }, [searchQuery, selectedCategory, selectedManufacturer, stockFilter])

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

  const toggleProductSelection = (product: Product) => {
    if (!product.id) return
    setSelectedProductIds((current) =>
      current.includes(product.id)
        ? current.filter((id) => id !== product.id)
        : [...current, product.id]
    )
  }

  const toggleAllVisibleProducts = () => {
    const visibleIds = paginatedProducts.map((product) => product.id).filter(Boolean)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedProductIds.includes(id))

    setSelectedProductIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id))
      }

      return Array.from(new Set([...current, ...visibleIds]))
    })
  }

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    if (mode === 'grid') {
      setSelectedProductIds([])
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedManufacturer('all')
    setStockFilter('all')
    setLifecycleFilter('active')
    setCurrentPage(1)
  }

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== 'all' ||
    selectedManufacturer !== 'all' ||
    stockFilter !== 'all' ||
    (isAdmin && lifecycleFilter !== 'active')

  useEffect(() => {
    setSelectedProductIds([])
  }, [searchQuery, selectedCategory, selectedManufacturer, stockFilter, lifecycleFilter, currentPage])

  // Reserve space at the bottom so the fixed bulk action bar never covers
  // the last table rows / pagination while a selection is active.
  const showBulkBar = isAdmin && viewMode === 'list' && selectedProductIds.length > 0

  return (
    <div className={`space-y-6 ${showBulkBar ? 'pb-28' : ''}`}>
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

          {/* Filters + view toggle on one compact row */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3">
              <Select
                value={selectedCategory}
                onValueChange={(value) => {
                  setSelectedCategory(value)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('products.categories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('products.categories')}</SelectItem>
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
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('products.manufacturers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('products.manufacturers')}</SelectItem>
                  {manufacturers.map((man) => (
                    <SelectItem key={man} value={man}>
                      {man}
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
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder={t('products.availability')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('products.availability')}</SelectItem>
                  <SelectItem value="in-stock">{t('products.inStock')}</SelectItem>
                  <SelectItem value="low-stock">{t('products.lowStock')}</SelectItem>
                  <SelectItem value="out-of-stock">{t('products.outOfStock')}</SelectItem>
                </SelectContent>
              </Select>

              {isAdmin && (
                <Select
                  value={lifecycleFilter}
                  onValueChange={(value) => {
                    setLifecycleFilter(value as ProductLifecycleFilter)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder={t('products.lifecycleStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('products.activeProducts')}</SelectItem>
                    <SelectItem value="archived">{t('products.archivedProducts')}</SelectItem>
                    <SelectItem value="all">{t('products.allLifecycleProducts')}</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="w-full sm:w-auto"
                >
                  <X className="w-4 h-4 mr-2" />
                  {t('products.clearFilters')}
                </Button>
              )}
            </div>

            {isAdmin && (
              <div className="inline-flex shrink-0 self-start rounded-md border bg-background p-1 lg:self-auto">
                <Button
                  type="button"
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewModeChange('grid')}
                  aria-pressed={viewMode === 'grid'}
                  title={t('products.gridViewTitle')}
                >
                  <Grid3X3 className="mr-2 h-4 w-4" />
                  {t('products.gridView')}
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewModeChange('list')}
                  aria-pressed={viewMode === 'list'}
                  title={t('products.listViewTitle')}
                >
                  <List className="mr-2 h-4 w-4" />
                  {t('products.listView')}
                </Button>
              </div>
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
              {isAdmin && lifecycleFilter !== 'active' && (
                <Badge variant="secondary" className="gap-1">
                  {t('products.lifecycleStatus')}: {
                    lifecycleFilter === 'archived'
                      ? t('products.archivedProducts')
                      : t('products.allLifecycleProducts')
                  }
                  <button
                    onClick={() => setLifecycleFilter('active')}
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

      {isAdmin && viewMode === 'list' && (
        <BulkProductCategoryMoveBar
          selectedProductIds={selectedProductIds}
          selectedProducts={paginatedProducts.filter((product) => selectedProductIds.includes(product.id))}
          onClearSelection={() => setSelectedProductIds([])}
          selectedCountLabel={t('products.selectedProductsCount', { count: selectedProductIds.length })}
        />
      )}

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
      ) : isProductsError ? (
        <GlassCard>
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <X className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('products.loadErrorTitle')}</h3>
            <p className="text-muted-foreground mb-2">{t('products.loadErrorDescription')}</p>
            {productsError instanceof Error && (
              <p className="text-xs text-muted-foreground mb-6 font-mono break-all">
                {productsError.message}
              </p>
            )}
            <Button variant="outline" onClick={() => refetchProducts()}>
              {t('products.retry')}
            </Button>
          </div>
        </GlassCard>
      ) : paginatedProducts && paginatedProducts.length > 0 ? (
        <>
          {isAdmin && viewMode === 'list' ? (
            <ProductListTable
              products={paginatedProducts}
              selectedProductIds={selectedProductIds}
              onToggleProduct={toggleProductSelection}
              onToggleAllVisible={toggleAllVisibleProducts}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedProducts.map((product) => (
                <ProductGridCard
                  key={product.id}
                  product={product}
                  onQuickView={handleQuickView}
                  onEdit={isAdmin ? handleEdit : undefined}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}

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
