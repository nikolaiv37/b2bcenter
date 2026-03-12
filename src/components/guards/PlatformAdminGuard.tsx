import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { Loader2 } from 'lucide-react'

/**
 * Guard for /platform/* routes.
 * Requires:
 *   1. App host (no tenant context)
 *   2. Authenticated user
 *   3. profiles.is_platform_admin = true
 */
export function PlatformAdminGuard({ children }: { children: React.ReactNode }) {
  const { domainKind } = useTenant()
  const location = useLocation()
  const [state, setState] = useState<'loading' | 'authorized' | 'unauthorized'>('loading')

  useEffect(() => {
    let active = true

    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return

      if (!session?.user) {
        setState('unauthorized')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', session.user.id)
        .limit(1)

      if (!active) return

      const isPlatformAdmin = profile?.[0]?.is_platform_admin === true
      setState(isPlatformAdmin ? 'authorized' : 'unauthorized')
    }

    check()
    return () => { active = false }
  }, [])

  if (domainKind === 'tenant') {
    return <Navigate to="/" replace />
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (state === 'unauthorized') {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
