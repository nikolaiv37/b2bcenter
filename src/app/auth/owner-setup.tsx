import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useTenantPath } from '@/lib/tenant/TenantProvider'
import { Loader2, CheckCircle2, AlertCircle, Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

type SetupState = 'loading' | 'form' | 'submitting' | 'success' | 'error'

/**
 * Owner setup page used after accepting a create-tenant owner invitation.
 * It only sets the password and then forwards to tenant onboarding where
 * company/workspace details are completed.
 */
export function OwnerSetupPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { withBase } = useTenantPath()
  const { toast } = useToast()

  const inviteId = searchParams.get('invite')
  const initRef = useRef(false)

  const [state, setState] = useState<SetupState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      if (!inviteId) {
        setState('error')
        setErrorMessage('Missing invite context. Please use the invitation link again.')
        return
      }

      await new Promise((r) => setTimeout(r, 400))
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setState('error')
        setErrorMessage('Your session is missing or expired. Please open the invitation link again.')
        return
      }

      setState('form')
    }

    init()
  }, [inviteId])

  const validate = () => {
    setPasswordError('')

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return false
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setState('submitting')

    try {
      const { error: updateUserError } = await supabase.auth.updateUser({ password })
      if (updateUserError) {
        throw updateUserError
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Ensure invited owner/admin is marked active before onboarding.
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ invitation_status: 'active' })
          .eq('id', user.id)

        if (profileError) {
          console.warn('Non-fatal profile invitation_status update error:', profileError)
        }
      }

      setState('success')

      setTimeout(() => {
        navigate(withBase('/auth/onboarding'), { replace: true })
      }, 800)
    } catch (err) {
      console.error('Owner setup error:', err)
      toast({
        title: 'Could not complete account setup',
        description: err instanceof Error ? err.message : 'Unexpected error',
        variant: 'destructive',
      })
      setState('form')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-sky-950 p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardContent className="pt-8 pb-8 px-8">
          {state === 'loading' && (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-sky-500/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
              </div>
              <h2 className="text-lg font-semibold">Preparing your workspace owner account...</h2>
              <p className="text-sm text-muted-foreground">Please wait a moment.</p>
            </div>
          )}

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

          {state === 'success' && (
            <div className="text-center space-y-5">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                  Account ready
                </h2>
                <p className="text-sm text-muted-foreground">
                  Redirecting you to workspace onboarding...
                </p>
              </div>
              <Loader2 className="w-5 h-5 mx-auto text-muted-foreground animate-spin" />
            </div>
          )}

          {(state === 'form' || state === 'submitting') && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center space-y-2">
                <div className="h-14 w-14 mx-auto rounded-full bg-sky-500/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-sky-600 dark:text-sky-400" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Set Your Owner Password
                </h2>
                <p className="text-sm text-muted-foreground">
                  Create your password first, then continue to tenant onboarding.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="owner-password" className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    Password
                  </Label>
                  <Input
                    id="owner-password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setPasswordError('')
                    }}
                    placeholder="Choose a strong password"
                    minLength={6}
                    required
                    disabled={state === 'submitting'}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-password-confirm" className="text-sm font-medium">
                    Confirm Password
                  </Label>
                  <Input
                    id="owner-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setPasswordError('')
                    }}
                    placeholder="Re-enter your password"
                    minLength={6}
                    required
                    disabled={state === 'submitting'}
                    autoComplete="new-password"
                  />
                  {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
                </div>
              </div>

              <Button
                type="submit"
                disabled={state === 'submitting'}
                className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white"
              >
                {state === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Continue to Onboarding
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
