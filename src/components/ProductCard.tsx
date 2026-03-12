import { Product, UserRole } from '@/types'
import { GlassCard } from './GlassCard'
import { MOQBadge } from './MOQBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, Eye } from 'lucide-react'

interface ProductCardProps {
  product: Product
  userRole?: UserRole
  onViewDetails: (product: Product) => void
  onAddToCart: (product: Product) => void
}

export function ProductCard({
  product,
  userRole,
  onViewDetails,
  onAddToCart,
}: ProductCardProps) {
  const price = (userRole === 'company')
    ? (product.wholesale_price ?? product.retail_price ?? 0)
    : (product.retail_price ?? 0)
  const stock = product.stock ?? product.quantity ?? 0
  const isLowStock = stock < 10

  return (
    <GlassCard hover className="overflow-hidden group">
      {/* Image */}
      <div className="relative h-48 bg-gray-200 dark:bg-gray-800 overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
        
        {/* Badges overlay */}
        <div className="absolute top-2 right-2 flex flex-col gap-2">
          <MOQBadge moq={product.moq ?? 1} />
          {isLowStock && (
            <Badge variant="destructive" className="backdrop-blur-md">
              Low Stock
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Category & SKU */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium">{product.category}</span>
          <span>SKU: {product.sku}</span>
        </div>

        {/* Name */}
        <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem]">
          {product.name}
        </h3>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Price & Stock */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(price)}
            </div>
            {userRole === 'company' && 
             product.retail_price && 
             product.wholesale_price && 
             product.retail_price > product.wholesale_price && (
              <div className="text-xs text-muted-foreground line-through">
                {formatCurrency(product.retail_price)}
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className={isLowStock ? 'text-destructive font-semibold' : ''}>
              {stock} in stock
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewDetails(product)}
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onAddToCart(product)}
            disabled={stock === 0}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Add to Cart
          </Button>
        </div>
      </div>
    </GlassCard>
  )
}

