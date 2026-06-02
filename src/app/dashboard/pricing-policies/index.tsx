import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Tags, Search, Trash2, Plus, Info, Loader2, X } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useAppContext } from '@/lib/app/AppContext'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { useQueryClients } from '@/hooks/useQueryClients'
import { useCategoryHierarchy } from '@/hooks/useCategoryHierarchy'
import { usePricingPolicyForClient } from '@/hooks/usePricingPolicyForClient'
import {
  useMutationUpsertPricingPolicy,
  useMutationAddPricingPolicyItem,
  useMutationRemovePricingPolicyItem,
} from '@/hooks/useMutationPricingPolicy'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { Client, PricingPolicyItem } from '@/types'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ProductSearchRow {
  id: string
  sku: string
  name: string
}

interface FlatCategory {
  id: string
  label: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clampPercent = (n: number): number => {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 50) return 50
  return n
}

const percentToRate = (p: number): number => Math.round(p * 100) / 10000 // 15 → 0.15
const rateToPercent = (r: number | null | undefined): number =>
  r ? Math.round(r * 10000) / 100 : 0

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function PricingPoliciesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Admin guard — match the pattern used by ClientsPage.
  useEffect(() => {
    if (!isAdmin) {
      navigate(withBase('/dashboard'))
    }
  }, [isAdmin, navigate, withBase])

  const [clientQuery, setClientQuery] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    searchParams.get('client'),
  )

  const { data: clients, isLoading: clientsLoading } = useQueryClients()

  const filteredClients = useMemo<Client[]>(() => {
    if (!clients) return []
    const q = clientQuery.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      const name = (c.full_name || c.company_name || '').toLowerCase()
      const email = (c.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [clients, clientQuery])

  const selectedClient = useMemo<Client | null>(() => {
    if (!selectedClientId || !clients) return null
    return clients.find((c) => c.id === selectedClientId) ?? null
  }, [clients, selectedClientId])

  // Keep URL in sync with selection (shareable deep-links).
  useEffect(() => {
    const current = searchParams.get('client')
    if ((selectedClientId ?? null) === current) return
    const next = new URLSearchParams(searchParams)
    if (selectedClientId) next.set('client', selectedClientId)
    else next.delete('client')
    setSearchParams(next, { replace: true })
  }, [selectedClientId, searchParams, setSearchParams])

  if (!isAdmin) return null

  return (
    <div className="space-y-4 pb-16 md:pb-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
            <Tags className="h-6 w-6" />
            {t('pricingPolicies.title')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('pricingPolicies.description')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Clients column ------------------------------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('pricingPolicies.clientsHeading')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder={t('pricingPolicies.searchClients')}
                className="pl-8"
              />
            </div>

            {clientsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredClients.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                {t('pricingPolicies.loadingClients')}
              </p>
            ) : (
              <ul className="-mx-2 max-h-[520px] space-y-1 overflow-y-auto">
                {filteredClients.map((c) => {
                  const label =
                    c.company_name || c.full_name || c.email || c.id.slice(0, 8)
                  const active = c.id === selectedClientId
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedClientId(c.id)}
                        className={
                          'w-full rounded-md px-2 py-2 text-left text-sm transition-colors ' +
                          (active
                            ? 'bg-[#0f172a] text-white'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800')
                        }
                      >
                        <div className="font-medium leading-tight">{label}</div>
                        {c.email && (
                          <div
                            className={
                              'text-xs ' +
                              (active
                                ? 'text-gray-200'
                                : 'text-gray-500 dark:text-gray-400')
                            }
                          >
                            {c.email}
                          </div>
                        )}
                        {c.commission_rate ? (
                          <div
                            className={
                              'mt-0.5 text-[11px] uppercase tracking-wide ' +
                              (active ? 'text-gray-200' : 'text-gray-500')
                            }
                          >
                            {rateToPercent(c.commission_rate)}%
                          </div>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Editor column -------------------------------------------------- */}
        <div className="min-w-0 space-y-4">
          {selectedClient ? (
            <PolicyEditor key={selectedClient.id} client={selectedClient} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-gray-500">
                {t('pricingPolicies.noClientSelected')}
              </CardContent>
            </Card>
          )}

          <PriorityNote />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PriorityNote
// ---------------------------------------------------------------------------

function PriorityNote() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="flex gap-3 py-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
        <div>
          <div className="font-semibold">{t('pricingPolicies.priorityTitle')}</div>
          <ol className="mt-1 space-y-0.5 text-gray-700 dark:text-gray-300">
            <li>{t('pricingPolicies.priorityProduct')}</li>
            <li>{t('pricingPolicies.priorityCategory')}</li>
            <li>{t('pricingPolicies.priorityDefault')}</li>
          </ol>
          <p className="mt-2 text-xs text-gray-500">{t('pricingPolicies.priorityHelp')}</p>
          {/* TODO (v2): support reusable policy templates assigned to multiple
              clients. Today the schema is client-first (one policy per client). */}
          <p className="mt-2 text-[11px] text-gray-400 italic">
            {t('pricingPolicies.futureReusablePoliciesNote')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// PolicyEditor — one selected client
// ---------------------------------------------------------------------------

interface PolicyEditorProps {
  client: Client
}

function PolicyEditor({ client }: PolicyEditorProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { data: resolved, isLoading: policyLoading } = usePricingPolicyForClient(client.id)
  const upsertPolicy = useMutationUpsertPricingPolicy()
  const addItem = useMutationAddPricingPolicyItem()
  const removeItem = useMutationRemovePricingPolicyItem()

  const clientLabel =
    client.company_name || client.full_name || client.email || client.id.slice(0, 8)

  const [name, setName] = useState('')
  const [defaultPercent, setDefaultPercent] = useState<number>(0)
  const [isActive, setIsActive] = useState<boolean>(true)

  // Sync form state when the loaded policy changes.
  useEffect(() => {
    if (resolved) {
      setName(resolved.policy.name)
      setDefaultPercent(rateToPercent(resolved.policy.default_discount))
      setIsActive(resolved.policy.is_active)
    } else if (!policyLoading) {
      // Sensible defaults for the create form.
      setName(`${clientLabel}`)
      setDefaultPercent(rateToPercent(client.commission_rate))
      setIsActive(true)
    }
    // Intentionally exclude clientLabel/client.commission_rate from deps so
    // typing in the form does not snap fields back to defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, policyLoading])

  const policy = resolved?.policy ?? null
  const items: PricingPolicyItem[] = useMemo(() => resolved?.items ?? [], [resolved])
  const productItems = items.filter((i) => i.scope === 'product')
  const categoryItems = items.filter((i) => i.scope === 'category')

  const handleSavePolicy = async () => {
    if (defaultPercent < 0 || defaultPercent > 50) {
      toast({
        title: t('pricingPolicies.error'),
        description: t('pricingPolicies.invalidDiscount'),
        variant: 'destructive',
      })
      return
    }
    try {
      await upsertPolicy.mutateAsync({
        clientUserId: client.id,
        name: name.trim() || clientLabel,
        defaultDiscount: percentToRate(clampPercent(defaultPercent)),
        isActive,
      })
      toast({ title: t('pricingPolicies.saved') })
    } catch (err) {
      toast({
        title: t('pricingPolicies.error'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">
            {t('pricingPolicies.policyForClient', { name: clientLabel })}
          </CardTitle>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? t('pricingPolicies.active') : t('pricingPolicies.inactive')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {policyLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-32" />
          </div>
        ) : (
          <>
            {!policy && (
              <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {t('pricingPolicies.noPolicyYet')}
              </p>
            )}

            {/* Header fields */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_140px]">
              <div className="space-y-1">
                <Label htmlFor="policy-name">{t('pricingPolicies.policyName')}</Label>
                <Input
                  id="policy-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('pricingPolicies.policyNamePlaceholder', { name: clientLabel })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="policy-default">{t('pricingPolicies.defaultDiscount')} (%)</Label>
                <Input
                  id="policy-default"
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={defaultPercent}
                  onChange={(e) => setDefaultPercent(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="policy-active">{t('pricingPolicies.active')}</Label>
                <div className="flex h-10 items-center">
                  <Switch
                    id="policy-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSavePolicy} disabled={upsertPolicy.isPending}>
                {upsertPolicy.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {policy
                  ? t('pricingPolicies.savePolicy')
                  : t('pricingPolicies.createPolicy')}
              </Button>
            </div>

            {/* Item editors only after the policy exists */}
            {policy && (
              <div className="space-y-6 border-t border-gray-200 pt-6 dark:border-gray-700">
                <CategoryOverridesSection
                  policyId={policy.id}
                  clientUserId={client.id}
                  items={categoryItems}
                  onAdd={(scope, payload) =>
                    addItem.mutateAsync({
                      policyId: policy.id,
                      clientUserId: client.id,
                      scope,
                      categoryId: payload.categoryId,
                      discount: payload.discount,
                    })
                  }
                  onRemove={(itemId) =>
                    removeItem.mutateAsync({ itemId, clientUserId: client.id })
                  }
                  adding={addItem.isPending}
                  removing={removeItem.isPending}
                />

                <ProductOverridesSection
                  policyId={policy.id}
                  clientUserId={client.id}
                  items={productItems}
                  onAdd={(scope, payload) =>
                    addItem.mutateAsync({
                      policyId: policy.id,
                      clientUserId: client.id,
                      scope,
                      productSku: payload.productSku,
                      discount: payload.discount,
                    })
                  }
                  onRemove={(itemId) =>
                    removeItem.mutateAsync({ itemId, clientUserId: client.id })
                  }
                  adding={addItem.isPending}
                  removing={removeItem.isPending}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// CategoryOverridesSection
// ---------------------------------------------------------------------------

interface AddCategoryPayload { categoryId: string; discount: number }
interface AddProductPayload  { productSku: string; discount: number }

interface CategorySectionProps {
  policyId: string
  clientUserId: string
  items: PricingPolicyItem[]
  onAdd: (scope: 'category', payload: AddCategoryPayload) => Promise<unknown>
  onRemove: (itemId: string) => Promise<unknown>
  adding: boolean
  removing: boolean
}

function CategoryOverridesSection({ items, onAdd, onRemove, adding, removing }: CategorySectionProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { data: hierarchy } = useCategoryHierarchy()

  const flatCategories: FlatCategory[] = useMemo(() => {
    if (!hierarchy) return []
    const list: FlatCategory[] = []
    hierarchy.mainCategories.forEach((main) => {
      list.push({ id: main.id, label: main.name })
      main.subcategories.forEach((sub) => {
        list.push({ id: sub.id, label: `${main.name} › ${sub.subcategory}` })
      })
    })
    return list
  }, [hierarchy])

  const labelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of flatCategories) m.set(c.id, c.label)
    return m
  }, [flatCategories])

  // Exclude categories that are already overridden in this policy so duplicates
  // can't even be selected from the dropdown.
  const usedCategoryIds = useMemo(
    () => new Set(items.map((i) => i.category_id).filter((id): id is string => !!id)),
    [items],
  )
  const availableCategories = useMemo(
    () => flatCategories.filter((c) => !usedCategoryIds.has(c.id)),
    [flatCategories, usedCategoryIds],
  )

  const [pickedCategory, setPickedCategory] = useState<string>('')
  const [pickedPercent, setPickedPercent] = useState<number>(0)

  const validDiscount = pickedPercent > 0 && pickedPercent <= 50
  const canAdd = !!pickedCategory && validDiscount && !adding

  const handleAdd = async () => {
    if (!pickedCategory) return
    // Belt-and-braces — DB index + this UI check + filtered dropdown.
    if (items.some((i) => i.category_id === pickedCategory)) {
      toast({ title: t('pricingPolicies.duplicateOverride'), variant: 'destructive' })
      return
    }
    if (!validDiscount) {
      toast({ title: t('pricingPolicies.invalidDiscount'), variant: 'destructive' })
      return
    }
    try {
      await onAdd('category', {
        categoryId: pickedCategory,
        discount: percentToRate(clampPercent(pickedPercent)),
      })
      setPickedCategory('')
      setPickedPercent(0)
    } catch (err) {
      toast({
        title: t('pricingPolicies.error'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const pickedLabel = pickedCategory ? labelById.get(pickedCategory) ?? pickedCategory : null

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
        {t('pricingPolicies.categoryOverrides')}
      </h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
        <div className="space-y-2">
          <Label className="sr-only">{t('pricingPolicies.selectCategory')}</Label>
          <Select value={pickedCategory} onValueChange={setPickedCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t('pricingPolicies.selectCategory')} />
            </SelectTrigger>
            <SelectContent>
              {availableCategories.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {t('pricingPolicies.noCategoryOverrides')}
                </div>
              ) : (
                availableCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Selected-item card (pre-add preview, Lina-style) */}
          {pickedLabel && (
            <div className="flex items-start justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/40">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  {t('pricingPolicies.selectedCategory')}
                </div>
                <div className="truncate text-gray-900 dark:text-gray-100">{pickedLabel}</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPickedCategory('')}
                aria-label={t('pricingPolicies.clearSelection')}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <Input
          type="number"
          min={0}
          max={50}
          step={0.5}
          placeholder={t('pricingPolicies.discountPercent')}
          value={pickedPercent}
          onChange={(e) => setPickedPercent(parseFloat(e.target.value) || 0)}
        />
        <Button onClick={handleAdd} disabled={!canAdd}>
          <Plus className="mr-1 h-4 w-4" />
          {t('pricingPolicies.addCategoryOverride')}
        </Button>
      </div>

      {pickedCategory && !validDiscount && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {t('pricingPolicies.discountRequired')}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          {t('pricingPolicies.noCategoryOverrides')}
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
            >
              <div className="min-w-0 truncate">
                {item.category_id ? labelById.get(item.category_id) || item.category_id : '—'}
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{rateToPercent(item.discount)}%</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={removing}
                  onClick={() => onRemove(item.id)}
                  aria-label={t('pricingPolicies.remove')}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// ProductOverridesSection
// ---------------------------------------------------------------------------

interface ProductSectionProps {
  policyId: string
  clientUserId: string
  items: PricingPolicyItem[]
  onAdd: (scope: 'product', payload: AddProductPayload) => Promise<unknown>
  onRemove: (itemId: string) => Promise<unknown>
  adding: boolean
  removing: boolean
}

function ProductOverridesSection({ items, onAdd, onRemove, adding, removing }: ProductSectionProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { workspaceId: tenantId } = useAppContext()
  const [search, setSearch] = useState('')
  const [pickedSku, setPickedSku] = useState<string>('')
  const [pickedName, setPickedName] = useState<string>('')
  const [pickedPercent, setPickedPercent] = useState<number>(0)

  // SKUs already overridden in this policy — used to filter both the search
  // result list and the duplicate guard on add.
  const usedSkus = useMemo(
    () => new Set(items.map((i) => i.product_sku).filter((s): s is string => !!s)),
    [items],
  )

  // Lightweight server-side search — only fires when the search input has
  // at least 2 characters. Limited to 20 rows.
  const productSearch = useQuery({
    queryKey: ['workspace', 'pricing-policy', 'product-search', tenantId, search],
    enabled: !!tenantId && search.trim().length >= 2,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ProductSearchRow[]> => {
      if (!tenantId) return []
      const term = search.trim().replace(/[%_]/g, '')
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name')
        .eq('tenant_id', tenantId)
        .or(`sku.ilike.%${term}%,name.ilike.%${term}%`)
        .limit(20)
      if (error) throw error
      return (data ?? []) as ProductSearchRow[]
    },
  })

  // Exclude products already overridden from the search results.
  const visibleResults = useMemo(
    () => (productSearch.data ?? []).filter((p) => !usedSkus.has(p.sku)),
    [productSearch.data, usedSkus],
  )

  const validDiscount = pickedPercent > 0 && pickedPercent <= 50
  const canAdd = !!pickedSku && validDiscount && !adding

  const handleAdd = async () => {
    if (!pickedSku) return
    if (items.some((i) => i.product_sku === pickedSku)) {
      toast({ title: t('pricingPolicies.duplicateOverride'), variant: 'destructive' })
      return
    }
    if (!validDiscount) {
      toast({ title: t('pricingPolicies.invalidDiscount'), variant: 'destructive' })
      return
    }
    try {
      await onAdd('product', {
        productSku: pickedSku,
        discount: percentToRate(clampPercent(pickedPercent)),
      })
      setPickedSku('')
      setPickedName('')
      setSearch('')
      setPickedPercent(0)
    } catch (err) {
      toast({
        title: t('pricingPolicies.error'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
        {t('pricingPolicies.productOverrides')}
      </h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPickedSku('')
                setPickedName('')
              }}
              placeholder={t('pricingPolicies.searchProduct')}
              className="pl-8"
            />
          </div>
          {search.trim().length >= 2 && !pickedSku && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              {productSearch.isLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  …
                </div>
              ) : visibleResults.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {t('pricingPolicies.noProductsFound')}
                </div>
              ) : (
                visibleResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPickedSku(p.sku)
                      setPickedName(p.name || p.sku)
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="truncate">{p.name || p.sku}</span>
                    <span className="ml-2 flex-shrink-0 font-mono text-xs text-gray-500">
                      {p.sku}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected-product card (pre-add preview) */}
          {pickedSku && (
            <div className="flex items-start justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/40">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  {t('pricingPolicies.selectedProduct')}
                </div>
                <div className="truncate text-gray-900 dark:text-gray-100">{pickedName}</div>
                <div className="font-mono text-xs text-gray-500">{pickedSku}</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPickedSku('')
                  setPickedName('')
                }}
                aria-label={t('pricingPolicies.clearSelection')}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <Input
          type="number"
          min={0}
          max={50}
          step={0.5}
          placeholder={t('pricingPolicies.discountPercent')}
          value={pickedPercent}
          onChange={(e) => setPickedPercent(parseFloat(e.target.value) || 0)}
        />
        <Button onClick={handleAdd} disabled={!canAdd}>
          <Plus className="mr-1 h-4 w-4" />
          {t('pricingPolicies.addProductOverride')}
        </Button>
      </div>

      {pickedSku && !validDiscount && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {t('pricingPolicies.discountRequired')}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          {t('pricingPolicies.noProductOverrides')}
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
            >
              <div className="min-w-0 truncate font-mono text-xs">
                {item.product_sku}
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{rateToPercent(item.discount)}%</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={removing}
                  onClick={() => onRemove(item.id)}
                  aria-label={t('pricingPolicies.remove')}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
