import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Product } from '@/types'
import { GlassCard } from './GlassCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCartStore } from '@/stores/cartStore'
import { useToast } from '@/components/ui/use-toast'
import { useWishlist } from '@/hooks/useWishlist'
import { useCommissionRate } from '@/hooks/useCommissionRate'
import { Eye, Package, ShoppingCart, Plus, Minus, Heart, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { useTenantPath } from '@/lib/tenant/TenantProvider'

interface ProductGridCardProps {
  product: Product
  onQuickView: (product: Product) => void
  onEdit?: (product: Product) => void
  onDelete?: (product: Product) => void
  isAdmin?: boolean
}

/**
 * Format price in EUR or BGN
 */
function formatPrice(price: number | null | undefined, fallback: string): string {
  if (!price && price !== 0) return fallback
  // For now use EUR, can be made configurable
  return `€${price.toFixed(2)}`
}

/**
 * Get stock badge variant based on quantity
 */
function getStockVariant(quantity: number | undefined): 'default' | 'secondary' | 'destructive' {
  if (!quantity && quantity !== 0) return 'secondary'
  if (quantity === 0) return 'destructive'
  if (quantity <= 10) return 'secondary'
  return 'default'
}

function normalizeAvailability(value: string | undefined | null): string {
  return value?.trim().toLowerCase() ?? ''
}

function isInformativeAvailability(value: string | undefined | null): boolean {
  const normalized = normalizeAvailability(value)
  if (!normalized) return false

  const hiddenStates = new Set([
    'active',
    'in stock',
    'instock',
    'available',
    'available for order',
    'в наличност',
  ])

  return !hiddenStates.has(normalized)
}

function isUnavailableAvailability(value: string | undefined | null): boolean {
  const normalized = normalizeAvailability(value)
  if (!normalized) return false

  return [
    'out of stock',
    'unavailable',
    'inactive',
    'archived',
    'draft',
    'disabled',
    'sold out',
    'discontinued',
    'изчерпано',
    'неналично',
    'неактивен',
  ].some((state) => normalized.includes(state))
}


export function ProductGridCard({
  product,
  onQuickView,
}: ProductGridCardProps) {
  const { t } = useTranslation()
  const [localQuantity, setLocalQuantity] = useState(1)
  const [isPulsing, setIsPulsing] = useState(false)
  const { addItem } = useCartStore()
  const { toast } = useToast()
  const { isInWishlist, toggleWishlist } = useWishlist()
  const { hasDiscount, commissionRate } = useCommissionRate()
  const { withBase } = useTenantPath()
  
  const quantity = product.quantity ?? 0
  const mainImage = product.main_image || product.images?.[0]
  const hasImages = product.images && product.images.length > 0
  const isOutOfStock = quantity === 0
  const isAvailabilityUnavailable = isUnavailableAvailability(product.availability)
  const isPurchasable = !isOutOfStock && !isAvailabilityUnavailable
  const showAvailabilityText = isInformativeAvailability(product.availability) && !isAvailabilityUnavailable
  const maxQuantity = quantity
  const inWishlist = product.sku ? isInWishlist(product.sku) : false
  
  // Use adjusted_price if available, otherwise fall back to weboffer_price
  const displayPrice = product.adjusted_price ?? product.weboffer_price
  const hasCommissionDiscount = hasDiscount && product.adjusted_price !== undefined && product.adjusted_price < product.weboffer_price

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (product.sku) {
      toggleWishlist(product.sku)
      if (!inWishlist) {
        setIsPulsing(true)
        setTimeout(() => setIsPulsing(false), 600)
      }
    }
  }

  const handleAddToCart = () => {
    const qty = Math.min(Math.max(1, localQuantity), maxQuantity)
    const result = addItem(product, qty, 'buyer')
    
    if (result.success) {
      toast({
        title: t('cart.added'),
        description: t('cart.addedDescription', { count: qty, name: product.name || t('products.unnamed') }),
      })
      setLocalQuantity(1) // Reset to 1
    } else {
      toast({
        title: t('cart.addFailed'),
        description: result.message || t('cart.addFailedDescription'),
        variant: 'destructive',
      })
    }
  }

  const handleQuantityChange = (delta: number) => {
    setLocalQuantity((prev) => {
      const newQty = prev + delta
      return Math.max(1, Math.min(newQty, maxQuantity))
    })
  }

  // Stop event propagation for interactive elements
  const handleStopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // Check if SKU exists for navigation
  const hasSku = product.sku && product.sku.trim() !== ''
  const detailUrl = hasSku ? withBase(`/dashboard/products/${product.sku}`) : '#'

  // Card links to permanent SKU-based detail page – safe forever even after full CSV re-uploads
  const CardContent = (
    <GlassCard className={cn(
      "group overflow-hidden flex flex-col h-full hover:shadow-lg transition-all duration-300 relative",
      hasSku && "cursor-pointer hover:scale-105"
    )}>
      {/* Hover overlay for clickable indication */}
      {hasSku && (
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0 rounded-xl" />
      )}
      {/* Image Container */}
      <div className="relative aspect-square bg-gradient-to-br from-muted/50 to-muted overflow-hidden">
        {mainImage ? (
          <img
            src={mainImage}
            alt={product.name || 'Product image'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              // Fallback to placeholder on error
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              if (target.parentElement) {
                target.parentElement.innerHTML = `
                  <div class="w-full h-full flex items-center justify-center text-muted-foreground">
                    <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                `
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Package className="w-16 h-16" />
          </div>
        )}

        {/* Image count badge */}
        {hasImages && product.images.length > 1 && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="backdrop-blur-md bg-black/20 text-white">
              {t('products.photosCount', { count: product.images.length })}
            </Badge>
          </div>
        )}

        {/* Wishlist heart button */}
        {product.sku && (
          <div className="absolute top-2 right-2 z-10">
            <TooltipProvider>
              <Tooltip content={inWishlist ? t('wishlist.removeFromWishlist') : t('wishlist.addToWishlist')}>
                <button
                  onClick={handleWishlistToggle}
                  className={cn(
                    'p-2 rounded-full backdrop-blur-md transition-all duration-200',
                    'hover:scale-110 active:scale-95',
                    inWishlist
                      ? 'bg-red-500/90 text-white shadow-lg'
                      : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800',
                    isPulsing && 'animate-pulse'
                  )}
                  aria-label={inWishlist ? t('wishlist.removeFromWishlist') : t('wishlist.addToWishlist')}
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
          </div>
        )}

        {/* Stock badge overlay */}
        <div className="absolute top-2 left-2">
          <Badge
            variant={getStockVariant(quantity)}
            className={cn(
              'backdrop-blur-md font-semibold',
              quantity === 0 && 'bg-red-500/80 text-white',
              quantity > 0 && quantity <= 10 && 'bg-yellow-500/80 text-white',
              quantity > 10 && 'bg-green-500/80 text-white'
            )}
          >
            {quantity === 0 ? t('products.outOfStock') : t('products.inStockCount', { count: quantity })}
          </Badge>
        </div>

        {/* Quick view button overlay */}
        <div 
          className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none"
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onQuickView(product)
            }}
            className="backdrop-blur-md pointer-events-auto"
            data-no-navigate
          >
            <Eye className="w-4 h-4 mr-2" />
            {t('products.quickView')}
          </Button>
        </div>

      </div>

      {/* Content */}
      <div className="relative p-4 flex-1 flex flex-col">
        {/* Category Badge */}
        {product.category && (
          <Badge variant="outline" className="w-fit mb-2 text-xs">
            {product.category}
          </Badge>
        )}

        {/* Name - Properly handle UTF-8 */}
        <h3 className="font-bold text-lg mb-2 line-clamp-2 min-h-[3rem] flex-shrink-0">
          {product.name || t('products.unnamed')}
        </h3>

        {/* SKU */}
        <p className="text-xs text-muted-foreground mb-3 font-mono">
          {t('products.sku')}: {product.sku}
        </p>

        {/* Price */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-primary">
              {formatPrice(displayPrice, t('general.notAvailable'))}
            </div>
            {hasCommissionDiscount && (
              <Badge 
                variant="secondary" 
                className="gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
              >
                <Percent className="w-2.5 h-2.5" />
                {t('products.percentOff', { percent: Math.round(commissionRate * 100) })}
              </Badge>
            )}
          </div>
          {/* Show base wholesale price as strikethrough when commission discount applies */}
          {hasCommissionDiscount && (
            <div className="text-sm text-muted-foreground line-through">
              {formatPrice(product.weboffer_price, t('general.notAvailable'))}
            </div>
          )}
          {/* Show retail price strikethrough only if no commission discount and retail > wholesale */}
          {!hasCommissionDiscount && product.retail_price && product.retail_price > (product.weboffer_price || 0) && (
            <div className="text-sm text-muted-foreground line-through">
              {formatPrice(product.retail_price, t('general.notAvailable'))}
            </div>
          )}
        </div>

        {/* Availability */}
        {showAvailabilityText && (
          <p className="text-xs text-muted-foreground mb-3">
            {product.availability}
          </p>
        )}

        {/* Quantity Input & Add to Cart */}
        {isPurchasable ? (
          <div 
            className="mt-auto min-h-[118px] pt-3 border-t border-border/50 space-y-2"
            onClick={handleStopPropagation}
            onMouseDown={handleStopPropagation}
            data-no-navigate
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('general.quantity')}:</span>
              <div className="flex items-center gap-1 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleQuantityChange(-1)
                  }}
                  disabled={localQuantity <= 1}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <Input
                  type="number"
                  min="1"
                  max={maxQuantity}
                  value={localQuantity}
                  onChange={(e) => {
                    e.stopPropagation()
                    const val = parseInt(e.target.value) || 1
                    setLocalQuantity(Math.max(1, Math.min(val, maxQuantity)))
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                  }}
                  className="h-8 w-16 text-center text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleQuantityChange(1)
                  }}
                  disabled={localQuantity >= maxQuantity}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleAddToCart()
              }}
              disabled={!isPurchasable}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('cart.addToCart')}
            </Button>
          </div>
        ) : (
          <div className="mt-auto min-h-[118px] pt-3 border-t border-border/50">
            <div
              className={cn(
                'rounded-2xl border px-3.5 py-3',
                isOutOfStock
                  ? 'border-red-100 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/15'
                  : 'border-amber-100 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/15'
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className={cn(
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                  isOutOfStock
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                )}>
                  <Package className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-none text-foreground">
                    {isOutOfStock
                      ? t('products.outOfStock')
                      : t('products.currentlyUnavailable')}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {isOutOfStock
                      ? t('products.outOfStockDescription')
                      : t('products.currentlyUnavailableDescription')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )

  // If SKU is missing, render card without link (grayed out)
  if (!hasSku) {
    return (
      <div className="opacity-60">
        {CardContent}
      </div>
    )
  }

  // Wrap with Link for navigation - interactive elements will stop propagation
  return (
    <Link
      to={detailUrl}
      className="block h-full"
      onClick={(e) => {
        // Check if click is on an interactive element
        const target = e.target as HTMLElement
        if (
          target.closest('button') ||
          target.closest('input') ||
          target.closest('[data-no-navigate]')
        ) {
          e.preventDefault()
          e.stopPropagation()
        }
        // Otherwise, allow navigation
      }}
    >
      {CardContent}
    </Link>
  )
}
