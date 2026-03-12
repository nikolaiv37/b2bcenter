import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown, Loader2, PackageSearch, RefreshCcw, Truck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase/client'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getCarrierAdapter } from '@/lib/shipping/carriers/registry'
import type { ShipmentDraftInput } from '@/lib/shipping/carriers/types'
import { cn } from '@/lib/utils'

const schema = z.object({
  receiverName: z.string().trim().min(1, 'Receiver name is required'),
  receiverPhone: z.string().trim().min(1, 'Receiver phone is required'),
  receiverEmail: z.string().trim().optional().or(z.literal('')),
  destinationType: z.enum(['office', 'address']),
  officeCode: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  postCode: z.string().trim().optional().or(z.literal('')),
  street: z.string().trim().optional().or(z.literal('')),
  streetNum: z.string().trim().optional().or(z.literal('')),
  other: z.string().trim().optional().or(z.literal('')),
  weightKg: z.coerce.number().positive(),
  parcelsCount: z.coerce.number().int().min(1),
  payer: z.enum(['SENDER', 'RECEIVER']),
  codAmount: z.coerce.number().min(0).optional(),
  declaredValue: z.coerce.number().min(0).optional(),
  description: z.string().trim().max(255).optional().or(z.literal('')),
}).superRefine((values, ctx) => {
  if (values.destinationType === 'office' && !values.officeCode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['officeCode'], message: 'Office code is required' })
  }
  if (values.destinationType === 'address' && !values.city) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['city'], message: 'City is required' })
  }
})

type FormValues = z.infer<typeof schema>

interface OrderShipmentSeed {
  quoteId: number | string
  orderNumber?: number | string | null
  receiverName?: string | null
  receiverPhone?: string | null
  receiverEmail?: string | null
}

interface ShipmentRow {
  id: string
  quote_id: number | null
  carrier: string
  status: string
  price_amount: number | null
  currency: string | null
  econt_waybill_number: string | null
  econt_label_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
  last_synced_at: string | null
  tracking_last_requested_at: string | null
}

interface EcontSettingsSanitized {
  success: boolean
  integration: {
    enabled: boolean
    environment: 'demo' | 'prod'
    defaults: {
      default_weight_kg?: number
      default_parcels_count?: number
      default_payer?: 'SENDER' | 'RECEIVER'
      tracking_throttle_minutes?: number
      default_cod_enabled?: boolean
      default_declared_value_enabled?: boolean
    }
  }
}

interface EcontOfficeRow {
  code: string
  name: string
  city: string | null
}

interface EcontOfficeListResponse {
  success: boolean
  count: number
  offices: EcontOfficeRow[]
}

function toDefaultForm(seed: OrderShipmentSeed, settings?: EcontSettingsSanitized['integration']): FormValues {
  const defaults = settings?.defaults || {}
  return {
    receiverName: seed.receiverName || '',
    receiverPhone: seed.receiverPhone || '',
    receiverEmail: seed.receiverEmail || '',
    destinationType: 'office',
    officeCode: '',
    city: '',
    postCode: '',
    street: '',
    streetNum: '',
    other: '',
    weightKg: defaults.default_weight_kg ?? 1,
    parcelsCount: defaults.default_parcels_count ?? 1,
    payer: defaults.default_payer ?? 'SENDER',
    codAmount: defaults.default_cod_enabled ? 0 : undefined,
    declaredValue: defaults.default_declared_value_enabled ? 0 : undefined,
    description: seed.orderNumber ? `Order #${seed.orderNumber}` : '',
  }
}

