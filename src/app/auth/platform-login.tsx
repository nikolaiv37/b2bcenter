import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase/client'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { AlertTriangle, Building2, Loader2, Package } from 'lucide-react'
import { SLUG_PREFIX } from '@/lib/tenant/constants'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DiscoveredTenant {
  slug: string
  name: string
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Platform-only login page (centivon.vercel.app / platform.centivon.local).
 *
 * Flow:
 *  1. User enters work email → lookup_tenant_by_email RPC
 *  2. If tenant found → show "Workspace: {name}"
 *  3. If tenant not found → allow password for potential platform admins
 *  4. User signs in:
 *     - tenant user -> /t/:slug/dashboard
 *     - platform admin without tenant -> /platform/tenants
 *
 * This component is NEVER rendered on tenant custom domains.
 */
export function PlatformLoginPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState<'email' | 'password'>('email')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [discoveredTenant, setDiscoveredTenant] = useState<DiscoveredTenant | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupInfo, setLookupInfo] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const fullSchema = z.object({
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(6, t('auth.passwordMinLength')),
  })

  type FullFormData = z.infer<typeof fullSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    trigger,
  } = useForm<FullFormData>({
    resolver: zodResolver(fullSchema),
  })

  // Pick up ?reason=no-membership from auto-signout redirect
  useEffect(() => {
    const reason = searchParams.get('reason')
    if (reason === 'no-membership') {
      setAccessDeniedMsg(
        "This account isn't linked to any workspace. Please try a different email."
      )
      searchParams.delete('reason')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Step 1 → Step 2: Look up tenant by email ──

  const handleEmailContinue = async () => {
    const valid = await trigger('email')
    if (!valid) return

    const email = getValues('email')
    setLookupError(null)
    setLookupInfo(null)
    setAccessDeniedMsg(null)
    setDiscoveredTenant(null)
    setIsLookingUp(true)

    try {
      const lookupResult = await supabase.rpc('lookup_tenant_by_email', {
        lookup_email: email,
      })
      const { data, error } = lookupResult

      if (error) {
        console.error('lookup_tenant_by_email error:', error)
        setLookupError('Something went wrong. Please try again.')
        return
      }

      if (data && typeof data === 'object' && 'slug' in data && 'name' in data) {
        setDiscoveredTenant(data as DiscoveredTenant)
        setStep('password')
        setTimeout(() => passwordRef.current?.focus(), 50)
      } else {
        setLookupInfo('No workspace found. Continue only if you are a platform admin.')
        setStep('password')
        setTimeout(() => passwordRef.current?.focus(), 50)
      }
    } catch {
      setLookupError('Something went wrong. Please try again.')
    } finally {
      setIsLookingUp(false)
    }
  }

  // ── Step 2: Sign in with password, then redirect ──

  const onSubmit = async (data: FullFormData) => {
    setLoginError(null)
    setIsLoading(true)

    try {
      const signInResult = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      const { error } = signInResult

      if (error) {
        if (
          error.message?.includes('Email not confirmed') ||
          error.message?.includes('email_not_confirmed')
        ) {
          setLoginError(t('auth.checkEmailConfirm'))
        } else if (
          error.message?.includes('Invalid login credentials') ||
          error.message?.includes('invalid_credentials')
        ) {
          setLoginError(t('auth.invalidCredentials'))
        } else {
          setLoginError(error.message || t('auth.invalidEmailPassword'))
        }
        return
      }

      toast({
        title: t('auth.welcomeBack'),
        description: t('auth.successfullyLoggedIn'),
      })

      if (discoveredTenant) {
        // Tenant member flow
        window.location.href = `${SLUG_PREFIX}/${discoveredTenant.slug}/dashboard`
        return
      }

      // No workspace discovered by email lookup: allow platform admins.
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setLoginError('Could not verify your account. Please try again.')
        return
      }

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', session.user.id)
        .limit(1)

      if (profileError) {
        setLoginError(profileError.message || 'Failed to verify platform admin access.')
        return
      }

      const isPlatformAdmin = profileRows?.[0]?.is_platform_admin === true
      if (isPlatformAdmin) {
        window.location.href = '/platform/tenants'
        return
      }

      await supabase.auth.signOut({ scope: 'local' })
      setStep('email')
      setLookupInfo(null)
      setDiscoveredTenant(null)
      setLoginError('No workspace found for this account.')
      return
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : t('auth.unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

  // ── Forgot password (reuse existing logic) ──

  const handleForgotPassword = async () => {
    const email = getValues('email')
    if (!email) {
      toast({
        title: t('auth.emailRequired'),
        description: t('auth.enterEmailFirst'),
        variant: 'destructive',
      })
      return
    }

    setIsResettingPassword(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error

      toast({
        title: t('auth.passwordResetEmailSent'),
        description: t('auth.checkEmailResetLink'),
      })
    } catch (err: unknown) {
      toast({
        title: t('auth.failedToSendResetEmail'),
        description: err instanceof Error ? err.message : t('auth.tryAgainLater'),
        variant: 'destructive',
      })
    } finally {
      setIsResettingPassword(false)
    }
  }

  // ── Go back to email step ──

  const handleChangeEmail = () => {
    setStep('email')
    setDiscoveredTenant(null)
    setLoginError(null)
    setLookupError(null)
    setLookupInfo(null)
  }

  // Wire up the password ref alongside react-hook-form
  const { ref: rhfPasswordRef, ...passwordRest } = register('password', {
    onChange: () => setLoginError(null),
  })

  // ── Render ──

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <GlassCard>
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Package className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">{t('auth.welcomeToFurniTrade')}</h1>
            <p className="text-muted-foreground">{t('auth.signInToAccount')}</p>
          </div>

          {accessDeniedMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 mb-4 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{accessDeniedMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* ── Step 1: Work email ── */}
            {step === 'email' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    autoFocus
                    {...register('email', {
                      onChange: () => {
                        setLookupError(null)
                        setLoginError(null)
                      },
                    })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleEmailContinue()
                      }
                    }}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                {lookupError && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{lookupError}</span>
                  </div>
                )}

                {lookupInfo && (
                  <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{lookupInfo}</span>
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full"
                  onClick={handleEmailContinue}
                  disabled={isLookingUp}
                >
                  {isLookingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </>
            )}

            {/* ── Step 2: Workspace confirmed + password ── */}
            {step === 'password' && (
              <>
                {/* Email display with change link */}
                <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
                  <span className="text-sm truncate">{getValues('email')}</span>
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    className="text-sm text-primary hover:underline shrink-0 ml-2"
                  >
                    Change
                  </button>
                </div>

                {/* Workspace badge */}
                {discoveredTenant ? (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">
                      Workspace: {discoveredTenant.name}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>No workspace found for this email. Platform admin accounts can still sign in.</span>
                  </div>
                )}

                {/* Password field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('auth.password')}</Label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isResettingPassword}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      {isResettingPassword ? t('auth.sending') : t('auth.forgotPassword')}
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...passwordRest}
                    ref={(el) => {
                      rhfPasswordRef(el)
                      passwordRef.current = el
                    }}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                {loginError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('auth.signIn')}
                </Button>
              </>
            )}
          </form>
        </GlassCard>
      </div>
    </div>
  )
}
