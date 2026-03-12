import { useEffect, useMemo } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, PlugZap } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GlassCard } from '@/components/GlassCard'
import { cn } from '@/lib/utils'

const schema = z.object({
  enabled: z.boolean().default(false),
  environment: z.enum(['demo', 'prod']).default('demo'),
  username: z.string().trim().optional().default(''),
  password: z.string().optional().default(''),
  senderName: z.string().trim().min(1, 'Sender name is required'),
  senderPhone: z.string().trim().min(1, 'Sender phone is required'),
  senderEmail: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  senderOfficeCode: z.string().trim().optional().or(z.literal('')),
  senderCity: z.string().trim().optional().or(z.literal('')),
  senderPostCode: z.string().trim().optional().or(z.literal('')),
  senderStreet: z.string().trim().optional().or(z.literal('')),
  senderStreetNum: z.string().trim().optional().or(z.literal('')),
  senderOther: z.string().trim().optional().or(z.literal('')),
  defaultWeightKg: z.coerce.number().positive().max(1000).default(1),
  defaultParcelsCount: z.coerce.number().int().min(1).max(100).default(1),
  defaultPayer: z.enum(['SENDER', 'RECEIVER']).default('SENDER'),
  defaultCodEnabled: z.boolean().default(false),
  defaultDeclaredValueEnabled: z.boolean().default(false),
  trackingThrottleMinutes: z.coerce.number().int().min(5).max(15).default(10),
})
.refine((values) => {
  if (values.senderOfficeCode) return true
  return Boolean(values.senderCity)
}, {
  path: ['senderCity'],
  message: 'Provide sender office code or sender city/address',
})

type FormValues = z.infer<typeof schema>

type SettingsResponse = {
  success: boolean
  integration: {
    enabled: boolean
    environment: 'demo' | 'prod'
    has_credentials: boolean
    defaults: {
      sender?: {
        name?: string
        phone?: string
        email?: string | null
        officeCode?: string | null
        address?: {
          city?: string
          postCode?: string
          street?: string
          streetNum?: string
          other?: string
        } | null
      }
      default_weight_kg?: number
      default_parcels_count?: number
      default_payer?: 'SENDER' | 'RECEIVER'
      default_cod_enabled?: boolean
      default_declared_value_enabled?: boolean
      tracking_throttle_minutes?: number
    }
  }
}

function toFormDefaults(data?: SettingsResponse['integration']): FormValues {
  return {
    enabled: data?.enabled ?? false,
    environment: data?.environment ?? 'demo',
    username: '',
    password: '',
    senderName: data?.defaults?.sender?.name ?? '',
    senderPhone: data?.defaults?.sender?.phone ?? '',
    senderEmail: data?.defaults?.sender?.email ?? '',
    senderOfficeCode: data?.defaults?.sender?.officeCode ?? '',
    senderCity: data?.defaults?.sender?.address?.city ?? '',
    senderPostCode: data?.defaults?.sender?.address?.postCode ?? '',
    senderStreet: data?.defaults?.sender?.address?.street ?? '',
    senderStreetNum: data?.defaults?.sender?.address?.streetNum ?? '',
    senderOther: data?.defaults?.sender?.address?.other ?? '',
    defaultWeightKg: data?.defaults?.default_weight_kg ?? 1,
    defaultParcelsCount: data?.defaults?.default_parcels_count ?? 1,
    defaultPayer: data?.defaults?.default_payer ?? 'SENDER',
    defaultCodEnabled: data?.defaults?.default_cod_enabled ?? false,
    defaultDeclaredValueEnabled: data?.defaults?.default_declared_value_enabled ?? false,
    trackingThrottleMinutes: data?.defaults?.tracking_throttle_minutes ?? 10,
  }
}

