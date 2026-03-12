import { useState } from 'react'
import { Product } from '@/types'
import { useCartStore } from '@/stores/cartStore'
import { useToast } from '@/components/ui/use-toast'
import { useCommissionRate } from '@/hooks/useCommissionRate'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, Plus, Minus, Loader2, Percent } from 'lucide-react'
import { formatPrice as formatPriceUtil } from '@/lib/utils'

interface AddToOrderModalProps {
  product: Product
  open: boolean
  onClose: () => void
}

/**
 * Add to Order Modal
 * 
 * Allows users to:
 * 1. Select quantity
 * 2. Optionally select buyer (for future use)
 * 3. Add to cart (draft order line)
 * 
 * The cart acts as a draft order - items can be reviewed and submitted later.
 */
export function AddToOrderModal({ product, open, onClose }: AddToOrderModalProps) {
  const { t } = useTranslation()
  const { addItem } = useCartStore()
  const { toast } = useToast()
  const { hasDiscount, commissionRate } = useCommissionRate()
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)

  const maxQuantity = product.quantity ?? 0
  const isOutOfStock = maxQuantity === 0
  
  // Use adjusted_price if available, otherwise fall back to weboffer_price
  const unitPrice = product.adjusted_price ?? product.weboffer_price ?? 0
  const basePrice = product.weboffer_price ?? 0
  const hasCommissionDiscount = hasDiscount && product.adjusted_price !== undefined && product.adjusted_price < basePrice
  
  const total = unitPrice * quantity

  // Format price helper
  const formatPrice = (price: number): string => {
    return formatPriceUtil(price)
  }

  // Handle quantity change
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const newQty = prev + delta
      return Math.max(1, Math.min(newQty, maxQuantity))
    })
  }

  // Handle add to cart
  const handleAddToOrder = async () => {
    if (isOutOfStock) {
      toast({
        title: t('products.outOfStockToast'),
        description: t('products.outOfStockDescription'),
        variant: 'destructive',
      })
      return
    }

    if (quantity <= 0 || quantity > maxQuantity) {
      toast({
        title: t('products.invalidQuantity'),
        description: t('products.invalidQuantityDescription', { max: maxQuantity }),
        variant: 'destructive',
      })
      return
    }

    setIsAdding(true)
    
    // Add to cart (this creates a draft order line)
    const result = addItem(product, quantity, 'buyer')
    
    setIsAdding(false)

    if (result.success) {
      toast({
        title: t('products.addedToOrder'),
        description: t('products.addedToOrderDescription', { count: quantity, name: product.name }),
      })
      setQuantity(1) // Reset quantity
      onClose()
    } else {
      toast({
        title: t('products.cannotAddToOrder'),
        description: result.message || t('products.cannotAddToOrderDescription'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {t('products.addToOrder')}
          </DialogTitle>
          <DialogDescription>
            {t('products.selectQuantityAndAdd')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Product Info */}
          <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
            {product.main_image || product.images?.[0] ? (
              <img
                src={product.main_image || product.images?.[0]}
                alt={product.name}
                className="w-20 h-20 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded bg-muted flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold line-clamp-2 mb-1">{product.name}</h4>
              <p className="text-xs text-muted-foreground font-mono mb-1">
                SKU: {product.sku}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-primary">
                  {formatPrice(unitPrice)}
                </p>
                {hasCommissionDiscount && (
                  <Badge 
                    variant="secondary" 
                    className="gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  >
                    <Percent className="w-2.5 h-2.5" />
                    {Math.round(commissionRate * 100)}% OFF
                  </Badge>
                )}
              </div>
              {hasCommissionDiscount && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatPrice(basePrice)}
                </p>
              )}
            </div>
          </div>

          {/* Quantity Selection */}
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1 || isOutOfStock}
                className="h-10 w-10"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={maxQuantity}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1
                  setQuantity(Math.max(1, Math.min(val, maxQuantity)))
                }}
                className="text-center text-lg font-semibold h-10"
                disabled={isOutOfStock}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= maxQuantity || isOutOfStock}
                className="h-10 w-10"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {!isOutOfStock && (
              <p className="text-xs text-muted-foreground mt-2">
                {maxQuantity > 0
                  ? `${maxQuantity} available in stock`
                  : 'Out of stock'}
              </p>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold text-primary">
              {formatPrice(total)}
            </span>
          </div>

          {/* Info Message */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              This will be added to your draft order. You can review and submit it later from your cart.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToOrder}
              disabled={isOutOfStock || isAdding}
              className="flex-1"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('products.adding')}
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t('products.addToOrder')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

