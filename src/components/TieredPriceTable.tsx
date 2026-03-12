import { useTranslation } from 'react-i18next'
import { Product, UserRole } from '@/types'
import { getTieredPricing } from '@/lib/pricing'
import { formatCurrency } from '@/lib/utils'
import { GlassCard } from './GlassCard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TieredPriceTableProps {
  product: Product
  userRole?: UserRole
}

export function TieredPriceTable({ product, userRole }: TieredPriceTableProps) {
  const { t } = useTranslation()
  const tiers = getTieredPricing(product, userRole)

  return (
    <GlassCard className="p-4">
      <h3 className="text-lg font-semibold mb-3">{t('products.tieredPricing.title')}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('general.quantity')}</TableHead>
            <TableHead>{t('products.tieredPricing.pricePerUnit')}</TableHead>
            <TableHead>{t('products.tieredPricing.discount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tiers.map((tier, index) => (
            <TableRow key={index}>
              <TableCell>
                {tier.min_quantity}
                {tier.max_quantity ? ` - ${tier.max_quantity}` : '+'}
              </TableCell>
              <TableCell className="font-semibold">
                {formatCurrency(tier.price)}
              </TableCell>
              <TableCell>
                {tier.discount_percentage ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    {t('products.tieredPricing.percentOff', { percent: tier.discount_percentage })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </GlassCard>
  )
}
