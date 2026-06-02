import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Save, Truck } from 'lucide-react'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { useMutationUpdateProductShipping } from '@/hooks/useMutationUpdateProductShipping'
import type { Product } from '@/types'

interface FormState {
  weight: string
  parcels: string
  length: string
  width: string
  height: string
  requiresReview: boolean
}

function fromProduct(product: Product): FormState {
  return {
    weight: product.shipping_weight_kg != null ? String(product.shipping_weight_kg) : '',
    parcels: product.shipping_parcels_count != null ? String(product.shipping_parcels_count) : '1',
    length: product.shipping_length_cm != null ? String(product.shipping_length_cm) : '',
    width: product.shipping_width_cm != null ? String(product.shipping_width_cm) : '',
    height: product.shipping_height_cm != null ? String(product.shipping_height_cm) : '',
    requiresReview: Boolean(product.shipping_requires_review),
  }
}

function toNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function ProductShippingEditor({ product }: { product: Product }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const mutation = useMutationUpdateProductShipping()
  const [state, setState] = useState<FormState>(() => fromProduct(product))

  useEffect(() => {
    setState(fromProduct(product))
  }, [product.id, product.sku])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    const parcels = toNumberOrNull(state.parcels)
    try {
      await mutation.mutateAsync({
        sku: product.sku,
        productId: product.id,
        shipping_weight_kg: toNumberOrNull(state.weight),
        shipping_parcels_count: parcels != null ? Math.max(1, Math.round(parcels)) : 1,
        shipping_length_cm: toNumberOrNull(state.length),
        shipping_width_cm: toNumberOrNull(state.width),
        shipping_height_cm: toNumberOrNull(state.height),
        shipping_requires_review: state.requiresReview,
      })
      toast({ title: t('productShipping.toasts.savedTitle') })
    } catch (error) {
      toast({
        title: t('productShipping.toasts.errorTitle'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  return (
    <GlassCard className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="w-5 h-5" />
        <h2 className="text-xl font-bold">{t('productShipping.title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('productShipping.subtitle')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ps-weight">{t('productShipping.fields.weight')}</Label>
          <Input
            id="ps-weight"
            type="number"
            step="0.01"
            min={0}
            value={state.weight}
            onChange={(e) => update('weight', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ps-parcels">{t('productShipping.fields.parcels')}</Label>
          <Input
            id="ps-parcels"
            type="number"
            step={1}
            min={1}
            value={state.parcels}
            onChange={(e) => update('parcels', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ps-length">{t('productShipping.fields.length')}</Label>
          <Input
            id="ps-length"
            type="number"
            step="0.1"
            min={0}
            value={state.length}
            onChange={(e) => update('length', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ps-width">{t('productShipping.fields.width')}</Label>
          <Input
            id="ps-width"
            type="number"
            step="0.1"
            min={0}
            value={state.width}
            onChange={(e) => update('width', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ps-height">{t('productShipping.fields.height')}</Label>
          <Input
            id="ps-height"
            type="number"
            step="0.1"
            min={0}
            value={state.height}
            onChange={(e) => update('height', e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2 pt-2">
          <Checkbox
            id="ps-requires-review"
            checked={state.requiresReview}
            onCheckedChange={(checked) => update('requiresReview', Boolean(checked))}
          />
          <Label htmlFor="ps-requires-review" className="text-sm font-normal cursor-pointer">
            {t('productShipping.fields.requiresReview')}
          </Label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t('productShipping.actions.save')}
        </Button>
      </div>
    </GlassCard>
  )
}
