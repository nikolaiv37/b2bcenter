import { useEffect, useState } from 'react'
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
import { Product } from '@/types'
import { useMutationUpdateProductCategory } from '@/hooks/useMutationUpdateProductCategory'
import { useCategoryOptions } from '@/hooks/useCategoryOptions'

interface ChangeProductCategoryDialogProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangeProductCategoryDialog({
  product,
  open,
  onOpenChange,
}: ChangeProductCategoryDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [selectedCategoryId, setSelectedCategoryId] = useState(product.category_id ?? '')
  const updateCategoryMutation = useMutationUpdateProductCategory()
  const { options: categoryOptions, isLoading } = useCategoryOptions(open)

  useEffect(() => {
    if (open) {
      setSelectedCategoryId(product.category_id ?? '')
    }
  }, [open, product.category_id])

  const currentCategoryLabel =
    categoryOptions.find((category) => category.id === product.category_id)?.label ||
    product.category ||
    t('general.notAvailable')
  const hasChanged = Boolean(selectedCategoryId) && selectedCategoryId !== product.category_id

  const handleSave = async () => {
    if (!selectedCategoryId || !hasChanged) return

    try {
      await updateCategoryMutation.mutateAsync({
        productId: product.id,
        sku: product.sku,
        categoryId: selectedCategoryId,
      })
      toast({
        title: t('products.categoryUpdateSuccess'),
      })
      onOpenChange(false)
    } catch {
      toast({
        title: t('products.categoryUpdateError'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('products.changeCategoryTitle')}</DialogTitle>
          <DialogDescription>{product.name || t('products.unnamed')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {t('products.currentCategory')}
            </p>
            <p className="mt-1 text-sm font-medium">{currentCategoryLabel}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-category-select">{t('products.newCategory')}</Label>
            <Select
              value={selectedCategoryId}
              onValueChange={setSelectedCategoryId}
              disabled={isLoading || updateCategoryMutation.isPending}
            >
              <SelectTrigger id="product-category-select">
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
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateCategoryMutation.isPending}
          >
            {t('general.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasChanged || updateCategoryMutation.isPending}
          >
            {updateCategoryMutation.isPending ? t('products.loading') : t('products.saveCategory')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
