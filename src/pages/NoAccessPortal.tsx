import { useState } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { Lock, LogOut, Loader2 } from 'lucide-react'

export function NoAccessPortal() {
  const { user, signOut } = useAuth()
  const { tenant } = useTenant()
  const [signingOut, setSigningOut] = useState(false)

  const handleSwitchAccount = async () => {
    setSigningOut(true)
    await signOut()
    // signOut performs window.location.replace → full reload to login
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassCard className="max-w-md w-full text-center">
        <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">No access to this portal</h1>
        <p className="text-muted-foreground">
          {user?.email ? (
            <>
              <span className="font-medium text-foreground">{user.email}</span>{' '}
              is not a member of{' '}
              <span className="font-medium text-foreground">{tenant?.name ?? 'this tenant'}</span>.
            </>
          ) : (
            'Your account is not a member of this tenant.'
          )}
          {' '}Contact your administrator to request access, or sign in with a different account.
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={handleSwitchAccount} disabled={signingOut}>
            {signingOut ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 mr-2" />
            )}
            Switch account
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
