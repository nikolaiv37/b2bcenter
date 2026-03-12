import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { getSlugCandidate } from '@/lib/tenant/resolveTenant'

export function SlugOnlyGuard({ children }: { children: React.ReactNode }) {
  const { source, domainKind, refresh } = useTenant()
  const location = useLocation()
  const [slugChecked, setSlugChecked] = useState(false)
  const slugCandidate = getSlugCandidate(location.pathname)

  useEffect(() => {
    let active = true

    if (slugCandidate && source !== 'slug') {
      setSlugChecked(false)
      refresh().finally(() => {
        if (active) {
          setSlugChecked(true)
        }
      })
    } else {
      setSlugChecked(false)
    }

    return () => {
      active = false
    }
  }, [slugCandidate, source, refresh])

  if (source !== 'slug') {
    if (slugCandidate && !slugChecked) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-6 w-6 border-2 border-[color:var(--ink-12)] border-t-[color:var(--landing-accent)] rounded-full animate-spin" />
        </div>
      )
    }

    if (domainKind === 'tenant') {
      return <Navigate to="/dashboard" replace />
    }
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
