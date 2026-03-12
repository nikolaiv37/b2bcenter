import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase/client'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { sendNotification } from '@/lib/notifications'
import { Loader2, CheckCircle2, AlertCircle, Lock, Building2, Phone, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

type SetupState = 'loading' | 'form' | 'submitting' | 'success' | 'error'

/**
 * Client Setup page — lightweight one-step onboarding for invited clients.
 *
 * URL: /auth/client-setup?invite=INVITATION_ID&tenant=SLUG
 *
 * This page is only for invited client users (role = member/client).
 * It does NOT modify the admin onboarding flow.
 */
export function ClientSetupPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  const { toast } = useToast()

  const inviteId = searchParams.get('invite')
  const initRef = useRef(false)

  const [state, setState] = useState<SetupState>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  // Form fields
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Validation
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      // Validate invite param is present
      if (!inviteId) {
        setState('error')
        setErrorMessage(t('clientSetup.errorNoInvite'))
        return
      }

      // Wait briefly for session to be ready (user just came from magic link)
      await new Promise((r) => setTimeout(r, 500))

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState('error')
        setErrorMessage(t('clientSetup.errorNoSession'))
        return
      }

      // Load the user's profile to prefill company name
      try {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('company_name, phone')
          .eq('id', session.user.id)
          .limit(1)

        const profile = profileRows?.[0]
        if (profile) {
          setCompanyName(profile.company_name || '')
          setPhone(profile.phone || '')
        }
      } catch (err) {
        console.warn('Failed to load profile for prefill:', err)
        // Non-fatal — user can still fill in manually
      }

      setState('form')
    }

    init()
  }, [inviteId, t])

  const validateForm = (): boolean => {
    setPasswordError('')

    if (password.length < 6) {
      setPasswordError(t('clientSetup.passwordMinLength'))
      return false
    }

    if (password !== confirmPassword) {
      setPasswordError(t('clientSetup.passwordMismatch'))
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setState('submitting')

    try {
      // 1. Set the user's password
      const { error: pwError } = await supabase.auth.updateUser({ password })
      if (pwError) {
        console.error('Password update error:', pwError)
        toast({
          title: t('general.error'),
          description: t('clientSetup.errorPasswordUpdate'),
          variant: 'destructive',
        })
        setState('form')
        return
      }

      // 2. Update profile with company name, phone, address
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const updates: Record<string, string | null> = {
          // Mark active only after client completes setup
          invitation_status: 'active',
        }
        if (companyName.trim()) updates.company_name = companyName.trim()
        if (phone.trim()) updates.phone = phone.trim()
        if (address.trim()) updates.address = address.trim()

        const { error: profileError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)

        if (profileError) {
          console.warn('Profile update error (non-fatal):', profileError)
          // Non-fatal — password is already set, they can update profile later
        }
      }

      // 3. Notify admins that a new client joined
      sendNotification({
        type: 'client_registered',
        metadata: {
          company_name: companyName.trim() || 'New Client',
        },
        targetAudience: 'admins',
      })

      // 4. Show success and redirect
      setState('success')

      // Redirect to dashboard after a brief success message
      setTimeout(() => {
        const dashboardPath = withBase('/dashboard')
        window.location.href = dashboardPath
      }, 1500)
    } catch (err) {
      console.error('Client setup error:', err)
      toast({
        title: t('general.error'),
        description: t('clientSetup.errorUpdateFailed'),
        variant: 'destructive',
      })
      setState('form')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-sky-950 p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Loading */}
          {state === 'loading' && (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-sky-500/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
              </div>
              <h2 className="text-lg font-semibold">Loading your account...</h2>
              <p className="text-sm text-muted-foreground">Please wait a moment.</p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="text-center space-y-5">
              <div className="h-16 w-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
                  Something went wrong
                </h2>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Go Home
              </Button>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div className="text-center space-y-5">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                  {t('clientSetup.successTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">{t('clientSetup.successDesc')}</p>
              </div>
              <Loader2 className="w-5 h-5 mx-auto text-muted-foreground animate-spin" />
            </div>
          )}

          {/* Form */}
          {(state === 'form' || state === 'submitting') && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="h-14 w-14 mx-auto rounded-full bg-sky-500/10 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-sky-600 dark:text-sky-400" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {t('clientSetup.title')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('clientSetup.subtitle')}
                </p>
              </div>

              {/* Password */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    {t('clientSetup.passwordLabel')}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setPasswordError('')
                    }}
                    placeholder={t('clientSetup.passwordPlaceholder')}
                    required
                    minLength={6}
                    disabled={state === 'submitting'}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    {t('clientSetup.confirmPasswordLabel')}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setPasswordError('')
                    }}
                    placeholder={t('clientSetup.confirmPasswordPlaceholder')}
                    required
                    minLength={6}
                    disabled={state === 'submitting'}
                    autoComplete="new-password"
                  />
                  {passwordError && (
                    <p className="text-sm text-red-500">{passwordError}</p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border/50" />

              {/* Company details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    {t('clientSetup.companyNameLabel')}
                  </Label>
                  <Input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t('clientSetup.companyNamePlaceholder')}
                    disabled={state === 'submitting'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    {t('clientSetup.phoneLabel')}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('clientSetup.phonePlaceholder')}
                    disabled={state === 'submitting'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    {t('clientSetup.addressLabel')}
                  </Label>
                  <Input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('clientSetup.addressPlaceholder')}
                    disabled={state === 'submitting'}
                  />
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={state === 'submitting'}
                className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white"
              >
                {state === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('clientSetup.submitting')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('clientSetup.submitButton')}
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
