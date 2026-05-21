import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useCartStore } from '@/stores/cartStore'
import { useWishlist } from '@/hooks/useWishlist'
import { useQueryProductBySku } from '@/hooks/useQueryProducts'
import { useCommissionRate } from '@/hooks/useCommissionRate'
import { useAppContext } from '@/lib/app/AppContext'
import {
  Package,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ShoppingCart,
  Plus,
  Home,
  ChevronRight as ChevronRightIcon,
  Heart,
  Percent,
  Tags,
  Archive,
  RotateCcw,
} from 'lucide-react'
import { useState } from 'react'
import { cn, formatPrice as formatPriceUtil } from '@/lib/utils'
import { AddToOrderModal } from './AddToOrderModal'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { HtmlContent } from '@/components/HtmlContent'
import { ChangeProductCategoryDialog } from '@/components/ChangeProductCategoryDialog'
import { useCategoryOptions } from '@/hooks/useCategoryOptions'
import { useMutationUpdateProductVisibility } from '@/hooks/useMutationProductVisibility'

/**
 * Product Detail Page
 * 
 * IMPORTANT: This page uses SKU (not id) as the identifier.
 * 
 * Why SKU instead of ID?
 * - SKUs are permanent business identifiers that don't change
 * - Even if products are deleted and re-uploaded via CSV 1000 times,
 *   the SKU remains the same, so URLs stay valid
 * - IDs are database-generated and change on re-import
 * - SKUs are human-readable and shareable
 * 
 * Example URL: /dashboard/products/GP100-0091
 * This will work forever, even after database migrations or CSV re-imports.
 */
