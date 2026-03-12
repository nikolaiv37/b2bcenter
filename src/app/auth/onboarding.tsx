import { useState, useEffect } from 'react'
import { useAppContext } from '@/lib/app/AppContext'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { CompanyForm, CompanyFormData } from '@/components/CompanyForm'
import {
  Building2,
  CheckCircle2,
  ArrowLeft,
  FileText,
  Sparkles,
  Loader2,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TOTAL_STEPS = 2

export function OnboardingPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<CompanyFormData | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  const { user, profile, isLoading: authLoading, signOut } = useAuth()
  const { workspaceId: tenantId } = useAppContext()
  const { withBase } = useTenantPath()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const onboardingReason = searchParams.get('reason')

  const onboardingReasonMessage =
    onboardingReason === 'missing-company-link'
      ? 'This account is missing a linked company profile for this tenant.'
      : onboardingReason === 'missing-company-record'
        ? 'This account links to a company record that was not found in this tenant.'
        : onboardingReason === 'company-onboarding-incomplete'
          ? 'Tenant company onboarding is not completed yet.'
          : null

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(withBase('/auth/login'), { replace: true })
    }
  }, [user, authLoading, navigate, withBase])

  // Show loading while checking auth
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const handleSwitchAccount = async () => {
    await signOut('/auth/login')
  }

  const nextStep = () => {
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS))
  }

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleStep1Submit = async (data: CompanyFormData, uploadedLogoUrl: string | null) => {
    setFormData(data)
    setLogoUrl(uploadedLogoUrl)
    nextStep()
  }

  const handleFinalSubmit = async () => {
    if (!formData || !user) {
      toast({
        title: t('general.error'),
        description: t('auth.onboarding.completeRequiredFields'),
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const slug = slugify(formData.companyName)

      // Create or update company
      if (!tenantId) {
        throw new Error('Missing tenant context')
      }

      const companyData = {
        tenant_id: tenantId,
        name: formData.companyName,
        slug,
        logo_url: logoUrl,
        eik_bulstat: formData.eikBulstat,
        vat_number: formData.vatNumber,
        phone: formData.phone,
        city: formData.city,
        address: formData.address,
        website: formData.website || null,
        // Invoice-related fields
        mol: formData.mol,
        bank_name: formData.bankName,
        iban: formData.iban,
        bic: formData.bic,
        onboarding_completed: true,
      }

      // Check if company already exists (for editing scenario)
      let company
      
      if (profile?.company_id) {
        // User already has a company_id - always try to UPDATE, never create new
        // First verify the company exists
        const { data: existingCompany, error: checkError } = await supabase
          .from('companies')
          .select('id')
          .eq('id', profile.company_id)
          .eq('tenant_id', tenantId)
          .single()

        if (checkError || !existingCompany) {
          // Company doesn't exist or can't be accessed - clear the company_id and create new
          console.warn('Company not found or inaccessible, clearing company_id and creating new company')
          await supabase
            .from('profiles')
            .update({ company_id: null, tenant_id: tenantId })
            .eq('id', user.id)
          
          // Fall through to create new company
          // (company will be null, so we'll create new below)
        } else {
          // Company exists - try to update
          const { data: updatedCompany, error: updateError } = await supabase
            .from('companies')
            .update(companyData)
            .eq('id', profile.company_id)
            .eq('tenant_id', tenantId)
            .select()
            .single()

          if (updateError) {
            // If update fails due to RLS, try to understand why
            console.error('Update error details:', updateError)
            throw new Error(
              `Failed to update company: ${updateError.message}. ` +
              `Please ensure you have permission to update your company. ` +
              `If this persists, contact support.`
            )
          }
          
          if (!updatedCompany) {
            throw new Error('Update succeeded but no company data returned. This may be an RLS policy issue.')
          }
          
          company = updatedCompany
        }
      }

      // Create new company if we don't have one yet
      if (!company) {
        // User doesn't have a company_id - create new company
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert(companyData)
          .select()
          .single()

        if (companyError) throw companyError
        company = newCompany

        // Update profile to link to company
        // Only update role if it's null/undefined (first user becomes admin/owner)
        // If role is already set (e.g., 'company'), preserve it
        const profileUpdate: { company_id: string; role?: string; tenant_id: string } = {
          company_id: company.id,
          tenant_id: tenantId,
        }

        // Only set role to 'admin' if it's null/undefined (this is the owner)
        // If role is already 'company' or 'admin', don't change it
        if (!profile?.role || profile.role === null) {
          profileUpdate.role = 'admin'
        }
        // Otherwise, keep the existing role (e.g., 'company')

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', user.id)
          .eq('tenant_id', tenantId)

        if (profileError) throw profileError
      }

      toast({
        title: t('auth.onboarding.welcomeTitle'),
        description: t('auth.onboarding.welcomeDescription'),
      })

      // Refresh auth state to get updated company
      const postOnboardingPath = withBase('/dashboard')
      window.location.href = postOnboardingPath
    } catch (error: unknown) {
      console.error('Onboarding error:', error)
      const errorMessage =
        error instanceof Error ? error.message : t('auth.onboarding.failedDescription')
      toast({
        title: t('auth.onboarding.failedTitle'),
        description: errorMessage || t('auth.onboarding.failedDescription'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const progress = (step / TOTAL_STEPS) * 100
  const slug = formData?.companyName ? slugify(formData.companyName) : ''

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-3xl">
        {/* Header with progress */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full glass-card mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('auth.onboarding.title')}
          </h1>
          <p className="text-muted-foreground mb-6">
            {t('auth.onboarding.stepDescription', { step, total: TOTAL_STEPS })}
          </p>
          <div className="max-w-md mx-auto">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span className={cn(step >= 1 && 'text-primary font-medium')}>
                {t('auth.onboarding.companyInfoShort')}
              </span>
              <span className={cn(step >= 2 && 'text-primary font-medium')}>
                {t('auth.onboarding.reviewShort')}
              </span>
            </div>
          </div>
        </div>

        {onboardingReasonMessage && (
          <GlassCard className="p-4 mb-4">
            <div className="text-sm text-left">
              <p className="font-medium mb-1">Why you are seeing onboarding</p>
              <p className="text-muted-foreground">{onboardingReasonMessage}</p>
              <p className="text-muted-foreground mt-1">
                Signed in as: <span className="font-medium text-foreground">{user.email}</span>
              </p>
              <div className="mt-3">
                <Button type="button" variant="outline" onClick={handleSwitchAccount}>
                  Switch account
                </Button>
              </div>
            </div>
          </GlassCard>
        )}

        <GlassCard className="p-8 md:p-12">
          {/* Step 1: Company Information */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg glass bg-primary/10">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">{t('auth.onboarding.companyInfoTitle')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t('auth.onboarding.companyInfoSubtitle')}
                  </p>
                </div>
              </div>

              <CompanyForm
                company={null}
                onSubmit={handleStep1Submit}
                isLoading={false}
                showLogoUpload={true}
                mode="onboarding"
              />
            </div>
          )}

          {/* Step 2: Review & Confirm */}
          {step === 2 && formData && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg glass bg-primary/10">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">{t('auth.onboarding.reviewTitle')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t('auth.onboarding.reviewSubtitle')}
                  </p>
                </div>
              </div>

              <div className="glass-card p-6 space-y-6">
                {logoUrl && (
                  <div className="flex justify-center pb-4 border-b">
                    <img
                      src={logoUrl}
                      alt={t('auth.onboarding.companyLogoAlt')}
                      className="w-32 h-32 object-contain rounded-lg"
                    />
                  </div>
                )}

                <div className="grid gap-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">{t('auth.onboarding.companyName')}</p>
                      <p className="font-semibold">{formData.companyName}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">{t('auth.onboarding.catalogUrl')}</p>
                      <p className="font-mono text-sm text-primary">/catalog/{slug}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t('auth.onboarding.eikBulstat')}</p>
                      <p className="font-semibold">{formData.eikBulstat}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t('auth.onboarding.vatNumber')}</p>
                      <p className="font-semibold">{formData.vatNumber}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('general.phone')}</p>
                    <p className="font-semibold">{formData.phone}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('general.address')}</p>
                    <p className="font-semibold whitespace-pre-line">{formData.address}</p>
                  </div>

                  {formData.website && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t('general.website')}</p>
                      <a
                        href={formData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        {formData.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  size="lg"
                  className="flex-1"
                  disabled={isLoading}
                >
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  {t('general.back')}
                </Button>
                <Button
                  type="button"
                  onClick={handleFinalSubmit}
                  size="lg"
                  className="flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.onboarding.settingUp')}
                    </>
                  ) : (
                    <>
                      {t('auth.onboarding.completeSetup')}
                      <CheckCircle2 className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
