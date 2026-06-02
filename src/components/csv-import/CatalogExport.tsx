import { useState } from 'react'
import Papa from 'papaparse'
import { useTranslation } from 'react-i18next'
import { Download, FileSpreadsheet, Loader2, Package, Tags, Truck } from 'lucide-react'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useAppContext } from '@/lib/app/AppContext'
import { supabase } from '@/lib/supabase/client'

// ============================================================================
// Catalog Export
//
// Admin-only safety net: download CSV snapshots of the current tenant catalog
// before running imports/syncs that could overwrite manual edits (categories,
// pricing, shipping data, etc.). All queries are scoped by tenant_id.
//
// No restore logic is provided here — the goal is only to make backups easy.
// ============================================================================

interface CategoryRow {
  id: string
  name: string
  parent_id: string | null
  slug: string | null
}

interface ProductExportRow {
  id: string
  sku: string
  name: string | null
  description: string | null
  category: string | null
  category_id: string | null
  manufacturer: string | null
  model: string | null
  retail_price: number | null
  weboffer_price: number | null
  quantity: number | null
  availability: string | null
  weight: number | null
  transportational_weight: number | null
  main_image: string | null
  images: string[] | null
  is_visible: boolean | null
  shipping_weight_kg: number | null
  shipping_parcels_count: number | null
  shipping_length_cm: number | null
  shipping_width_cm: number | null
  shipping_height_cm: number | null
  shipping_requires_review: boolean | null
  created_at: string | null
  updated_at: string | null
}

type ExportKind = 'catalog' | 'categories' | 'shipping'

const UTF8_BOM = '﻿'

