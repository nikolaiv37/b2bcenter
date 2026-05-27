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
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.1fr_1fr]">
      {/* Left: brand / visual panel */}
      <aside className="relative hidden lg:flex flex-col overflow-hidden bg-slate-900 text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: `url(${SHOWROOM_IMAGE})` }}
        />
        {/* Layered overlays: keeps image visible but text readable */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-900/65 to-slate-900/30"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"
        />

        <div className="relative z-10 flex flex-col h-full px-12 xl:px-16 py-12 xl:py-14">
          {/* Top: brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm border border-white/15">
              <Package className="w-4.5 h-4.5" strokeWidth={2.25} />
            </div>
            <span className="text-base font-semibold tracking-tight">B2BCenter</span>
          </div>

          {/* Middle: headline + bullets, vertically anchored */}
          <div className="mt-auto mb-auto pt-16">
            <div className="max-w-[28rem]">
              <h2 className="text-[2rem] xl:text-[2.375rem] font-semibold leading-[1.15] tracking-tight">
                {t('auth.brand.headline')}
              </h2>
              <p className="mt-5 text-[15px] text-slate-300/90 leading-relaxed max-w-md">
                {t('auth.brand.subheadline')}
              </p>
            </div>

            <ul className="mt-12 grid grid-cols-2 gap-x-8 gap-y-5 max-w-md">
              {valueBullets.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-[13.5px] text-slate-200/95">
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.07] border border-white/10">
                    <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                  <span className="leading-snug">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom: footer brand */}
          <div className="flex items-center justify-between text-[11px] text-slate-400/80 tracking-wide">
            <span>© {new Date().getFullYear()} B2BCenter</span>
            <span className="uppercase">Powered by Centivon</span>
          </div>
        </div>
      </aside>

      {/* Right: login form */}
      <main
        className="relative flex items-center justify-center overflow-hidden px-6 py-12 sm:px-10 bg-slate-50"
        style={{
          backgroundImage:
            'radial-gradient(1200px 600px at 100% 0%, rgba(15,23,42,0.05), transparent 60%), radial-gradient(900px 500px at 0% 100%, rgba(15,23,42,0.04), transparent 60%)',
        }}
      >
        {/* Decorative depth — hidden on small screens, purely cosmetic */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
          {/* Soft blurred slate glow behind the card */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-slate-200/50 blur-3xl" />
          {/* Faint grid pattern, very low opacity */}
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage:
                'radial-gradient(ellipse 60% 55% at 50% 50%, black 35%, transparent 75%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 60% 55% at 50% 50%, black 35%, transparent 75%)',
            }}
          />
          {/* Offset outlined rectangle echoing the card, for subtle depth */}
          <div className="absolute left-1/2 top-1/2 -translate-x-[calc(50%-14px)] -translate-y-[calc(50%-14px)] w-[420px] h-[360px] rounded-2xl border border-slate-200/70" />
        </div>

        <div className="relative w-full max-w-[420px]">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 text-white">
              <Package className="w-4.5 h-4.5" strokeWidth={2.25} />
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-900">B2BCenter</span>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white px-7 py-9 sm:px-9 sm:py-10 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.12)]">
            <div className="mb-7">
              <h1 className="text-[1.625rem] sm:text-[1.75rem] font-semibold tracking-tight text-slate-900 leading-tight">
                {t('auth.loginHeading')}
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
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

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] font-medium text-slate-700">
                  {t('auth.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  className="h-11 bg-white border-slate-200 focus-visible:ring-slate-900/10 focus-visible:border-slate-400"
                  {...register('email', { onChange: () => setLoginError(null) })}
                />
                {errors.email && (
                  <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px] font-medium text-slate-700">
                  {t('auth.password')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11 bg-white border-slate-200 focus-visible:ring-slate-900/10 focus-visible:border-slate-400"
                  {...register('password', { onChange: () => setLoginError(null) })}
                />
                {errors.password && (
                  <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
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
                className="w-full h-11 mt-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-[14px] font-medium tracking-tight shadow-sm transition-colors"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('auth.signIn')}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-[12px] text-slate-400">
            {t('auth.accessNote')}
          </p>
        </div>
      </main>
    </div>
  )
}
