import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useCategoryOptions } from '@/hooks/useCategoryOptions'
import { useMutationBulkUpdateProductCategory } from '@/hooks/useMutationUpdateProductCategory'
import { useMutationBulkUpdateProductVisibility } from '@/hooks/useMutationProductVisibility'
import { Product } from '@/types'
import { Archive, CheckSquare, RotateCcw, Tags, X } from 'lucide-react'

interface BulkProductCategoryMoveBarProps {
  selectedProductIds: string[]
  selectedProducts?: Product[]
  onClearSelection: () => void
  selectedCountLabel?: string
}

export function BulkProductCategoryMoveBar({
  selectedProductIds,
  selectedProducts = [],
  onClearSelection,
  selectedCountLabel,
}: BulkProductCategoryMoveBarProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [visibilityAction, setVisibilityAction] = useState<'archive' | 'restore' | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const { options: categoryOptions, isLoading } = useCategoryOptions(dialogOpen)
  const moveProductsMutation = useMutationBulkUpdateProductCategory()
  const visibilityMutation = useMutationBulkUpdateProductVisibility()
  const selectedCount = selectedProductIds.length
  const countLabel = selectedCountLabel || t('products.bulkSelectedCount', { count: selectedCount })
  const hasActiveSelection = selectedProducts.some((product) => product.is_visible !== false)
  const hasArchivedSelection = selectedProducts.some((product) => product.is_visible === false)

  if (selectedCount === 0) return null

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setSelectedCategoryId('')
    }
  }

  const handleMove = async () => {
    if (!selectedCategoryId || selectedCount === 0) return

    try {
      await moveProductsMutation.mutateAsync({
        productIds: selectedProductIds,
        categoryId: selectedCategoryId,
      })
      toast({
        title: t('products.bulkCategoryMoveSuccess'),
      })
      handleOpenChange(false)
      onClearSelection()
    } catch {
      toast({
        title: t('products.bulkCategoryMoveError'),
        variant: 'destructive',
      })
    }
  }

  const handleVisibilityUpdate = async () => {
    if (!visibilityAction || selectedCount === 0) return

    const restoring = visibilityAction === 'restore'

    try {
      await visibilityMutation.mutateAsync({
        productIds: selectedProductIds,
        isVisible: restoring,
      })
      toast({
        title: restoring ? t('products.productsRestored') : t('products.productsArchived'),
      })
      setVisibilityAction(null)
      onClearSelection()
    } catch {
      toast({
        title: restoring ? t('products.restoreProductsError') : t('products.archiveProductsError'),
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <div className="sticky top-2 z-20 rounded-lg border bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span>{countLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearSelection}
            >
              <X className="mr-2 h-4 w-4" />
              {t('products.clearSelection')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              <Tags className="mr-2 h-4 w-4" />
              {t('products.changeCategory')}
            </Button>
            {hasActiveSelection && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVisibilityAction('archive')}
              >
                <Archive className="mr-2 h-4 w-4" />
                {t('products.archiveSelected')}
              </Button>
            )}
            {hasArchivedSelection && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVisibilityAction('restore')}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('products.restoreSelected')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('products.bulkCategoryMoveTitle')}</DialogTitle>
            <DialogDescription>
              {countLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="bulk-product-category-select">{t('products.newCategory')}</Label>
            <Select
              value={selectedCategoryId}
              onValueChange={setSelectedCategoryId}
              disabled={isLoading || moveProductsMutation.isPending}
            >
              <SelectTrigger id="bulk-product-category-select">
                <SelectValue placeholder={t('products.selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={moveProductsMutation.isPending}
            >
              {t('general.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleMove}
              disabled={!selectedCategoryId || moveProductsMutation.isPending}
            >
              {moveProductsMutation.isPending ? t('products.loading') : t('products.bulkCategoryMoveSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={visibilityAction !== null} onOpenChange={(open) => !open && setVisibilityAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {visibilityAction === 'restore' ? t('products.restoreSelected') : t('products.archiveSelected')}
            </DialogTitle>
            <DialogDescription>
              {visibilityAction === 'restore'
                ? t('products.bulkRestoreConfirm', { count: selectedCount })
                : t('products.bulkArchiveConfirm', { count: selectedCount })}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibilityAction(null)}
              disabled={visibilityMutation.isPending}
            >
              {t('general.cancel')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleVisibilityUpdate}
              disabled={visibilityMutation.isPending}
            >
              {visibilityAction === 'restore' ? t('products.restoreProduct') : t('products.archiveProduct')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
