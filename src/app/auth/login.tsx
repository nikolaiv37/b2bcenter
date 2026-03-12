import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { AlertTriangle, Loader2, Package } from 'lucide-react'
import { useAppContext } from '@/lib/app/AppContext'

export function LoginPage() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { workspaceName } = useAppContext()

  const loginSchema = z.object({
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(6, t('auth.passwordMinLength')),
  })

  type LoginFormData = z.infer<typeof loginSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // After login, go to redirect param (e.g. accept-invite) or dashboard
  const redirectParam = searchParams.get('redirect')
  const postLoginPath =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/dashboard'

  // Pick up ?reason=no-membership from auto-signout redirect, then clean the URL
  useEffect(() => {
    const reason = searchParams.get('reason')
    if (reason === 'no-membership') {
      setAccessDeniedMsg(
        "This account isn't allowed in this portal. Please sign in with a different account."
      )
      searchParams.delete('reason')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check for email verification confirmation
  useEffect(() => {
    const verified = searchParams.get('verified')
    if (verified === 'true') {
      // Show success toast
      toast({
        title: t('auth.emailConfirmed'),
        description: t('auth.emailVerified'),
      })
      // Remove the query param from URL
      searchParams.delete('verified')
      setSearchParams(searchParams, { replace: true })
    }

    // Also check for Supabase auth hash in URL (from email confirmation)
    const hash = window.location.hash
    if (hash.includes('access_token') || hash.includes('type=recovery')) {
      // Supabase will automatically handle this with detectSessionInUrl: true
      // But we'll also show a toast if the session is successfully created
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          toast({
            title: t('auth.emailConfirmed'),
            description: t('auth.redirecting'),
          })
          // Clean the hash from URL
          window.history.replaceState({}, '', window.location.pathname)
          // Redirect to dashboard
          setTimeout(() => {
            navigate(postLoginPath)
          }, 1000)
        }
      })
    }
  }, [searchParams, setSearchParams, navigate, toast, postLoginPath, t])

  const onSubmit = async (data: LoginFormData) => {
    // Clear previous inline errors on new submit
    setLoginError(null)
    setAccessDeniedMsg(null)
    setIsLoading(true)

    try {
      const signInResult = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      const { error } = signInResult

      if (error) {
        // Show user-friendly inline error instead of a toast
        if (error.message?.includes('Email not confirmed') || error.message?.includes('email_not_confirmed')) {
          setLoginError(t('auth.checkEmailConfirm'))
        } else if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid_credentials')) {
          setLoginError(t('auth.invalidCredentials'))
        } else {
          setLoginError(error.message || t('auth.invalidEmailPassword'))
        }
        return
      }

      // Login succeeded — redirect immediately.
      // Membership is checked by MembershipGuard after the
      // redirect, using TenantProvider's refresh (which fires on the
      // onAuthStateChange event). This avoids a duplicate membership query
      // that can race with session propagation and intermittently fail.
      toast({
        title: t('auth.welcomeBack'),
        description: t('auth.successfullyLoggedIn'),
      })
      window.location.href = postLoginPath
    } catch (error: unknown) {
      setLoginError(error instanceof Error ? error.message : t('auth.unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('auth.tryAgainLater')
      toast({
        title: t('auth.failedToSendResetEmail'),
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsResettingPassword(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <GlassCard>
          <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Package className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {workspaceName ? `${t('auth.welcomeBack')} • ${workspaceName}` : t('auth.welcomeToFurniTrade')}
          </h1>
          <p className="text-muted-foreground">
            {t('auth.signInToAccount')}
          </p>
        </div>

        {accessDeniedMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 mb-4 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{accessDeniedMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              {...register('email', { onChange: () => setLoginError(null) })}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

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
              {...register('password', { onChange: () => setLoginError(null) })}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
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
        </form>
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              {t('auth.dontHaveAccount')}{' '}
              <Link
                to="/auth/signup"
                className="text-primary font-semibold hover:underline"
              >
                {t('auth.signUp')}
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
