import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { useOrderSourceCartLoader } from '@/lib/orderSourceCart'
import { useOrderTemplates, OrderTemplate } from '@/features/order-templates/useOrderTemplates'
import { FileText, ShoppingCart, Trash2 } from 'lucide-react'

function formatTemplateDate(dateString: string, locale: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function OrderTemplatesPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const { templates, isLoading, deleteTemplateAsync } = useOrderTemplates()
  const { replaceCartWithSource } = useOrderSourceCartLoader()
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)

  if (isAdmin) {
    return <Navigate to={withBase('/dashboard/orders')} replace />
  }

  const handleLoadTemplate = async (template: OrderTemplate) => {
    setActiveTemplateId(template.id)

    try {
      const result = await replaceCartWithSource(template.items, {
        confirmReplace: () => window.confirm(t('templates.replaceCartConfirm')),
      })

      if (result.cancelled) {
        return
      }

      const issueCount =
        result.missingSkus.length +
        result.unavailableSkus.length +
        result.adjustedQuantities.length

      if (result.addedCount === 0) {
        toast({
          title: t('templates.loadTemplate'),
          description: t('templates.nothingAvailable'),
          variant: 'destructive',
        })
        return
      }

      const description =
        issueCount === 0
          ? t('templates.loadedSuccess', { count: result.addedCount })
          : t('templates.loadedPartial', {
              count: result.addedCount,
              missing: result.missingSkus.length,
              unavailable: result.unavailableSkus.length,
              adjusted: result.adjustedQuantities.length,
            })

      toast({
        title: t('templates.loadTemplate'),
        description,
      })
    } catch (error) {
      toast({
        title: t('settings.error'),
        description: error instanceof Error ? error.message : t('templates.loadFailed'),
        variant: 'destructive',
      })
    } finally {
      setActiveTemplateId(null)
    }
  }

  const handleDeleteTemplate = async (template: OrderTemplate) => {
    const confirmed = window.confirm(
      t('templates.deleteConfirm', { name: template.name }),
    )

    if (!confirmed) {
      return
    }

    setActiveTemplateId(template.id)

    try {
      await deleteTemplateAsync(template.id)
      toast({
        title: t('general.success'),
        description: t('templates.deletedSuccess', { name: template.name }),
      })
    } catch (error) {
      toast({
        title: t('settings.error'),
        description: error instanceof Error ? error.message : t('templates.deleteFailed'),
        variant: 'destructive',
      })
    } finally {
      setActiveTemplateId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t('templates.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('templates.subtitle')}</p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('general.name')}</TableHead>
              <TableHead>{t('orders.items')}</TableHead>
              <TableHead>{t('templates.updated')}</TableHead>
              <TableHead className="text-right">{t('orders.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center">
                  {t('general.loading')}
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{t('templates.emptyTitle')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('templates.emptyDescription')}
                      </p>
                    </div>
                    <Button onClick={() => navigate(withBase('/dashboard/orders'))}>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {t('templates.browseOrders')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => {
                const isBusy = activeTemplateId === template.id

                return (
                  <TableRow key={template.id}>
                    <TableCell className="max-w-[280px] truncate font-medium" title={template.name}>
                      {template.name}
                    </TableCell>
                    <TableCell>{template.items.length}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTemplateDate(template.updated_at, i18n.language || 'en')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void handleLoadTemplate(template)
                          }}
                          disabled={isBusy}
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          {t('templates.loadTemplate')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void handleDeleteTemplate(template)
                          }}
                          disabled={isBusy}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('general.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