export function ProductDetailPage() {
  const { t } = useTranslation()
  const { sku } = useParams<{ sku: string }>()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  const { toast } = useToast()
  const { addItem } = useCartStore()
  const { isInWishlist, toggleWishlist } = useWishlist()
  const { hasDiscount, commissionRate } = useCommissionRate()
  const { currentAccount } = useAppContext()
  const isAdmin = currentAccount.isAdmin
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [addToOrderOpen, setAddToOrderOpen] = useState(false)
  const [changeCategoryOpen, setChangeCategoryOpen] = useState(false)
  const [visibilityAction, setVisibilityAction] = useState<'archive' | 'restore' | null>(null)
  const [isPulsing, setIsPulsing] = useState(false)
  const productVisibilityMutation = useMutationUpdateProductVisibility()

  // Fetch product by SKU using the new hook that applies commission pricing
  const { data: product, isLoading, error } = useQueryProductBySku(sku || '')
  const { options: categoryOptions } = useCategoryOptions(!!product)

  // Handle 404 - product not found
  if (!isLoading && (!product || error)) {
    return (
      <>
        <Helmet>
          <title>{t('products.productNotFound')} | Dev Company Wholesale</title>
        </Helmet>
        <div className="min-h-[60vh] flex items-center justify-center">
          <GlassCard className="max-w-md w-full p-8 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold mb-2">{t('products.productNotFound')}</h1>
            <p className="text-muted-foreground mb-6">
              {t('products.productNotFoundDescription', { sku: sku || '' })}
            </p>
            <Button onClick={() => navigate(withBase('/dashboard/products'))} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('general.backToCatalog')}
            </Button>
          </GlassCard>
        </div>
      </>
    )
  }

  // Loading state
  if (isLoading || !product) {
    return (
      <>
        <Helmet>
          <title>Loading... | Dev Company Wholesale</title>
        </Helmet>
        <div className="space-y-6">
          {/* Breadcrumbs skeleton */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Skeleton className="h-4 w-20" />
            <ChevronRightIcon className="w-4 h-4" />
            <Skeleton className="h-4 w-20" />
            <ChevronRightIcon className="w-4 h-4" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Content skeleton */}
          <div className="grid lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </>
    )
  }

  // Prepare images
  const images = product.images && product.images.length > 0
    ? product.images
    : product.main_image
    ? [product.main_image]
    : []

  const quantity = product.quantity ?? 0
  const isOutOfStock = quantity === 0
  const isLowStock = quantity > 0 && quantity < 20
  const isArchived = product.is_visible === false

  // Use adjusted_price if available, otherwise fall back to weboffer_price
  const displayPrice = product.adjusted_price ?? product.weboffer_price
  const hasCommissionDiscount = hasDiscount && product.adjusted_price !== undefined && product.adjusted_price < product.weboffer_price
  const productCategoryLabel =
    categoryOptions.find((category) => category.id === product.category_id)?.label ||
    product.category

  // Format price helper
  const formatPrice = (price: number | null | undefined): string => {
    if (!price && price !== 0) return 'N/A'
    return formatPriceUtil(price)
  }

  // Handle quick add (adds 1 piece to cart)
  const handleQuickAdd = () => {
    const result = addItem(product, 1, 'buyer')
    if (result.success) {
      toast({
        title: 'Added to cart',
        description: `1 × ${product.name} added to cart`,
      })
    } else {
      toast({
        title: 'Cannot add to cart',
        description: result.message || 'Unable to add product to cart',
        variant: 'destructive',
      })
    }
  }

  // Handle wishlist toggle
  const handleWishlistToggle = () => {
    if (product.sku) {
      const wasInWishlist = isInWishlist(product.sku)
      toggleWishlist(product.sku)
      if (!wasInWishlist) {
        setIsPulsing(true)
        setTimeout(() => setIsPulsing(false), 600)
        toast({
          title: 'Added to wishlist',
          description: `${product.name} has been added to your wishlist`,
        })
      } else {
        toast({
          title: 'Removed from wishlist',
          description: `${product.name} has been removed from your wishlist`,
        })
      }
    }
  }

  const handleVisibilityUpdate = async () => {
    if (!visibilityAction) return

    const restoring = visibilityAction === 'restore'

    try {
      await productVisibilityMutation.mutateAsync({
        productId: product.id,
        sku: product.sku,
        isVisible: restoring,
      })
      toast({
        title: restoring ? t('products.productRestored') : t('products.productArchived'),
      })
      setVisibilityAction(null)
    } catch {
      toast({
        title: restoring ? t('products.restoreProductError') : t('products.archiveProductError'),
        variant: 'destructive',
      })
    }
  }

  const inWishlist = product?.sku ? isInWishlist(product.sku) : false

  return (
    <>
      <Helmet>
        <title>{product.name} - {product.sku} | Dev Company Wholesale</title>
        <meta name="description" content={(product.description || `${product.name} - ${product.sku}`).replace(/<[^>]*>/g, '').slice(0, 160)} />
      </Helmet>

      <div className="space-y-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to={withBase('/dashboard')} className="hover:text-foreground transition-colors flex items-center gap-1">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRightIcon className="w-4 h-4" />
          <Link to={withBase('/dashboard/products')} className="hover:text-foreground transition-colors">
            Products
          </Link>
          <ChevronRightIcon className="w-4 h-4" />
          <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
        </nav>

        {/* Main Content - Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Side - Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <GlassCard className="overflow-hidden p-0">
              {images.length > 0 ? (
                <div className="relative aspect-square bg-gradient-to-br from-muted/50 to-muted group">
                  <img
                    src={images[currentImageIndex]}
                    alt={`${product.name} - Image ${currentImageIndex + 1}`}
                    className="w-full h-full object-cover transition-opacity duration-300"
                    loading="eager"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      if (target.parentElement) {
                        const placeholder = target.parentElement.querySelector('.image-placeholder')
                        if (placeholder) {
                          (placeholder as HTMLElement).style.display = 'flex'
                        }
                      }
                    }}
                  />
                  
                  {/* Placeholder (hidden by default) */}
                  <div className="image-placeholder hidden absolute inset-0 items-center justify-center">
                    <Package className="w-24 h-24 text-muted-foreground" />
                  </div>

                  {/* Navigation arrows for multiple images */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImageIndex((prev) =>
                          prev === 0 ? images.length - 1 : prev - 1
                        )}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex((prev) =>
                          prev === images.length - 1 ? 0 : prev + 1
                        )}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>

                      {/* Image counter */}
                      <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm backdrop-blur-sm">
                        {currentImageIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="aspect-square bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                  <Package className="w-24 h-24 text-muted-foreground" />
                </div>
              )}
            </GlassCard>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={cn(
                      'flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all hover:scale-105',
                      currentImageIndex === index
                        ? 'border-primary ring-2 ring-primary/50 shadow-lg'
                        : 'border-transparent opacity-60 hover:opacity-100 hover:border-border'
                    )}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Side - Product Info */}
          <div className="space-y-5">
            {/* Product Name */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-1">
                <h1 className="text-3xl font-bold flex-1 leading-tight">{product.name}</h1>
                {/* Wishlist — hidden for admins */}
                {!isAdmin && product.sku && (
                  <TooltipProvider>
                    <Tooltip content={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}>
                      <button
                        onClick={handleWishlistToggle}
                        className={cn(
                          'p-2.5 rounded-full transition-all duration-200 flex-shrink-0',
                          'hover:scale-110 active:scale-95',
                          inWishlist
                            ? 'bg-red-500 text-white shadow-lg hover:bg-red-600'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
                          isPulsing && 'animate-pulse'
                        )}
                        aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                      >
                        <Heart
                          className={cn(
                            'w-5 h-5 transition-all duration-200',
                            inWishlist && 'fill-current'
                          )}
                        />
                      </button>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Price */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="text-4xl font-bold text-primary">
                  {formatPrice(displayPrice)}
                </div>
                {hasCommissionDiscount && (
                  <Badge 
                    variant="secondary" 
                    className="gap-1 px-2.5 py-1 text-sm font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  >
                    <Percent className="w-4 h-4" />
                    {Math.round(commissionRate * 100)}% OFF
                  </Badge>
                )}
              </div>
              {hasCommissionDiscount && (
                <div className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.weboffer_price)}
                </div>
              )}
              {!hasCommissionDiscount && product.retail_price && product.retail_price > (product.weboffer_price || 0) && (
                <div className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.retail_price)}
                </div>
              )}
            </div>

            {/* Stock Badge */}
            <div>
              {isOutOfStock ? (
                <Badge variant="destructive" className="text-sm px-3 py-1.5">
                  {t('products.outOfStock')}
                </Badge>
              ) : isLowStock ? (
                <Badge variant="secondary" className="text-sm px-3 py-1.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50">
                  {t('products.onlyLeft', { count: quantity })}
                </Badge>
              ) : (
                <Badge variant="default" className="text-sm px-3 py-1.5 bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50">
                  {t('products.inStock')}
                </Badge>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-border/50" />

            {/* Metadata block — shared for admin and client */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="text-xs font-medium">
                  {isAdmin ? t('products.adminCatalog') : t('products.productInfo')}
                </Badge>
                {isAdmin && (
                  <Badge
                    variant={isArchived ? 'secondary' : 'outline'}
                    className={cn(
                      'text-xs font-normal',
                      isArchived
                        ? 'text-muted-foreground'
                        : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                    )}
                  >
                    {isArchived ? t('products.archived') : t('products.active')}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('products.sku')}</span>
                  <p className="font-mono font-medium">{product.sku}</p>
                </div>
                {product.manufacturer && (
                  <div>
                    <span className="text-muted-foreground">{t('products.manufacturer')}</span>
                    <p className="font-medium truncate">{product.manufacturer}</p>
                  </div>
                )}
                {productCategoryLabel && (
                  <div>
                    <span className="text-muted-foreground">{t('products.category')}</span>
                    <p className="font-medium truncate">{productCategoryLabel}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">{t('products.availability')}</span>
                  <p className="font-medium">
                    {isOutOfStock ? t('products.outOfStock') : t('products.inStock')}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setChangeCategoryOpen(true)}
                  >
                    <Tags className="mr-2 h-4 w-4" />
                    {t('products.changeCategory')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibilityAction(isArchived ? 'restore' : 'archive')}
                  >
                    {isArchived ? (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    ) : (
                      <Archive className="mr-2 h-4 w-4" />
                    )}
                    {isArchived ? t('products.restoreProduct') : t('products.archiveProduct')}
                  </Button>
                </div>
              )}
            </div>

            {/* Buyer action buttons — hidden for admins */}
            {!isAdmin && !isArchived && (
              <div className="space-y-2 pt-3 border-t">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => setAddToOrderOpen(true)}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {isOutOfStock ? t('products.requestBackorder') : t('products.addToOrder')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleQuickAdd}
                  disabled={isOutOfStock}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('products.quickAdd1Pc')}
                </Button>
              </div>
            )}

            {/* Description Card — GlassCard styling */}
            {product.description && (
              <GlassCard className="p-5">
                <h2 className="text-xl font-bold mb-3">{t('products.description')}</h2>
                <HtmlContent html={product.description} className="text-sm leading-relaxed" />
              </GlassCard>
            )}

            {/* Specs Card — GlassCard styling */}
            {(product.model || product.weight || product.transportational_weight || product.date_expected || product.specs) && (
              <GlassCard className="p-5">
                <h2 className="text-xl font-bold mb-3">{t('products.specifications')}</h2>
                <div className="space-y-2">
                  {product.model && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">{t('products.model')}</span>
                      <span className="font-medium">{product.model}</span>
                    </div>
                  )}
                  {product.weight && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">{t('products.weight')}</span>
                      <span className="font-medium">{product.weight} kg</span>
                    </div>
                  )}
                  {product.transportational_weight && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">{t('products.shippingWeight')}</span>
                      <span className="font-medium">{product.transportational_weight} kg</span>
                    </div>
                  )}
                  {product.date_expected && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">{t('products.expectedDate')}</span>
                      <span className="font-medium">{product.date_expected}</span>
                    </div>
                  )}
                  {product.specs && typeof product.specs === 'object' && (
                    <>
                      {Object.entries(product.specs).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-2 border-b border-border/50">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>

      {/* Add to Order Modal — hidden for admins */}
      {!isAdmin && (
        <AddToOrderModal
          product={product}
          open={addToOrderOpen}
          onClose={() => setAddToOrderOpen(false)}
        />
      )}
      {isAdmin && (
        <ChangeProductCategoryDialog
          product={product}
          open={changeCategoryOpen}
          onOpenChange={setChangeCategoryOpen}
        />
      )}
      {isAdmin && (
        <Dialog open={visibilityAction !== null} onOpenChange={(open) => !open && setVisibilityAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {visibilityAction === 'restore' ? t('products.restoreProduct') : t('products.archiveProduct')}
              </DialogTitle>
              <DialogDescription>
                {visibilityAction === 'restore'
                  ? t('products.restoreProductConfirm')
                  : t('products.archiveProductConfirm')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVisibilityAction(null)}
                disabled={productVisibilityMutation.isPending}
              >
                {t('general.cancel')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleVisibilityUpdate}
                disabled={productVisibilityMutation.isPending}
              >
                {visibilityAction === 'restore' ? t('products.restoreProduct') : t('products.archiveProduct')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
