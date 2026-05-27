import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  AlertTriangle,
  Loader2,
  Package,
  BookOpen,
  ClipboardList,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { useAppContext } from '@/lib/app/AppContext'

const SHOWROOM_IMAGE =
  'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=1600&q=80'

export function LoginPage() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
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
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const redirectParam = searchParams.get('redirect')
  const postLoginPath =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/dashboard'

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

  useEffect(() => {
    const verified = searchParams.get('verified')
    if (verified === 'true') {
      toast({
        title: t('auth.emailConfirmed'),
        description: t('auth.emailVerified'),
      })
      searchParams.delete('verified')
      setSearchParams(searchParams, { replace: true })
    }

    const hash = window.location.hash
    if (hash.includes('access_token') || hash.includes('type=recovery')) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          toast({
            title: t('auth.emailConfirmed'),
            description: t('auth.redirecting'),
          })
          window.history.replaceState({}, '', window.location.pathname)
          setTimeout(() => {
            navigate(postLoginPath)
          }, 1000)
        }
      })
    }
  }, [searchParams, setSearchParams, navigate, toast, postLoginPath, t])

  const onSubmit = async (data: LoginFormData) => {
    setLoginError(null)
    setAccessDeniedMsg(null)
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        if (error.message?.includes('Email not confirmed') || error.message?.includes('email_not_confirmed')) {
          setLoginError(t('auth.checkEmailConfirm'))
        } else if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid_credentials')) {
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
      window.location.href = postLoginPath
    } catch (error: unknown) {
      setLoginError(error instanceof Error ? error.message : t('auth.unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

  const valueBullets = [
    { icon: BookOpen, label: t('auth.value.catalog') },
    { icon: ClipboardList, label: t('auth.value.orders') },
    { icon: Users, label: t('auth.value.clients') },
    { icon: ShieldCheck, label: t('auth.value.portal') },
  ]

  return (
    <div className="min-h-screen w-full bg-slate-50 lg:grid lg:grid-cols-2">
      {/* Left: brand / visual panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-slate-900 text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${SHOWROOM_IMAGE})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/80 to-slate-900/40"
        />

        <div className="relative z-10 p-10 xl:p-14 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
            <Package className="w-5 h-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">B2BCenter</span>
        </div>

        <div className="relative z-10 p-10 xl:p-14 max-w-xl">
          <h2 className="text-3xl xl:text-4xl font-semibold leading-tight tracking-tight">
            {t('auth.brand.headline')}
          </h2>
          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            {t('auth.brand.subheadline')}
          </p>

          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4">
            {valueBullets.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex items-center justify-center w-8 h-8 rounded-md bg-white/10 border border-white/10">
                  <Icon className="w-4 h-4" />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 p-10 xl:p-14 text-xs text-slate-400">
          © {new Date().getFullYear()} B2BCenter · Centivon
        </div>
      </aside>

      {/* Right: login form */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900 text-white">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">B2BCenter</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm">
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                {t('auth.loginHeading')}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {workspaceName
                  ? `${t('auth.loginSubheading')} · ${workspaceName}`
                  : t('auth.loginSubheading')}
              </p>
            </div>

            {accessDeniedMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 mb-5 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{accessDeniedMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">
                  {t('auth.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  className="h-11"
                  {...register('email', { onChange: () => setLoginError(null) })}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">
                  {t('auth.password')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11"
                  {...register('password', { onChange: () => setLoginError(null) })}
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

              <Button
                type="submit"
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('auth.signIn')}
              </Button>
            </form>

            <p className="mt-8 text-center text-xs text-slate-400">
              {t('auth.accessNote')}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
