import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { CartItem } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const quoteFormSchema = z.object({
  customerName: z.string().min(2, 'errors.nameMinLength'),
  customerEmail: z.string().email('errors.invalidEmail'),
  notes: z.string().optional(),
})

type QuoteFormData = z.infer<typeof quoteFormSchema>

interface QuoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  total: number
  onSubmit: (data: QuoteFormData) => Promise<void>
}

export function QuoteModal({
  open,
  onOpenChange,
  items,
  total,
  onSubmit,
}: QuoteModalProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
  })

  const handleFormSubmit = async (data: QuoteFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      toast({
        title: t('quotes.requested'),
        description: t('quotes.requestedDescription'),
      })
      reset()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: t('general.error'),
        description: t('quotes.submitFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass">
        <DialogHeader>
          <DialogTitle>{t('quotes.requestTitle')}</DialogTitle>
          <DialogDescription>
            {t('quotes.requestDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="space-y-4 py-4">
            {/* Quote Summary */}
            <div className="glass-card p-4 space-y-2">
              <h4 className="font-semibold">{t('quotes.summary')}</h4>
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {item.product.name} x {item.quantity}
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>{t('general.total')}</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-2">
              <Label htmlFor="customerName">{t('quotes.fullName')} *</Label>
              <Input
                id="customerName"
                {...register('customerName')}
                placeholder={t('quotes.fullNamePlaceholder')}
              />
              {errors.customerName && (
                <p className="text-sm text-destructive">
                  {errors.customerName.message
                    ? t(errors.customerName.message)
                    : ''}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerEmail">{t('auth.email')} *</Label>
              <Input
                id="customerEmail"
                type="email"
                {...register('customerEmail')}
                placeholder={t('quotes.emailPlaceholder')}
              />
              {errors.customerEmail && (
                <p className="text-sm text-destructive">
                  {errors.customerEmail.message
                    ? t(errors.customerEmail.message)
                    : ''}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('general.notes')}</Label>
              <textarea
                id="notes"
                {...register('notes')}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={t('quotes.notesPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('general.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('quotes.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
