import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Company } from '@/types'
import { Tooltip } from '@/components/ui/tooltip'
import {
  Upload,
  Phone,
  MapPin,
  Globe,
  Loader2,
  ArrowRight,
  Info,
} from 'lucide-react'

// Schema will be created inside component to use translations
const createCompanyFormSchema = (t: (key: string) => string) =>
  z.object({
    companyName: z.string().min(2, t('company.companyNameMinLength')),
    eikBulstat: z.string().min(1, t('company.eikRequired')),
    vatNumber: z.string().min(1, t('company.vatRequired')),
    phone: z.string().min(1, t('company.phoneRequired')),
    city: z.string().min(1, t('company.cityRequired')),
    address: z.string().min(10, t('company.addressMinLength')),
    website: z.string().url(t('company.invalidUrl')).optional().or(z.literal('')),
    // МОЛ (Legal representative) - required for invoices
    mol: z.string().min(3, t('company.molRequired')),
    // Bank details for invoices
    bankName: z.string().min(2, t('company.bankNameRequired')),
    iban: z.string().min(15, t('company.ibanRequired')),
    bic: z.string().min(8, t('company.bicRequired')),
    logo: z.instanceof(File).optional(),
  })

export type CompanyFormData = z.infer<ReturnType<typeof createCompanyFormSchema>>

interface CompanyFormProps {
  company?: Company | null
  onSubmit: (data: CompanyFormData, logoUrl: string | null) => Promise<void>
  isLoading?: boolean
  showLogoUpload?: boolean
  mode?: 'onboarding' | 'edit'
  /**
   * Optional HTML id for the underlying <form> element.
   * Useful when controlling submission from an external sticky action bar.
   */
  formId?: string
  /**
   * When false, the internal submit button is hidden.
   * This allows the parent to render a custom sticky Save Changes bar.
   */
  showSubmitButton?: boolean
  /**
   * Optional callback to expose form state (dirty/valid/submitting) to parent components.
   */
  onFormStateChange?: (state: { isDirty: boolean; isValid: boolean; isSubmitting: boolean }) => void
}