function buildShipmentPayload(seed: OrderShipmentSeed, values: FormValues): ShipmentDraftInput {
  return {
    quoteId: Number(seed.quoteId),
    receiver: {
      name: values.receiverName,
      phone: values.receiverPhone,
      email: values.receiverEmail || null,
    },
    destination: values.destinationType === 'office'
      ? { type: 'office', officeCode: values.officeCode }
      : {
          type: 'address',
          address: {
            countryCode3: 'BGR',
            city: values.city || '',
            postCode: values.postCode || undefined,
            street: values.street || undefined,
            streetNum: values.streetNum || undefined,
            other: values.other || undefined,
          },
        },
    parcelsCount: values.parcelsCount,
    weightKg: values.weightKg,
    payer: values.payer,
    codAmount: values.codAmount && values.codAmount > 0 ? values.codAmount : null,
    declaredValue: values.declaredValue && values.declaredValue > 0 ? values.declaredValue : null,
    description: values.description || null,
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function collectErrorMessages(node: unknown, out: string[]) {
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  if (typeof obj.message === 'string' && obj.message.trim()) {
    out.push(obj.message.trim())
  }
  if (Array.isArray(obj.innerErrors)) {
    for (const child of obj.innerErrors) collectErrorMessages(child, out)
  }
}

interface EcontErrorEntry {
  type: string | null
  message: string | null
}

function collectErrorEntries(node: unknown, out: EcontErrorEntry[]) {
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  out.push({
    type: typeof obj.type === 'string' ? obj.type : null,
    message: typeof obj.message === 'string' ? obj.message.trim() : null,
  })
  if (Array.isArray(obj.innerErrors)) {
    for (const child of obj.innerErrors) collectErrorEntries(child, out)
  }
}

function extractErrorPayload(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== 'object') return null
  const payload = (error as { payload?: unknown }).payload
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
}

function extractAllowedOffices(messages: string[]): string[] {
  const source = messages.find((m) => m.includes('Допустими офиси'))
  if (!source) return []

  const marker = 'Допустими офиси за този тип пратка са '
  const idx = source.indexOf(marker)
  const listText = idx >= 0 ? source.slice(idx + marker.length) : source

  return Array.from(
    new Set(
      listText
        .replace(/\.$/, '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ).slice(0, 250)
}

function getReadableErrorMessage(error: unknown): string {
  const payload = extractErrorPayload(error)
  if (payload) {
    const details = payload.details && typeof payload.details === 'object' ? (payload.details as Record<string, unknown>) : null
    const econt = details?.econt
    const messages: string[] = []
    collectErrorMessages(econt, messages)
    const unique = Array.from(new Set(messages.filter(Boolean)))
    if (unique.length > 0) {
      return unique.join(' | ')
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim()
    }
  }
  return error instanceof Error ? error.message : 'Unknown error'
}

function normalizeValidationMessage(t: (key: string, options?: Record<string, unknown>) => string, message: string) {
  if (message.includes('Несъответствие между населено място и пощенски код')) {
    return t('shippingEcont.validation.cityPostCodeMismatch')
  }
  if (message.includes('Невалидн') && message.includes('населено място')) {
    return t('shippingEcont.validation.invalidCity')
  }
  if (message.includes('Допустими офиси') || message.includes('Невалиден обслужващ офис')) {
    return t('shippingEcont.validation.invalidOffice')
  }
  if (message.includes('Необходим е телефон или e-mail адрес на клиента')) {
    return t('shippingEcont.validation.phoneOrEmailRequired')
  }
  if (message.includes('задължително се попълва упълномощено лице')) {
    return t('shippingEcont.validation.authorizedPersonRequired')
  }
  if (message.includes('Информацията, която попълнихте за адрес, е недостатъчна')) {
    return t('shippingEcont.validation.addressInsufficient')
  }
  return message
}

function normalizeOfficeText(value: string) {
  return value
    .toLocaleLowerCase('bg')
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"!?@+[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CYR_TO_LAT_MULTI: Array<[string, string]> = [
  ['щ', 'sht'],
  ['ш', 'sh'],
  ['ч', 'ch'],
  ['ц', 'ts'],
  ['ю', 'yu'],
  ['я', 'ya'],
  ['ж', 'zh'],
]

const CYR_TO_LAT_SINGLE: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ь: '',
  ю: 'yu',
  я: 'ya',
}

function transliterateCyrToLat(value: string) {
  let out = normalizeOfficeText(value)
  for (const [from, to] of CYR_TO_LAT_MULTI) {
    out = out.split(from).join(to)
  }
  let mapped = ''
  for (const ch of out) {
    mapped += CYR_TO_LAT_SINGLE[ch] ?? ch
  }
  return normalizeOfficeText(mapped)
}

function officeSearchTokens(value: string) {
  const normalized = normalizeOfficeText(value)
  return {
    normalized,
    latinized: transliterateCyrToLat(normalized),
  }
}

function officeTextMatches(input: string, target: string) {
  const a = officeSearchTokens(input)
  const b = officeSearchTokens(target)
  if (!a.normalized || !b.normalized) return false
  if (a.normalized === b.normalized || a.latinized === b.latinized) return true
  if (b.normalized.includes(a.normalized) || b.latinized.includes(a.latinized)) return true
  return false
}

export function ShipmentPanel({ seed, className }: { seed: OrderShipmentSeed; className?: string }) {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const tenantId = tenant?.id
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [lastTrackMessage, setLastTrackMessage] = useState<string | null>(null)
  const [nextTrackAllowedAt, setNextTrackAllowedAt] = useState<string | null>(null)
  const [officeSuggestions, setOfficeSuggestions] = useState<string[]>([])
  const [officePickerOpen, setOfficePickerOpen] = useState(false)
  const [officeSearch, setOfficeSearch] = useState('')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaultForm(seed),
    mode: 'onBlur',
  })
  const destinationType = form.watch('destinationType')

  const adapter = useMemo(() => (tenantId ? getCarrierAdapter(tenantId, 'econt') : null), [tenantId])
  const numericQuoteId = Number(seed.quoteId)

  const settingsQuery = useQuery({
    queryKey: ['tenant', tenantId, 'econt-settings-sanitized'],
    queryFn: async () => {
      if (!tenantId) return null
      const { data, error } = await supabase.functions.invoke('econt-settings-get', { body: { tenant_id: tenantId } })
      if (error) throw error
      return data as EcontSettingsSanitized
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  })
  const integrationEnabled = settingsQuery.data?.integration?.enabled ?? false

  const shipmentsQuery = useQuery({
    queryKey: ['tenant', tenantId, 'shipments', 'econt', numericQuoteId],
    queryFn: async () => {
      if (!tenantId || !Number.isFinite(numericQuoteId)) return [] as ShipmentRow[]
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('carrier', 'econt')
        .eq('quote_id', numericQuoteId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as ShipmentRow[]
    },
    enabled: !!tenantId && Number.isFinite(numericQuoteId),
    staleTime: 15_000,
  })

  const officesQuery = useQuery({
    queryKey: ['tenant', tenantId, 'econt-offices'],
    queryFn: async () => {
      if (!tenantId) return [] as EcontOfficeRow[]
      const { data, error } = await supabase.functions.invoke('econt-offices-list', {
        body: { tenant_id: tenantId, limit: 800 },
      })
      if (error) throw error
      return (data as EcontOfficeListResponse).offices || []
    },
    enabled: !!tenantId && integrationEnabled,
    staleTime: 30 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (settingsQuery.data?.integration) {
      const current = form.getValues()
      const next = toDefaultForm(seed, settingsQuery.data.integration)
      form.reset({ ...next, receiverName: current.receiverName || next.receiverName, receiverPhone: current.receiverPhone || next.receiverPhone, receiverEmail: current.receiverEmail || next.receiverEmail })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data?.integration, seed.quoteId])

  const latestShipment = shipmentsQuery.data?.[0] ?? null
  const activeShipmentId = latestShipment?.id
  const draftShipmentId = latestShipment && !latestShipment.econt_waybill_number ? latestShipment.id : undefined

  const invalidateShipments = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'shipments', 'econt', numericQuoteId] })
  }

  const clearCarrierFieldErrors = () => {
    form.clearErrors([
      'receiverPhone',
      'receiverEmail',
      'officeCode',
      'city',
      'postCode',
      'street',
      'streetNum',
      'other',
    ])
  }

  const applyOfficeSuggestionsFromError = (error: unknown) => {
    const payload = extractErrorPayload(error)
    if (!payload) return
    const details = payload.details && typeof payload.details === 'object' ? (payload.details as Record<string, unknown>) : null
    const econt = details?.econt
    const messages: string[] = []
    collectErrorMessages(econt, messages)
    const allowed = extractAllowedOffices(messages)
    const resolverSuggestions = Array.isArray(details?.suggestions)
      ? details?.suggestions.filter((v): v is string => typeof v === 'string' && Boolean(v.trim())).map((v) => v.trim())
      : []
    const combined = Array.from(new Set([...allowed, ...resolverSuggestions])).slice(0, 250)
    if (combined.length > 0) {
      setOfficeSuggestions(combined)
    }
  }

  const applyFieldErrorsFromCarrierError = (error: unknown) => {
    const payload = extractErrorPayload(error)
    if (!payload) return false
    const details = payload.details && typeof payload.details === 'object' ? (payload.details as Record<string, unknown>) : null
    const econt = details?.econt
    const entries: EcontErrorEntry[] = []
    collectErrorEntries(econt, entries)

    const messages = entries
      .map((entry) => entry.message)
      .filter((value): value is string => Boolean(value && value.trim()))

    let applied = false
    const assign = (field: keyof FormValues, message: string) => {
      form.setError(field, { type: 'server', message })
      applied = true
    }

    for (const message of messages) {
      const normalizedMessage = normalizeValidationMessage(t, message)
      if (message.includes('Несъответствие между населено място и пощенски код')) {
        assign('city', normalizedMessage)
        assign('postCode', normalizedMessage)
        continue
      }
      if (message.includes('Невалидн') && message.includes('населено място')) {
        assign('city', normalizedMessage)
        continue
      }
      if (message.toLowerCase().includes('пощенски код')) {
        assign('postCode', normalizedMessage)
        continue
      }
      if (message.includes('обслужващ офис') || message.includes('Допустими офиси')) {
        assign('officeCode', normalizedMessage)
        continue
      }
      if (message.includes('Информацията, която попълнихте за адрес, е недостатъчна')) {
        assign('street', normalizedMessage)
        assign('streetNum', normalizedMessage)
        assign('other', normalizedMessage)
        continue
      }
      if (message.toLowerCase().includes('телефон')) {
        assign('receiverPhone', normalizedMessage)
        continue
      }
      if (message.toLowerCase().includes('e-mail') || message.toLowerCase().includes('имейл')) {
        assign('receiverEmail', normalizedMessage)
      }
    }

    return applied
  }

  const officeDatalistValues = useMemo(() => {
    const fromApi = (officesQuery.data || []).map((office) => office.name).filter(Boolean)
    return Array.from(new Set([...officeSuggestions, ...fromApi])).slice(0, 1200)
  }, [officeSuggestions, officesQuery.data])
  const selectedOfficeValue = form.watch('officeCode')
  const selectedOffice = useMemo(
    () => (officesQuery.data || []).find((office) => office.code === selectedOfficeValue || office.name === selectedOfficeValue) || null,
    [officesQuery.data, selectedOfficeValue],
  )
  const filteredOffices = useMemo(() => {
    const offices = officesQuery.data || []
    if (!officeSearch.trim()) {
      if (officeSuggestions.length > 0) {
        const suggestionSet = new Set(officeSuggestions)
        const preferred = offices.filter((office) => suggestionSet.has(office.name))
        const rest = offices.filter((office) => !suggestionSet.has(office.name))
        return [...preferred, ...rest].slice(0, 120)
      }
      return offices.slice(0, 120)
    }

    return offices
      .filter((office) => {
        return (
          officeTextMatches(officeSearch, office.name) ||
          officeTextMatches(officeSearch, office.city || '') ||
          office.code.startsWith(officeSearch.trim())
        )
      })
      .slice(0, 120)
  }, [officeSearch, officeSuggestions, officesQuery.data])

  const calculateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!tenantId || !adapter) throw new Error('Missing tenant context')
      clearCarrierFieldErrors()
      return adapter.calculate({
        tenantId,
        shipmentId: draftShipmentId,
        shipment: buildShipmentPayload(seed, values),
      })
    },
    onSuccess: async (result) => {
      setLastTrackMessage(null)
      setNextTrackAllowedAt(null)
      setOfficeSuggestions([])
      toast({
        title: t('shippingEcont.toasts.calculateSuccessTitle'),
        description: result.result.total_price != null
          ? t('shippingEcont.toasts.calculateSuccessWithPrice', {
              price: result.result.total_price,
              currency: result.result.currency,
            })
          : t('shippingEcont.toasts.calculateSuccessDescription'),
      })
      await invalidateShipments()
    },
    onError: (error: Error) => {
      applyOfficeSuggestionsFromError(error)
      const applied = applyFieldErrorsFromCarrierError(error)
      if (!applied) {
        toast({
          title: t('shippingEcont.toasts.calculateErrorTitle'),
          description: getReadableErrorMessage(error),
          variant: 'destructive',
        })
      }
    },
  })

  const createLabelMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!tenantId || !adapter) throw new Error('Missing tenant context')
      clearCarrierFieldErrors()
      return adapter.createLabel({
        tenantId,
        shipmentId: draftShipmentId,
        shipment: buildShipmentPayload(seed, values),
      })
    },
    onSuccess: async (result) => {
      setLastTrackMessage(null)
      setNextTrackAllowedAt(null)
      setOfficeSuggestions([])
      toast({
        title: t('shippingEcont.toasts.createSuccessTitle'),
        description: t('shippingEcont.toasts.createSuccessDescription', { awb: result.result.waybill_number }),
      })
      await invalidateShipments()
    },
    onError: (error: Error) => {
      applyOfficeSuggestionsFromError(error)
      const applied = applyFieldErrorsFromCarrierError(error)
      if (!applied) {
        toast({
          title: t('shippingEcont.toasts.createErrorTitle'),
          description: getReadableErrorMessage(error),
          variant: 'destructive',
        })
      }
    },
  })

  const trackMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !adapter || !activeShipmentId) throw new Error('No shipment to track')
      return adapter.track({ tenantId, shipmentId: activeShipmentId })
    },
    onSuccess: async (result) => {
      if (result.throttled) {
        setLastTrackMessage(
          t('shippingEcont.tracking.tryAgainInMinutes', { minutes: result.retry_after_minutes ?? 1 }),
        )
        setNextTrackAllowedAt(result.next_allowed_at ?? null)
        toast({
          title: t('shippingEcont.toasts.trackThrottledTitle'),
          description: t('shippingEcont.tracking.tryAgainInMinutes', {
            minutes: result.retry_after_minutes ?? 1,
          }),
        })
        return
      }
      setLastTrackMessage(
        result.result?.status_name || result.result?.status || t('shippingEcont.toasts.trackSuccessDescription'),
      )
      setNextTrackAllowedAt(result.next_allowed_at ?? null)
      toast({
        title: t('shippingEcont.toasts.trackSuccessTitle'),
        description:
          result.result?.status_name ||
          result.result?.status ||
          t('shippingEcont.toasts.trackSuccessDescription'),
      })
      await invalidateShipments()
    },
    onError: (error: Error) => {
      toast({
        title: t('shippingEcont.toasts.trackErrorTitle'),
        description: getReadableErrorMessage(error),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !adapter?.deleteLabel || !activeShipmentId) throw new Error('No shipment to cancel')
      await adapter.deleteLabel({ tenantId, shipmentId: activeShipmentId })
    },
    onSuccess: async () => {
      setLastTrackMessage(null)
      setNextTrackAllowedAt(null)
      toast({
        title: t('shippingEcont.toasts.cancelSuccessTitle'),
        description: t('shippingEcont.toasts.cancelSuccessDescription'),
      })
      await invalidateShipments()
    },
    onError: (error: Error) => {
      toast({
        title: t('shippingEcont.toasts.cancelErrorTitle'),
        description: getReadableErrorMessage(error),
        variant: 'destructive',
      })
    },
  })

  const submitDisabled = !tenantId || !adapter || calculateMutation.isPending || createLabelMutation.isPending

  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <h3 className="font-semibold">{t('shippingEcont.title')}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('shippingEcont.subtitle')}
          </p>
        </div>
        <Badge variant={integrationEnabled ? 'secondary' : 'outline'}>
          {integrationEnabled
            ? t('shippingEcont.status.enabled')
            : t('shippingEcont.status.disabled')}
        </Badge>
      </div>

      {!integrationEnabled ? (
        <div className="text-sm rounded border border-amber-200 bg-amber-50 text-amber-800 p-3">
          {t('shippingEcont.integrationDisabledMessage')}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={form.handleSubmit((values) => createLabelMutation.mutate(values))}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('shippingEcont.form.receiverName')}</Label>
            <Input {...form.register('receiverName')} />
            {form.formState.errors.receiverName ? <p className="text-xs text-red-600">{form.formState.errors.receiverName.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>{t('shippingEcont.form.receiverPhone')}</Label>
            <Input {...form.register('receiverPhone')} />
            {form.formState.errors.receiverPhone ? <p className="text-xs text-red-600">{form.formState.errors.receiverPhone.message}</p> : null}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t('shippingEcont.form.receiverEmail')}</Label>
            <Input type="email" {...form.register('receiverEmail')} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('shippingEcont.form.destinationType')}</Label>
            <Controller
              control={form.control}
              name="destinationType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office">{t('shippingEcont.form.destinationOffice')}</SelectItem>
                    <SelectItem value="address">{t('shippingEcont.form.destinationAddress')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {destinationType === 'office' ? (
            <div className="space-y-2">
              <Label>{t('shippingEcont.form.officeCode')}</Label>
              <Popover open={officePickerOpen} onOpenChange={setOfficePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full justify-between px-3 font-normal"
                  >
                    <span className={cn('truncate text-left', !selectedOffice && !selectedOfficeValue ? 'text-muted-foreground' : '')}>
                      {selectedOffice
                        ? `${selectedOffice.name}${selectedOffice.city ? `, ${selectedOffice.city}` : ''}`
                        : selectedOfficeValue || t('shippingEcont.form.officeCodePlaceholder')}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[420px] p-0">
                  <div className="border-b p-3">
                    <Input
                      value={officeSearch}
                      onChange={(event) => setOfficeSearch(event.target.value)}
                      placeholder={t('shippingEcont.officeSuggestions.searchPlaceholder')}
                    />
                  </div>
                  <div
                    className="max-h-72 overflow-y-scroll overscroll-y-contain p-2"
                    onWheelCapture={(event) => event.stopPropagation()}
                    onTouchMoveCapture={(event) => event.stopPropagation()}
                  >
                    {officesQuery.isLoading ? (
                      <div className="px-2 py-6 text-sm text-muted-foreground">
                        {t('shippingEcont.officeSuggestions.loading')}
                      </div>
                    ) : filteredOffices.length === 0 ? (
                      <div className="px-2 py-6 text-sm text-muted-foreground">
                        {t('shippingEcont.officeSuggestions.noResults')}
                      </div>
                    ) : (
                      filteredOffices.map((office) => {
                        const isSelected = selectedOfficeValue === office.code
                        return (
                          <button
                            key={office.code}
                            type="button"
                            className="flex w-full items-start justify-between rounded-md px-3 py-2 text-left hover:bg-muted"
                            onClick={() => {
                              form.setValue('officeCode', office.code, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                              setOfficeSearch(office.name)
                              setOfficePickerOpen(false)
                            }}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{office.name}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {office.city ? `${office.city} • ` : ''}{office.code}
                              </div>
                            </div>
                            <Check className={cn('ml-3 h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                          </button>
                        )
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <input type="hidden" {...form.register('officeCode')} />
              {officeDatalistValues.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('shippingEcont.officeSuggestions.allOfficesLoaded', {
                    count: officesQuery.data?.length ?? officeDatalistValues.length,
                  })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {officesQuery.isLoading
                    ? t('shippingEcont.officeSuggestions.loading')
                    : t('shippingEcont.officeSuggestions.emptyHint')}
                </p>
              )}
              {officeSuggestions.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('shippingEcont.officeSuggestions.helper', { count: officeSuggestions.length })}
                </p>
              ) : null}
              {form.formState.errors.officeCode ? <p className="text-xs text-red-600">{form.formState.errors.officeCode.message}</p> : null}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t('shippingEcont.form.city')}</Label>
                <Input {...form.register('city')} />
                {form.formState.errors.city ? <p className="text-xs text-red-600">{form.formState.errors.city.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>{t('shippingEcont.form.postCode')}</Label>
                <Input {...form.register('postCode')} />
              </div>
              <div className="space-y-2">
                <Label>{t('shippingEcont.form.street')}</Label>
                <Input {...form.register('street')} />
              </div>
              <div className="space-y-2">
                <Label>{t('shippingEcont.form.streetNum')}</Label>
                <Input {...form.register('streetNum')} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t('shippingEcont.form.addressNotes')}</Label>
                <Input {...form.register('other')} />
              </div>
            </>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{t('shippingEcont.form.weight')}</Label>
            <Input type="number" step="0.1" min={0.1} {...form.register('weightKg', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label>{t('shippingEcont.form.parcels')}</Label>
            <Input type="number" step={1} min={1} {...form.register('parcelsCount', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label>{t('shippingEcont.form.payer')}</Label>
            <Controller
              control={form.control}
              name="payer"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SENDER">{t('shippingEcont.form.payerSender')}</SelectItem>
                    <SelectItem value="RECEIVER">{t('shippingEcont.form.payerReceiver')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('shippingEcont.form.codAmount')}</Label>
            <Input type="number" step="0.01" min={0} {...form.register('codAmount', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>{t('shippingEcont.form.declaredValue')}</Label>
            <Input type="number" step="0.01" min={0} {...form.register('declaredValue', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>{t('shippingEcont.form.description')}</Label>
            <Input {...form.register('description')} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={submitDisabled || !integrationEnabled}
            onClick={form.handleSubmit((values) => calculateMutation.mutate(values))}
          >
            {calculateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageSearch className="mr-2 h-4 w-4" />}
            {t('shippingEcont.actions.calculate')}
          </Button>
          <Button type="submit" disabled={submitDisabled || !integrationEnabled}>
            {createLabelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            {t('shippingEcont.actions.createLabel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!latestShipment?.econt_waybill_number || trackMutation.isPending || !integrationEnabled}
            onClick={() => trackMutation.mutate()}
          >
            {trackMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            {t('shippingEcont.actions.track')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-red-600 hover:text-red-700"
            disabled={!latestShipment?.econt_waybill_number || deleteMutation.isPending || !integrationEnabled}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {t('shippingEcont.actions.cancelLabel')}
          </Button>
        </div>
      </form>

      {lastTrackMessage ? (
        <div className="rounded border bg-muted/40 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">{t('shippingEcont.tracking.resultTitle')}</p>
          <p className="text-sm font-medium">{lastTrackMessage}</p>
          {nextTrackAllowedAt ? (
            <p className="text-xs text-muted-foreground">
              {t('shippingEcont.tracking.nextRefreshAfter', { date: formatDateTime(nextTrackAllowedAt) })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t('shippingEcont.shipments.title')}</p>
          {shipmentsQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>

        {!shipmentsQuery.data || shipmentsQuery.data.length === 0 ? (
          <div className="text-sm text-muted-foreground border rounded p-3">{t('shippingEcont.shipments.empty')}</div>
        ) : (
          <div className="space-y-2">
            {shipmentsQuery.data.map((shipment) => {
              const labelData = shipment.econt_label_data || {}
              const printUrl = typeof labelData.printUrl === 'string' ? labelData.printUrl : null
              const pdfUrl = typeof labelData.pdfUrl === 'string' ? labelData.pdfUrl : null
              const raw = labelData.raw && typeof labelData.raw === 'object' ? (labelData.raw as Record<string, unknown>) : null
              const rawLabel = raw?.label && typeof raw.label === 'object' ? (raw.label as Record<string, unknown>) : null
              const uiPrice =
                shipment.price_amount ??
                (typeof labelData.total_price === 'number'
                  ? labelData.total_price
                  : (typeof rawLabel?.totalPrice === 'number' ? rawLabel.totalPrice : null))
              const uiCurrency =
                shipment.currency ||
                (typeof labelData.currency === 'string' ? labelData.currency : null) ||
                (typeof rawLabel?.currency === 'string' ? rawLabel.currency : null) ||
                'BGN'
              const serviceDescription =
                (typeof labelData.service_description === 'string' && labelData.service_description) ||
                (Array.isArray(rawLabel?.services) &&
                rawLabel.services[0] &&
                typeof rawLabel.services[0] === 'object' &&
                typeof (rawLabel.services[0] as Record<string, unknown>).description === 'string'
                  ? ((rawLabel.services[0] as Record<string, unknown>).description as string)
                  : null)
              const expectedDeliveryAt =
                (typeof labelData.expected_delivery_at === 'string' && labelData.expected_delivery_at) ||
                (typeof rawLabel?.expectedDeliveryDate === 'number'
                  ? new Date(rawLabel.expectedDeliveryDate).toISOString()
                  : null)
              return (
                <div key={shipment.id} className="rounded border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{shipment.status}</Badge>
                    {shipment.econt_waybill_number ? (
                      <span className="text-sm font-mono">
                        {t('shippingEcont.shipments.awb', { awb: shipment.econt_waybill_number })}
                      </span>
                    ) : null}
                    {uiPrice != null ? (
                      <span className="text-sm text-muted-foreground">
                        {t('shippingEcont.shipments.price', { price: uiPrice, currency: uiCurrency })}
                      </span>
                    ) : null}
                  </div>
                  {serviceDescription || expectedDeliveryAt ? (
                    <div className="text-xs text-muted-foreground grid gap-1 md:grid-cols-2">
                      {serviceDescription ? (
                        <span>{t('shippingEcont.shipments.service', { service: serviceDescription })}</span>
                      ) : null}
                      {expectedDeliveryAt ? (
                        <span>
                          {t('shippingEcont.shipments.expectedDelivery', {
                            date: formatDateTime(expectedDeliveryAt),
                          })}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="text-xs text-muted-foreground grid gap-1 md:grid-cols-2">
                    <span>{t('shippingEcont.shipments.createdAt', { date: formatDateTime(shipment.created_at) })}</span>
                    <span>{t('shippingEcont.shipments.lastSynced', { date: formatDateTime(shipment.last_synced_at) })}</span>
                    <span>
                      {t('shippingEcont.shipments.trackingRefresh', {
                        date: formatDateTime(shipment.tracking_last_requested_at),
                      })}
                    </span>
                  </div>
                  {(printUrl || pdfUrl) ? (
                    <div className="flex flex-wrap gap-3 text-sm">
                      {printUrl ? (
                        <a className="underline" href={printUrl} target="_blank" rel="noreferrer">
                          {t('shippingEcont.shipments.printLabel')}
                        </a>
                      ) : null}
                      {pdfUrl ? (
                        <a className="underline" href={pdfUrl} target="_blank" rel="noreferrer">
                          {t('shippingEcont.shipments.openPdf')}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
