import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import { GlassCard } from '@/components/GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useCartStore } from '@/stores/cartStore'
import { useWishlist } from '@/hooks/useWishlist'
import { useQueryProductBySku } from '@/hooks/useQueryProducts'
import { useCommissionRate } from '@/hooks/useCommissionRate'
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
} from 'lucide-react'
import { useState } from 'react'
import { cn, formatPrice as formatPriceUtil } from '@/lib/utils'
import { AddToOrderModal } from './AddToOrderModal'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { HtmlContent } from '@/components/HtmlContent'

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
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [addToOrderOpen, setAddToOrderOpen] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)

  // Fetch product by SKU using the new hook that applies commission pricing
  const { data: product, isLoading, error } = useQueryProductBySku(sku || '')

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

  // Use adjusted_price if available, otherwise fall back to weboffer_price
  const displayPrice = product.adjusted_price ?? product.weboffer_price
  const hasCommissionDiscount = hasDiscount && product.adjusted_price !== undefined && product.adjusted_price < product.weboffer_price

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
          <div className="space-y-6">
            {/* Product Name */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-4xl font-bold flex-1">{product.name}</h1>
                {product.sku && (
                  <TooltipProvider>
                    <Tooltip content={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}>
                      <button
                        onClick={handleWishlistToggle}
                        className={cn(
                          'p-3 rounded-full transition-all duration-200 flex-shrink-0',
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
                            'w-6 h-6 transition-all duration-200',
                            inWishlist && 'fill-current'
                          )}
                        />
                      </button>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-mono">SKU: {product.sku}</p>
            </div>

            {/* Price */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-5xl font-bold text-primary">
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
              {/* Show base wholesale price as strikethrough when commission discount applies */}
              {hasCommissionDiscount && (
                <div className="text-xl text-muted-foreground line-through">
                  {formatPrice(product.weboffer_price)}
                </div>
              )}
              {/* Show retail price strikethrough only if no commission discount and retail > wholesale */}
              {!hasCommissionDiscount && product.retail_price && product.retail_price > (product.weboffer_price || 0) && (
                <div className="text-xl text-muted-foreground line-through">
                  {formatPrice(product.retail_price)}
                </div>
              )}
            </div>

            {/* Stock Badge */}
            <div>
              {isOutOfStock ? (
                <Badge variant="destructive" className="text-base px-4 py-2">
                  {t('products.outOfStock')}
                </Badge>
              ) : isLowStock ? (
                <Badge variant="secondary" className="text-base px-4 py-2 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50">
                  {t('products.onlyLeft', { count: quantity })}
                </Badge>
              ) : (
                <Badge variant="default" className="text-base px-4 py-2 bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50">
                  {t('products.inStock')}
                </Badge>
              )}
            </div>

            {/* Short Description */}
            {product.description && (
              <div className="line-clamp-[8] overflow-hidden">
                <HtmlContent html={product.description} className="leading-relaxed" />
              </div>
            )}

            {/* Category & Manufacturer Chips */}
            <div className="flex flex-wrap gap-2">
              {product.category && (
                <Badge variant="outline" className="text-sm px-3 py-1.5">
                  {product.category}
                </Badge>
              )}
              {product.manufacturer && (
                <Badge variant="outline" className="text-sm px-3 py-1.5">
                  {product.manufacturer}
                </Badge>
              )}
              {product.availability && (
                <Badge variant="outline" className="text-sm px-3 py-1.5">
                  {product.availability}
                </Badge>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 border-t">
              <Button
                size="lg"
                className="w-full text-lg py-6"
                onClick={() => setAddToOrderOpen(true)}
                disabled={isOutOfStock}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {t('products.addToOrder')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleQuickAdd}
                disabled={isOutOfStock}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('products.quickAdd1Pc')}
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Section - Full Description & Specs */}
        <div className="grid lg:grid-cols-2 gap-8 mt-12">
          {/* Full Description */}
          {product.description && (
            <GlassCard>
              <h2 className="text-2xl font-bold mb-4">{t('products.description')}</h2>
              <HtmlContent html={product.description} />
            </GlassCard>
          )}

          {/* Specs Table */}
          {(product.model || product.weight || product.transportational_weight || product.date_expected || product.specs) && (
            <GlassCard>
              <h2 className="text-2xl font-bold mb-4">{t('products.specifications')}</h2>
              <div className="space-y-3">
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

        {/* Related Products Placeholder */}
        <GlassCard>
          <h2 className="text-2xl font-bold mb-4">{t('products.relatedProducts')}</h2>
          <p className="text-muted-foreground">{t('products.relatedProductsComingSoon')}</p>
        </GlassCard>
      </div>

      {/* Add to Order Modal */}
      <AddToOrderModal
        product={product}
        open={addToOrderOpen}
        onClose={() => setAddToOrderOpen(false)}
      />
    </>
  )
}
