import { useEffect, useState, useRef } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTenant, useTenantPath } from '@/lib/tenant/TenantProvider'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

/**
 * AuthGuard component that protects routes requiring authentication
 * 
 * - Shows a centered spinner while loading
 * - Redirects to /auth/login if no user (preserves the previous location)
 * - Handles email confirmation redirects to prevent infinite spinner
 * - 5-second timeout to prevent infinite loading
 * - Renders children if user exists
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, profile, company } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { tenant, membership, membershipChecked } = useTenant()
  const { withBase, stripBase } = useTenantPath()
  const { toast } = useToast()
  const [hasCheckedHash, setHasCheckedHash] = useState(false)
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false)
  const loadingStartTime = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track when loading starts for timeout
  useEffect(() => {
    if (isLoading && !loadingStartTime.current) {
      loadingStartTime.current = Date.now()
    } else if (!isLoading) {
      loadingStartTime.current = null
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isLoading])

  // Timeout to prevent infinite spinner (only if user is NOT authenticated)
  // If user is authenticated, allow them to proceed even if profile is still loading
  useEffect(() => {
    if (isLoading && hasCheckedHash && !user) {
      // Only timeout if there's no user (not authenticated)
      // If user exists, they can proceed even if profile is loading
      timeoutRef.current = setTimeout(() => {
        console.error('AuthGuard: Loading timeout - no user found, redirecting to login')
        toast({
          title: 'Session expired',
          description: 'Please log in again.',
          variant: 'destructive',
        })
        navigate(withBase('/auth/login'), { replace: true })
      }, 5000)
    } else {
      // Clear timeout if user exists or loading stopped
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isLoading, hasCheckedHash, navigate, toast, user, withBase])

  // Check for email confirmation hash in URL (Supabase adds #access_token=... after confirmation)
  useEffect(() => {
    // Only check once and only if we're on a dashboard route
    const logicalPath = stripBase(location.pathname)
    if (hasCheckedHash || !logicalPath.startsWith('/dashboard')) {
      return
    }

    const hash = window.location.hash
    const hasConfirmationHash = hash.includes('access_token') || hash.includes('type=recovery')

    if (hasConfirmationHash) {
      // Check if Supabase has already processed the session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          // Session exists - Supabase already processed it, just clean the URL
          window.history.replaceState({}, '', window.location.pathname)
          setHasCheckedHash(true)
        } else {
          // No session yet - redirect to login to let Supabase process it there
          const newUrl = window.location.href.split('#')[0] // Remove hash
          window.history.replaceState({}, '', newUrl) // Clean URL
          navigate(`${withBase('/auth/login')}?verified=true`, { replace: true })
          setHasCheckedHash(true)
        }
      })
    } else {
      setHasCheckedHash(true)
    }
  }, [location.pathname, navigate, hasCheckedHash, stripBase, withBase])

  // Check onboarding status once profile and company are loaded
  // IMPORTANT: This hook must be before any early returns to follow Rules of Hooks
  useEffect(() => {
    let active = true

    const run = async () => {
    if (
      hasCheckedOnboarding ||
      isLoading ||
      !isAuthenticated ||
      !user ||
      !hasCheckedHash ||
      !membershipChecked
    ) {
      return
    }

    // If the user is authenticated but NOT a member of the current tenant,
    // skip the onboarding check entirely. MembershipGuard (child component)
    // will show the AccessDenied page instead.
    if (!membership) {
      setHasCheckedOnboarding(true)
      return
    }

    // Client members should never be forced into the admin onboarding flow.
    // Onboarding is only for tenant admins/owners to set up company/billing details.
    if (membership.role === 'member') {
      setHasCheckedOnboarding(true)
      return
    }

    // If we're already on the onboarding page, don't redirect
    const logicalPath = stripBase(location.pathname)
    if (logicalPath === '/auth/onboarding') {
      setHasCheckedOnboarding(true)
      return
    }

    // Check if user needs to complete onboarding
    // User needs onboarding if:
    // 1. They don't have a company_id in their profile, OR
    // 2. They have a company_id but the company doesn't exist, OR
    // 3. They have a company but onboarding_completed is false
    const needsOnboarding =
      !profile?.company_id ||
      (profile.company_id && !company) ||
      (company && company.onboarding_completed === false)

    if (needsOnboarding && logicalPath.startsWith('/dashboard')) {
      // Admins/owners may manage an already onboarded tenant company
      // without having a personal profile.company_id link.
      if (
        (membership.role === 'owner' || membership.role === 'admin') &&
        !profile?.company_id &&
        tenant?.id
      ) {
        const { data: existingTenantCompany, error } = await supabase
          .from('companies')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('onboarding_completed', true)
          .limit(1)

        if (!active) return

        if (error) {
          console.warn('AuthGuard tenant company check failed, falling back to onboarding:', error)
        } else if ((existingTenantCompany?.length ?? 0) > 0) {
          setHasCheckedOnboarding(true)
          return
        }
      }

      setHasCheckedOnboarding(true)
      const reason =
        !profile?.company_id
          ? 'missing-company-link'
          : profile.company_id && !company
            ? 'missing-company-record'
            : company?.onboarding_completed === false
              ? 'company-onboarding-incomplete'
              : 'unknown'
      navigate(`${withBase('/auth/onboarding')}?reason=${encodeURIComponent(reason)}`, { replace: true })
      return
    }

    setHasCheckedOnboarding(true)
    }

    run()

    return () => {
      active = false
    }
  }, [
    isAuthenticated,
    user,
    profile,
    company,
    tenant,
    isLoading,
    hasCheckedHash,
    hasCheckedOnboarding,
    membership,
    membershipChecked,
    location.pathname,
    navigate,
    stripBase,
    withBase,
  ])

  // If we're still checking the hash, show a brief loading state
  if (!hasCheckedHash && stripBase(location.pathname).startsWith('/dashboard')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // If user is authenticated but still loading profile, allow them to proceed
  // The profile will load in the background
  if (isAuthenticated && user && isLoading) {
    // User is authenticated, allow access even if profile is still loading
    // This prevents timeout redirects when profile fetch is slow
    return <>{children}</>
  }

  // Show spinner while loading (but only after we've checked for confirmation hash)
  // This primarily covers unauthenticated/session-bootstrap states.
  if (isLoading && hasCheckedHash) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // If we're checking onboarding, show loading
  if (isAuthenticated && !hasCheckedOnboarding && hasCheckedHash) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Redirect to login if not authenticated, preserving the location they tried to access
  if (!isAuthenticated) {
    return <Navigate to={withBase('/auth/login')} state={{ from: location }} replace />
  }

  // User is authenticated, render children
  return <>{children}</>
}
