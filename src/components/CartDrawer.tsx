import { useCartStore } from '@/stores/cartStore'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Minus, Plus, Trash2, ShoppingCart, FileText, Percent } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { useCommissionRate } from '@/hooks/useCommissionRate'

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequestQuote: () => void
}

export function CartDrawer({ open, onOpenChange, onRequestQuote }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, getTotal, getItemCount } = useCartStore()
  const { hasDiscount, commissionRate } = useCommissionRate()

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    const item = items.find((i) => i.product.id === productId)
    if (!item) return

    if (newQuantity <= 0) {
      removeItem(productId)
      return
    }

    // Get max quantity from stock
    const maxQuantity = item.product.quantity ?? 0
    const finalQuantity = Math.min(newQuantity, maxQuantity)

    updateQuantity(productId, finalQuantity, 'buyer')
  }

  const total = getTotal()
  const itemCount = getItemCount()
  
  // Check if item has a commission discount applied
  const hasItemDiscount = (item: typeof items[0]) => {
    const product = item.product
    return hasDiscount && 
           product.adjusted_price !== undefined && 
           product.adjusted_price < product.weboffer_price
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Shopping Cart
            {itemCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Review your items and submit your order
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
                <p className="text-sm text-muted-foreground">
                  Add products from the catalog to get started
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto space-y-4 mt-6">
              {items.map((item) => {
                const product = item.product
                const maxQuantity = product.quantity ?? 0
                const image = product.main_image || product.images?.[0]

                return (
                  <div
                    key={product.id}
                    className="flex gap-4 p-4 rounded-lg border border-border bg-card"
                  >
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      {image ? (
                        <img
                          src={image}
                          alt={product.name || 'Product'}
                          className="w-20 h-20 rounded object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded bg-muted flex items-center justify-center">
                          <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm line-clamp-2 mb-1">
                        {product.name || 'Unnamed Product'}
                      </h4>
                      <p className="text-xs text-muted-foreground font-mono mb-2">
                        SKU: {product.sku}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-sm font-bold text-primary">
                          {formatPrice(item.price)} each
                        </div>
                        {hasItemDiscount(item) && (
                          <Badge 
                            variant="secondary" 
                            className="gap-0.5 px-1.5 py-0 text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                          >
                            <Percent className="w-2.5 h-2.5" />
                            {Math.round(commissionRate * 100)}%
                          </Badge>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(product.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-12 text-center font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(product.id, item.quantity + 1)}
                          disabled={item.quantity >= maxQuantity}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 ml-auto text-destructive hover:text-destructive"
                          onClick={() => removeItem(product.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {item.quantity >= maxQuantity && maxQuantity > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Max stock: {maxQuantity}
                        </p>
                      )}
                    </div>

                    {/* Line Total */}
                    <div className="flex-shrink-0 text-right">
                      <div className="font-bold text-lg">
                        {formatPrice(item.total)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Cart Footer */}
            <div className="border-t border-border pt-4 space-y-4 mt-4">
              {/* Discount Banner */}
              {hasDiscount && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Percent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">
                    Your {Math.round(commissionRate * 100)}% discount is applied
                  </span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-2xl text-primary">{formatPrice(total)}</span>
              </div>

              {/* Submit Order Button */}
              <Button
                size="lg"
                className="w-full"
                onClick={onRequestQuote}
              >
                <FileText className="w-5 h-5 mr-2" />
                Submit Order
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

