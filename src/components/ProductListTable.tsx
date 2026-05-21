import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, Package } from 'lucide-react'
import { Product } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPrice } from '@/lib/utils'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { useCategoryOptions } from '@/hooks/useCategoryOptions'

interface ProductListTableProps {
  products: Product[]
  selectedProductIds: string[]
  onToggleProduct: (product: Product) => void
  onToggleAllVisible: () => void
}

function getStockVariant(quantity: number | undefined): 'default' | 'secondary' | 'destructive' {
  if (!quantity && quantity !== 0) return 'secondary'
  if (quantity === 0) return 'destructive'
  if (quantity <= 10) return 'secondary'
  return 'default'
}

function getLifecycleBadge(product: Product, t: (key: string) => string) {
  if (product.is_visible === false) {
    return (
      <Badge variant="secondary" className="whitespace-nowrap border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        {t('products.archived')}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="whitespace-nowrap border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
      {t('products.active')}
    </Badge>
  )
}

export function ProductListTable({
  products,
  selectedProductIds,
  onToggleProduct,
  onToggleAllVisible,
}: ProductListTableProps) {
  const { t } = useTranslation()
  const { withBase } = useTenantPath()
  const { options: categoryOptions } = useCategoryOptions()
  const emptyValue = '\u2014'
  const visibleIds = products.map((product) => product.id).filter(Boolean)
  const selectedVisibleCount = visibleIds.filter((id) => selectedProductIds.includes(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <Table className="min-w-[980px]">
        <TableHeader className="bg-muted/35">
          <TableRow>
            <TableHead className="w-12 px-4">
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                onCheckedChange={() => onToggleAllVisible()}
                aria-label={t('products.selectAllVisible')}
              />
            </TableHead>
            <TableHead className="min-w-[320px]">{t('products.productColumn')}</TableHead>
            <TableHead className="w-[130px]">{t('products.lifecycleStatus')}</TableHead>
            <TableHead className="w-[145px]">{t('products.stock')}</TableHead>
            <TableHead className="w-[190px]">{t('products.category')}</TableHead>
            <TableHead className="w-[180px]">{t('products.manufacturer')}</TableHead>
            <TableHead className="w-[130px] text-right">{t('products.price')}</TableHead>
            <TableHead className="w-[135px] text-right">{t('general.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const detailUrl = withBase(`/dashboard/products/${product.sku}`)
            const quantity = product.quantity ?? 0
            const image = product.main_image || product.images?.[0]
            const isSelected = selectedProductIds.includes(product.id)
            const categoryLabel =
              categoryOptions.find((category) => category.id === product.category_id)?.label ||
              product.category ||
              emptyValue
            const manufacturer = product.manufacturer || emptyValue

            return (
              <TableRow
                key={product.id}
                data-state={isSelected ? 'selected' : undefined}
                className="hover:bg-muted/35 data-[state=selected]:bg-primary/5"
              >
                <TableCell className="px-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleProduct(product)}
                    aria-label={t('products.selectProduct', { name: product.name || product.sku })}
                  />
                </TableCell>
                <TableCell>
                  {getLifecycleBadge(product, t)}
                </TableCell>
                <TableCell>
                  <div className="flex min-w-[300px] items-center gap-3">
                    <Link
                      to={detailUrl}
                      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted"
                    >
                      {image ? (
                        <img
                          src={image}
                          alt={product.name || t('products.unnamed')}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Link>
                    <div className="min-w-0">
                      <Link
                        to={detailUrl}
                        className="line-clamp-2 font-medium leading-snug hover:text-primary"
                        title={product.name || t('products.unnamed')}
                      >
                        {product.name || t('products.unnamed')}
                      </Link>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {product.sku || emptyValue}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStockVariant(quantity)} className="whitespace-nowrap font-normal">
                    {quantity === 0 ? t('products.outOfStock') : t('products.inStockCount', { count: quantity })}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[190px] truncate text-sm" title={categoryLabel}>
                  {categoryLabel}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-sm" title={manufacturer}>
                  {manufacturer}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                  {formatPrice(product.adjusted_price ?? product.weboffer_price)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                    <Link to={detailUrl}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('products.viewProduct')}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
