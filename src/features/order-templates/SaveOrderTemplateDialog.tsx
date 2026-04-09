import { useEffect, useMemo, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { normalizeOrderSourceLines } from '@/lib/orderSourceCart'
import { useOrderTemplates } from './useOrderTemplates'

interface OrderTemplateSource {
  id: number
  order_number: number
  items: unknown
}

interface SaveOrderTemplateDialogProps {
  order: OrderTemplateSource | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SaveOrderTemplateDialog({
  order,
  open,
  onOpenChange,
}: SaveOrderTemplateDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { createTemplateAsync, isCreating } = useOrderTemplates()
  const [name, setName] = useState('')

  const normalizedItems = useMemo(
    () => normalizeOrderSourceLines(order?.items ?? []),
    [order?.items],
  )

  useEffect(() => {
    if (open && order) {
      setName(t('templates.defaultName', { orderNumber: order.order_number }))
    }
  }, [open, order, t])

  const handleSubmit = async () => {
    if (!order) {
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast({
        title: t('settings.error'),
        description: t('templates.nameRequired'),
        variant: 'destructive',
      })
      return
    }

    if (normalizedItems.length === 0) {
      toast({
        title: t('settings.error'),
        description: t('templates.noTemplateItems'),
        variant: 'destructive',
      })
      return
    }

    try {
      await createTemplateAsync({
        name: trimmedName,
        sourceQuoteId: order.id,
        items: normalizedItems.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
          product_name: item.product_name,
        })),
      })

      toast({
        title: t('general.success'),
        description: t('templates.savedSuccess', { name: trimmedName }),
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: t('settings.error'),
        description: error instanceof Error ? error.message : t('templates.saveFailed'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('templates.saveAsTemplate')}</DialogTitle>
          <DialogDescription>
            {order
              ? t('templates.saveDialogDescription', { orderNumber: order.order_number })
              : t('templates.saveDialogDescriptionGeneric')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">{t('general.name')}</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('templates.namePlaceholder')}
              disabled={isCreating}
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            {t('templates.itemCountSummary', { count: normalizedItems.length })}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            {t('general.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isCreating}>
            {isCreating ? t('templates.saving') : t('templates.saveAsTemplate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
