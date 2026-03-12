import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { GlassCard } from '@/components/GlassCard'
import { ProductGridCard } from '@/components/ProductGridCard'
import { ProductQuickViewModal } from '@/components/ProductQuickViewModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useWishlist } from '@/hooks/useWishlist'
import { useCartStore } from '@/stores/cartStore'
import { Product } from '@/types'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTenant, useTenantPath } from '@/lib/tenant/TenantProvider'

export function WishlistPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const tenantId = tenant?.id
  const { withBase } = useTenantPath()
  const { toast } = useToast()
  const { wishlistItems, removeFromWishlist, count: wishlistCount } = useWishlist()
  const { addItem } = useCartStore()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false)

  // Get all SKUs from wishlist
  const wishlistSkus = wishlistItems.map((item) => item.product_sku)

  // Fetch products by SKUs
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['tenant', tenantId, 'wishlist-products', wishlistSkus.join(',')],
    queryFn: async () => {
      if (!tenantId || wishlistSkus.length === 0) return []

      // Fetch products by SKU - use in() filter
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('sku', wishlistSkus)
        .eq('tenant_id', tenantId)

      if (error) throw error
      return (data || []) as Product[]
    },
    enabled: !!tenantId && wishlistSkus.length > 0,
  })

  // Remove item from wishlist
  const handleRemove = (sku: string) => {
    removeFromWishlist(sku)
    toast({
      title: t('wishlist.removedFromWishlist'),
      description: t('wishlist.itemRemoved'),
    })
  }

  // Add all items to order
  const handleAddAllToOrder = () => {
    if (products.length === 0) {
      toast({
        title: t('wishlist.noItems'),
        description: t('wishlist.wishlistEmpty'),
        variant: 'destructive',
      })
      return
    }

    let addedCount = 0
    let failedCount = 0

    products.forEach((product) => {
      const result = addItem(product, 1, 'buyer')
      if (result.success) {
        addedCount++
      } else {
        failedCount++
      }
    })

    if (addedCount > 0) {
      toast({
        title: t('wishlist.addedToCart'),
        description: t('wishlist.itemsAdded', { count: addedCount, s: addedCount > 1 ? 's' : '' }) + (failedCount > 0 ? ` (${failedCount} ${t('general.failed')})` : ''),
      })
      // Navigate to cart or orders
      navigate(withBase('/dashboard/orders'))
    } else {
      toast({
        title: t('wishlist.failedToAdd'),
        description: t('wishlist.couldNotAdd'),
        variant: 'destructive',
      })
    }
  }

  const handleQuickView = (product: Product) => {
    setSelectedProduct(product)
    setIsQuickViewOpen(true)
  }

  // Empty state
  if (!isLoading && wishlistCount === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('wishlist.title')}</h1>
          <p className="text-muted-foreground">{t('wishlist.subtitle')}</p>
        </div>

        <GlassCard>
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 text-muted-foreground flex items-center justify-center">
              <Heart className="w-full h-full" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('wishlist.noItemsSaved')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('wishlist.noItemsDescription')}
            </p>
            <Button onClick={() => navigate(withBase('/dashboard/products'))}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('wishlist.browseProducts')}
            </Button>
          </div>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{t('wishlist.title')}</h1>
          {wishlistCount > 0 && (
            <Badge variant="destructive" className="text-base px-3 py-1">
              {wishlistCount}
            </Badge>
          )}
        </div>
        {products.length > 0 && (
          <Button size="lg" onClick={handleAddAllToOrder} className="bg-blue-600 hover:bg-blue-700">
            <ShoppingCart className="w-5 h-5 mr-2" />
            {t('wishlist.addAllToOrder')}
          </Button>
        )}
      </div>

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
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="relative group">
              <ProductGridCard
                product={product}
                onQuickView={handleQuickView}
              />
              {/* Remove button overlay */}
              <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-9 w-9 rounded-full shadow-lg"
                  onClick={() => handleRemove(product.sku)}
                  title={t('wishlist.removeFromWishlist')}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <GlassCard>
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 text-muted-foreground flex items-center justify-center">
              <Heart className="w-full h-full" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('wishlist.noItemsFound')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('wishlist.itemsRemovedFromCatalog')}
            </p>
            <Button onClick={() => navigate(withBase('/dashboard/products'))}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('wishlist.browseProducts')}
            </Button>
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
