import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { ShippingMethod, SHIPPING_METHOD_CONFIG } from '@/types'
import { cn } from '@/lib/utils'
import { Warehouse, Truck, Package, Store } from 'lucide-react'

interface ShippingMethodBadgeProps {
  method: ShippingMethod | string | null | undefined
  showIcon?: boolean
  showLabel?: boolean
  showFullLabel?: boolean // Show full label instead of short label
  size?: 'sm' | 'md' | 'lg'
  className?: string
  useGreyStyle?: boolean // Use grey/muted colors instead of colored badges
}

const IconMap = {
  warehouse_pickup: Warehouse,
  transport_company: Truck,
  dropshipping: Package,
  shop_delivery: Store,
}

const ColorClasses: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  amber: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  purple: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  green: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  gray: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30',
}

export function ShippingMethodBadge({
  method,
  showIcon = true,
  showLabel = true,
  showFullLabel = true, // Default to full label for clarity
  size = 'md',
  useGreyStyle = true, // Default to grey style like in order creation
  className,
}: ShippingMethodBadgeProps) {
  const { t } = useTranslation()
  // Default to shop_delivery if method is not provided
  const shippingMethod = (method as ShippingMethod) || 'shop_delivery'
  const config = SHIPPING_METHOD_CONFIG[shippingMethod] || {
    label: 'Unknown',
    shortLabel: 'Unknown',
    icon: '❓',
    color: 'gray',
  }

  const Icon = IconMap[shippingMethod] || Store
  
  // Use grey/muted colors if useGreyStyle is true, otherwise use the method's color
  const colorClass = useGreyStyle 
    ? 'bg-muted/50 text-muted-foreground border-muted-foreground/20' 
    : (ColorClasses[config.color] || ColorClasses.gray)

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  // Get translated labels
  const getTranslatedLabel = (method: ShippingMethod, full: boolean) => {
    switch (method) {
      case 'warehouse_pickup':
        return full ? t('shipping.warehousePickup') : t('shipping.warehousePickupShort')
      case 'transport_company':
        return full ? t('shipping.transportCompany') : t('shipping.transportCompanyShort')
      case 'dropshipping':
        return full ? t('shipping.dropshipping') : t('shipping.dropshippingShort')
      case 'shop_delivery':
        return full ? t('shipping.shopDelivery') : t('shipping.shopDeliveryShort')
      default:
        return t('overview.unknown')
    }
  }

  // Use full label if showFullLabel is true, otherwise use short label
  const displayLabel = getTranslatedLabel(shippingMethod, showFullLabel)

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium inline-flex items-center gap-1.5',
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {showLabel && <span>{displayLabel}</span>}
    </Badge>
  )
}

// Dropdown/Select options for shipping method
export function ShippingMethodSelect({
  value,
  onValueChange,
  disabled = false,
  className,
}: {
  value: ShippingMethod | string
  onValueChange: (value: ShippingMethod) => void
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const methods: ShippingMethod[] = ['shop_delivery', 'warehouse_pickup', 'transport_company', 'dropshipping']

  const getTranslatedLabel = (method: ShippingMethod) => {
    switch (method) {
      case 'warehouse_pickup':
        return t('shipping.warehousePickup')
      case 'transport_company':
        return t('shipping.transportCompany')
      case 'dropshipping':
        return t('shipping.dropshipping')
      case 'shop_delivery':
        return t('shipping.shopDelivery')
      default:
        return t('overview.unknown')
    }
  }

  return (
    <select
      value={value || 'shop_delivery'}
      onChange={(e) => onValueChange(e.target.value as ShippingMethod)}
      disabled={disabled}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
        'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {methods.map((method) => {
        const config = SHIPPING_METHOD_CONFIG[method]
        return (
          <option key={method} value={method}>
            {config.icon} {getTranslatedLabel(method)}
          </option>
        )
      })}
    </select>
  )
}