export function CompanyForm({
  company,
  onSubmit,
  isLoading = false,
  showLogoUpload = true,
  mode = 'edit',
  formId,
  showSubmitButton = true,
  onFormStateChange,
}: CompanyFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>(
    company?.logo_url || ''
  )
  const [isDragging, setIsDragging] = useState(false)

  const companyFormSchema = createCompanyFormSchema(t)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid, isSubmitting },
    setValue,
    reset,
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    mode: 'onChange',
    defaultValues: company
      ? {
          companyName: company.name,
          eikBulstat: company.eik_bulstat || '',
          vatNumber: company.vat_number || '',
          phone: company.phone || '',
          city: company.city || '',
          address: company.address || '',
          website: company.website || '',
          mol: company.mol || '',
          bankName: company.bank_name || '',
          iban: company.iban || '',
          bic: company.bic || '',
        }
      : undefined,
  })

  // Expose form state to parent when requested (used for sticky Save Changes button)
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({ isDirty, isValid, isSubmitting })
    }
  }, [isDirty, isValid, isSubmitting, onFormStateChange])

  // Update form when company changes
  useEffect(() => {
    if (company) {
      reset({
        companyName: company.name,
        eikBulstat: company.eik_bulstat || '',
        vatNumber: company.vat_number || '',
        phone: company.phone || '',
        city: company.city || '',
        address: company.address || '',
        website: company.website || '',
        mol: company.mol || '',
        bankName: company.bank_name || '',
        iban: company.iban || '',
        bic: company.bic || '',
      })
      setLogoPreview(company.logo_url || '')
    }
  }, [company, reset])

  const handleLogoChange = useCallback(
    (file: File) => {
      if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({
            title: t('company.invalidFileType'),
            description: t('company.pleaseUploadImage'),
            variant: 'destructive',
          })
          return
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: t('company.fileTooLarge'),
            description: t('company.pleaseUploadSmaller'),
            variant: 'destructive',
          })
          return
        }

        setLogoFile(file)
        setValue('logo', file)
        const reader = new FileReader()
        reader.onloadend = () => {
          setLogoPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      }
    },
    [setValue, toast, t]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleLogoChange(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      handleLogoChange(file)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview('')
    setValue('logo', undefined)
  }

  const onFormSubmit = async (data: CompanyFormData) => {
    if (!user) {
      toast({
        title: t('company.error'),
        description: t('company.mustBeLoggedIn'),
        variant: 'destructive',
      })
      return
    }

    let logoUrl = logoPreview && !logoFile ? logoPreview : null

    // Upload logo if a new file was selected
    if (logoFile) {
      try {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName)

        logoUrl = publicUrl
      } catch (error: unknown) {
        toast({
          title: t('company.logoUploadFailed'),
          description:
            error instanceof Error ? error.message : t('company.failedToUploadLogo'),
          variant: 'destructive',
        })
        return
      }
    }

    await onSubmit(data, logoUrl)
  }

  return (
    <form id={formId} onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-base">
            {t('company.companyName')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="companyName"
            placeholder={t('company.companyNamePlaceholder')}
            className="h-12"
            {...register('companyName')}
          />
          {errors.companyName && (
            <p className="text-sm text-destructive">
              {errors.companyName.message}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
          <Label htmlFor="eikBulstat" className="text-base flex items-center gap-2">
            <span>
              {t('company.eikBulstat')} <span className="text-destructive">*</span>
            </span>
            <Tooltip content={t('company.eikTooltip')}>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground/80 bg-background/80 hover:bg-muted/60"
              >
                <Info className="w-3 h-3" />
              </button>
            </Tooltip>
          </Label>
            <Input
              id="eikBulstat"
              placeholder={t('company.eikBulstatPlaceholder')}
              className="h-12"
              {...register('eikBulstat')}
            />
            {errors.eikBulstat && (
              <p className="text-sm text-destructive">
                {errors.eikBulstat.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
          <Label htmlFor="vatNumber" className="text-base flex items-center gap-2">
            <span>
              {t('company.vatNumber')} <span className="text-destructive">*</span>
            </span>
            <Tooltip content={t('company.vatTooltip')}>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground/80 bg-background/80 hover:bg-muted/60"
              >
                <Info className="w-3 h-3" />
              </button>
            </Tooltip>
          </Label>
            <Input
              id="vatNumber"
              placeholder={t('company.vatNumberPlaceholder')}
              className="h-12"
              {...register('vatNumber')}
            />
            {errors.vatNumber && (
              <p className="text-sm text-destructive">
                {errors.vatNumber.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4" />
            {t('company.companyPhone')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder={t('company.companyPhonePlaceholder')}
            className="h-12"
            {...register('phone')}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="city" className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {t('company.city')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="city"
            placeholder={t('company.cityPlaceholder')}
            className="h-12"
            {...register('city')}
          />
          {errors.city && (
            <p className="text-sm text-destructive">{errors.city.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {t('company.fullCompanyAddress')} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="address"
            placeholder={t('company.addressPlaceholder')}
            className="min-h-[100px] resize-none"
            {...register('address')}
          />
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="website" className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t('company.companyWebsite')}{' '}
            <span className="text-muted-foreground text-sm">{t('company.websiteOptional')}</span>
          </Label>
          <Input
            id="website"
            type="url"
            placeholder={t('company.websitePlaceholder')}
            className="h-12"
            {...register('website')}
          />
          {errors.website && (
            <p className="text-sm text-destructive">{errors.website.message}</p>
          )}
        </div>

        {/* МОЛ (Legal Representative) */}
        <div className="space-y-2">
          <Label htmlFor="mol" className="text-base flex items-center gap-2">
            <span>
              {t('company.mol')} <span className="text-destructive">*</span>
            </span>
            <Tooltip content={t('company.molTooltip')}>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground/80 bg-background/80 hover:bg-muted/60"
              >
                <Info className="w-3 h-3" />
              </button>
            </Tooltip>
          </Label>
          <Input
            id="mol"
            placeholder={t('company.molPlaceholder')}
            className="h-12"
            {...register('mol')}
          />
          {errors.mol && (
            <p className="text-sm text-destructive">{errors.mol.message}</p>
          )}
        </div>

        {/* Bank Details Section */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {t('company.bankDetailsTitle')}
            <Tooltip content={t('company.bankDetailsTooltip')}>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground/80 bg-background/80 hover:bg-muted/60"
              >
                <Info className="w-3 h-3" />
              </button>
            </Tooltip>
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bankName" className="text-base">
                {t('company.bankName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bankName"
                placeholder={t('company.bankNamePlaceholder')}
                className="h-12"
                {...register('bankName')}
              />
              {errors.bankName && (
                <p className="text-sm text-destructive">{errors.bankName.message}</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="iban" className="text-base">
                  IBAN <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="iban"
                  placeholder={t('company.ibanPlaceholder')}
                  className="h-12 font-mono"
                  {...register('iban')}
                />
                {errors.iban && (
                  <p className="text-sm text-destructive">{errors.iban.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bic" className="text-base">
                  BIC / SWIFT <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bic"
                  placeholder={t('company.bicPlaceholder')}
                  className="h-12 font-mono"
                  {...register('bic')}
                />
                {errors.bic && (
                  <p className="text-sm text-destructive">{errors.bic.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {showLogoUpload && (
          <div className="space-y-2">
            <Label className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {t('company.companyLogo')}{' '}
              <span className="text-muted-foreground text-sm">{t('company.logoOptional')}</span>
            </Label>
            <div
              className={cn(
                'relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-all duration-200',
                isDragging
                  ? 'border-primary bg-primary/5 scale-[1.02]'
                  : 'border-muted-foreground/30 hover:border-primary/50',
                logoPreview && 'border-primary/50 bg-primary/5'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {logoPreview ? (
                <div className="space-y-4 w-full">
                  <div className="flex justify-center">
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt={t('company.logoPreview')}
                        className="w-48 h-48 object-contain rounded-lg glass-card p-4"
                      />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('logo-input')?.click()}
                      className="w-full sm:w-auto"
                    >
                      {t('company.changeLogo')}
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer text-center w-full">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full glass bg-primary/10">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-semibold mb-1">
                        {isDragging
                          ? t('company.dropLogoHere')
                          : t('company.clickToUpload')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('company.logoFormats')}
                      </p>
                    </div>
                  </div>
                  <input
                    id="logo-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {showSubmitButton && (
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            size="lg"
            disabled={isLoading || isSubmitting}
            className="min-w-[140px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'onboarding' ? t('company.processing') : t('company.saving')}
              </>
            ) : mode === 'onboarding' ? (
              <>
                {t('company.continue')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            ) : (
              t('company.saveChanges')
            )}
          </Button>
        </div>
      )}
    </form>
  )
}