function timestampSuffix(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

function triggerDownload(filename: string, csvBody: string) {
  // Papa.unparse already handles escaping of commas, quotes and newlines per
  // RFC 4180. We prepend a UTF-8 BOM so Excel opens Cyrillic content correctly.
  const blob = new Blob([UTF8_BOM + csvBody], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Free the object URL on the next tick.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function buildCategoryLookup(categories: CategoryRow[]) {
  const byId = new Map<string, CategoryRow>()
  for (const category of categories) byId.set(category.id, category)

  function pathOf(id: string | null | undefined): { main: string; sub: string; path: string } {
    if (!id) return { main: '', sub: '', path: '' }
    const node = byId.get(id)
    if (!node) return { main: '', sub: '', path: '' }
    if (!node.parent_id) {
      return { main: node.name, sub: '', path: node.name }
    }
    const parent = byId.get(node.parent_id)
    const main = parent?.name || ''
    const sub = node.name
    const path = main ? `${main} > ${sub}` : sub
    return { main, sub, path }
  }

  return { byId, pathOf }
}

async function fetchAllProducts(tenantId: string): Promise<ProductExportRow[]> {
  // Page through the products table so a large catalog doesn't hit Supabase's
  // default row cap. PostgREST defaults to 1000; we explicitly request 1000 per
  // page and loop until the page comes back short.
  const PAGE = 1000
  const out: ProductExportRow[] = []
  let from = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, sku, name, description, category, category_id, manufacturer, model, retail_price, weboffer_price, quantity, availability, weight, transportational_weight, main_image, images, is_visible, shipping_weight_kg, shipping_parcels_count, shipping_length_cm, shipping_width_cm, shipping_height_cm, shipping_requires_review, created_at, updated_at',
      )
      .eq('tenant_id', tenantId)
      .order('sku', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as ProductExportRow[]
    out.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  return out
}

async function fetchAllCategories(tenantId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, parent_id, slug')
    .eq('tenant_id', tenantId)
  if (error) throw error
  return (data ?? []) as CategoryRow[]
}

function csvFromRows(rows: Array<Record<string, unknown>>, columns: string[]): string {
  return Papa.unparse(
    { fields: columns, data: rows.map((row) => columns.map((col) => row[col] ?? '')) },
    { quotes: true, newline: '\r\n' },
  )
}

export function CatalogExport() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { workspaceId: tenantId } = useAppContext()
  const [busy, setBusy] = useState<ExportKind | null>(null)

  const runExport = async (kind: ExportKind) => {
    if (!tenantId) {
      toast({
        title: t('catalogExport.toasts.missingTenant'),
        variant: 'destructive',
      })
      return
    }
    setBusy(kind)
    try {
      const [products, categories] = await Promise.all([
        fetchAllProducts(tenantId),
        fetchAllCategories(tenantId),
      ])
      const { pathOf } = buildCategoryLookup(categories)
      const stamp = timestampSuffix()

      if (kind === 'catalog') {
        const columns = [
          'sku',
          'name',
          'description',
          'category_id',
          'category_name',
          'category_path',
          'legacy_category',
          'manufacturer',
          'model',
          'retail_price',
          'weboffer_price',
          'quantity',
          'availability',
          'is_visible',
          'main_image',
          'images',
          'weight_legacy',
          'transportational_weight_legacy',
          'shipping_weight_kg',
          'shipping_parcels_count',
          'shipping_length_cm',
          'shipping_width_cm',
          'shipping_height_cm',
          'shipping_requires_review',
          'created_at',
          'updated_at',
        ]
        const rows = products.map((product) => {
          const path = pathOf(product.category_id)
          return {
            sku: product.sku,
            name: product.name ?? '',
            description: product.description ?? '',
            category_id: product.category_id ?? '',
            category_name: path.sub || path.main,
            category_path: path.path,
            legacy_category: product.category ?? '',
            manufacturer: product.manufacturer ?? '',
            model: product.model ?? '',
            retail_price: product.retail_price ?? '',
            weboffer_price: product.weboffer_price ?? '',
            quantity: product.quantity ?? '',
            availability: product.availability ?? '',
            is_visible: product.is_visible === false ? 'archived' : 'active',
            main_image: product.main_image ?? '',
            images: Array.isArray(product.images) ? product.images.join('|') : '',
            weight_legacy: product.weight ?? '',
            transportational_weight_legacy: product.transportational_weight ?? '',
            shipping_weight_kg: product.shipping_weight_kg ?? '',
            shipping_parcels_count: product.shipping_parcels_count ?? '',
            shipping_length_cm: product.shipping_length_cm ?? '',
            shipping_width_cm: product.shipping_width_cm ?? '',
            shipping_height_cm: product.shipping_height_cm ?? '',
            shipping_requires_review: product.shipping_requires_review ? 'true' : 'false',
            created_at: product.created_at ?? '',
            updated_at: product.updated_at ?? '',
          }
        })
        triggerDownload(`catalog-full-${stamp}.csv`, csvFromRows(rows, columns))
      } else if (kind === 'categories') {
        const columns = [
          'sku',
          'name',
          'category_id',
          'main_category',
          'subcategory',
          'category_path',
          'legacy_category_text',
        ]
        const rows = products.map((product) => {
          const path = pathOf(product.category_id)
          return {
            sku: product.sku,
            name: product.name ?? '',
            category_id: product.category_id ?? '',
            main_category: path.main,
            subcategory: path.sub,
            category_path: path.path,
            legacy_category_text: product.category ?? '',
          }
        })
        triggerDownload(`catalog-categories-${stamp}.csv`, csvFromRows(rows, columns))
      } else if (kind === 'shipping') {
        const columns = [
          'sku',
          'name',
          'weight_legacy',
          'transportational_weight_legacy',
          'shipping_weight_kg',
          'shipping_parcels_count',
          'shipping_length_cm',
          'shipping_width_cm',
          'shipping_height_cm',
          'shipping_requires_review',
        ]
        const rows = products.map((product) => ({
          sku: product.sku,
          name: product.name ?? '',
          weight_legacy: product.weight ?? '',
          transportational_weight_legacy: product.transportational_weight ?? '',
          shipping_weight_kg: product.shipping_weight_kg ?? '',
          shipping_parcels_count: product.shipping_parcels_count ?? '',
          shipping_length_cm: product.shipping_length_cm ?? '',
          shipping_width_cm: product.shipping_width_cm ?? '',
          shipping_height_cm: product.shipping_height_cm ?? '',
          shipping_requires_review: product.shipping_requires_review ? 'true' : 'false',
        }))
        triggerDownload(`catalog-shipping-${stamp}.csv`, csvFromRows(rows, columns))
      }

      toast({
        title: t('catalogExport.toasts.successTitle'),
        description: t('catalogExport.toasts.successDescription', { count: products.length }),
      })
    } catch (error) {
      toast({
        title: t('catalogExport.toasts.errorTitle'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  const buttons: Array<{ kind: ExportKind; icon: typeof Package; label: string; description: string }> = [
    {
      kind: 'catalog',
      icon: Package,
      label: t('catalogExport.buttons.fullLabel'),
      description: t('catalogExport.buttons.fullDescription'),
    },
    {
      kind: 'categories',
      icon: Tags,
      label: t('catalogExport.buttons.categoriesLabel'),
      description: t('catalogExport.buttons.categoriesDescription'),
    },
    {
      kind: 'shipping',
      icon: Truck,
      label: t('catalogExport.buttons.shippingLabel'),
      description: t('catalogExport.buttons.shippingDescription'),
    },
  ]

  return (
    <GlassCard className="p-6 space-y-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t('catalogExport.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('catalogExport.subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {buttons.map(({ kind, icon: Icon, label, description }) => (
          <div key={kind} className="rounded border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">{label}</p>
            </div>
            <p className="text-xs text-muted-foreground flex-1">{description}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => runExport(kind)}
            >
              {busy === kind ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t('catalogExport.actions.download')}
            </Button>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