export function EcontIntegrationSettings() {
  const { workspaceId: tenantId } = useAppContext()
  const { toast } = useToast()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormDefaults(),
    mode: 'onChange',
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workspace', 'econt-settings'],
    queryFn: async () => {
      if (!tenantId) return null
      const { data, error } = await supabase.functions.invoke('econt-settings-get', {
        body: { tenant_id: tenantId },
      })
      if (error) throw error
      return data as SettingsResponse
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (data?.integration) {
      form.reset(toFormDefaults(data.integration))
    }
  }, [data, form])

  const hasCredentials = data?.integration?.has_credentials ?? false

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!tenantId) throw new Error('Missing tenant context')
      const payload = {
        tenant_id: tenantId,
        enabled: values.enabled,
        environment: values.environment,
        ...(values.username && values.password
          ? { username: values.username, password: values.password }
          : {}),
        defaults: {
          sender: {
            name: values.senderName,
            phone: values.senderPhone,
            email: values.senderEmail || null,
            officeCode: values.senderOfficeCode || null,
            address: values.senderCity
              ? {
                  countryCode3: 'BGR',
                  city: values.senderCity,
                  postCode: values.senderPostCode || undefined,
                  street: values.senderStreet || undefined,
                  streetNum: values.senderStreetNum || undefined,
                  other: values.senderOther || undefined,
                }
              : null,
          },
          default_weight_kg: values.defaultWeightKg,
          default_parcels_count: values.defaultParcelsCount,
          default_payer: values.defaultPayer,
          default_cod_enabled: values.defaultCodEnabled,
          default_declared_value_enabled: values.defaultDeclaredValueEnabled,
          tracking_throttle_minutes: values.trackingThrottleMinutes,
        },
      }

      const { data, error } = await supabase.functions.invoke('econt-settings-save', {
        body: payload,
      })
      if (error) throw error
      return data as SettingsResponse
    },
    onSuccess: (saved) => {
      form.reset({
        ...toFormDefaults(saved.integration),
        username: '',
        password: '',
      })
      refetch()
      toast({
        title: 'Econt settings saved',
        description: 'Tenant Econt integration settings were updated.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save Econt settings',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const environment = form.watch('environment')

  const demoHint = useMemo(() => {
    if (environment !== 'demo') return null
    return 'Demo endpoint: https://demo.econt.com/ee/services/ (demo creds iasp-dev / 1Asp-dev are used if no custom creds are saved)'
  }, [environment])

  return (
    <GlassCard className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <PlugZap className="h-4 w-4" />
            <h2 className="text-xl font-semibold">Econt</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure tenant-level Econt credentials and shipment defaults. Credentials are stored server-side and never returned to the browser.
          </p>
        </div>
        <div className={cn(
          'text-xs rounded-full px-2 py-1 border',
          hasCredentials ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
        )}>
          {hasCredentials ? 'Credentials saved' : 'No saved credentials'}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Econt settings...
        </div>
      ) : (
        <form className="space-y-6" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-4 md:col-span-2">
              <div>
                <Label htmlFor="econt-enabled">Enable Econt</Label>
                <p className="text-xs text-muted-foreground">Disable to prevent shipping actions for this tenant.</p>
              </div>
              <Controller
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch id="econt-enabled" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Environment</Label>
              <Controller
                control={form.control}
                name="environment"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="prod">Production</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {demoHint ? <p className="text-xs text-muted-foreground">{demoHint}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="trackingThrottleMinutes">Tracking throttle (minutes)</Label>
              <Input id="trackingThrottleMinutes" type="number" min={5} max={15} step={1} {...form.register('trackingThrottleMinutes', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">Server-enforced on-demand tracking refresh throttle (5-15 min).</p>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="font-medium">Credentials</p>
              <p className="text-xs text-muted-foreground">
                Leave blank to keep existing credentials. For demo mode, built-in Econt demo credentials can be used.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="econt-username">Username</Label>
                <Input id="econt-username" autoComplete="off" {...form.register('username')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="econt-password">Password</Label>
                <Input id="econt-password" type="password" autoComplete="new-password" {...form.register('password')} />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="font-medium">Sender defaults</p>
              <p className="text-xs text-muted-foreground">Provide sender office code or sender address (office code takes priority).</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Sender name</Label>
                <Input {...form.register('senderName')} />
                {form.formState.errors.senderName ? <p className="text-xs text-red-600">{form.formState.errors.senderName.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Sender phone</Label>
                <Input {...form.register('senderPhone')} />
                {form.formState.errors.senderPhone ? <p className="text-xs text-red-600">{form.formState.errors.senderPhone.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Sender email (optional)</Label>
                <Input type="email" {...form.register('senderEmail')} />
                {form.formState.errors.senderEmail ? <p className="text-xs text-red-600">{form.formState.errors.senderEmail.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Sender office code (optional)</Label>
                <Input placeholder="ex: 1000" {...form.register('senderOfficeCode')} />
              </div>
              <div className="space-y-2">
                <Label>Sender city (required if no office code)</Label>
                <Input {...form.register('senderCity')} />
                {form.formState.errors.senderCity ? <p className="text-xs text-red-600">{form.formState.errors.senderCity.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Sender post code</Label>
                <Input {...form.register('senderPostCode')} />
              </div>
              <div className="space-y-2">
                <Label>Sender street</Label>
                <Input {...form.register('senderStreet')} />
              </div>
              <div className="space-y-2">
                <Label>Sender street no.</Label>
                <Input {...form.register('senderStreetNum')} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Sender address notes</Label>
                <Input {...form.register('senderOther')} />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="font-medium">Shipment defaults</p>
              <p className="text-xs text-muted-foreground">Used to prefill shipment creation and as server-side fallback values.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Default weight (kg)</Label>
                <Input type="number" step="0.1" min={0.1} {...form.register('defaultWeightKg', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Default parcels</Label>
                <Input type="number" step={1} min={1} {...form.register('defaultParcelsCount', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Default payer</Label>
                <Controller
                  control={form.control}
                  name="defaultPayer"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SENDER">Sender</SelectItem>
                        <SelectItem value="RECEIVER">Receiver</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Default COD enabled</Label>
                </div>
                <Controller control={form.control} name="defaultCodEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Default declared value enabled</Label>
                </div>
                <Controller control={form.control} name="defaultDeclaredValueEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Econt settings
            </Button>
            <Button type="button" variant="outline" onClick={() => refetch()} disabled={isLoading || saveMutation.isPending}>
              Reload
            </Button>
          </div>
        </form>
      )}
    </GlassCard>
  )
}
