import { useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Profile, UserRole, Company } from '@/types'
import { identifyUser } from '@/lib/analytics'
import { useTenant, useTenantPath } from '@/lib/tenant/TenantProvider'

const blockedUserTenantPairs = new Set<string>()
const loggedTenantMismatchPairs = new Set<string>()

// Module-level flag shared across all useAuth instances.
// When true, the onAuthStateChange SIGNED_OUT handler skips React state
// updates so we don't get a SPA navigation racing the hard redirect.
let _isSigningOut = false

// Shared across all useAuth() hook instances so multiple mounted guards/pages
// don't duplicate profile bootstrap work during the same auth event.
const authBootstrapState = {
  loadingProfileUserId: null as string | null,
  currentProfile: null as Profile | null,
  profileLoadStarted: new Set<string>(),
}

/**
 * Single source of truth for authentication state
 * 
 * Features:
 * - Real-time auth state listening
 * - Automatic profile fetching on login
 * - Automatic profile creation if missing (role = 'company')
 * - Bulletproof error handling (RLS errors don't hang)
 * - Exposes: user, profile, isAdmin, isLoading
 */
export function useAuth() {
  const { user, profile, setUser, setProfile, setCompany, setLoading, clear } = useAuthStore()
  const { tenant, membership } = useTenant()
  const tenantId = tenant?.id ?? null
  const { withBase } = useTenantPath()
  // Keep ref in sync with profile
  useEffect(() => {
    authBootstrapState.currentProfile = profile
  }, [profile])

  useEffect(() => {
    let mounted = true

    // Helper function to load profile for a user
    const handleUserSession = async (sessionUser: User, event?: string) => {
      try {
        if (!mounted) return
        
        const userId = sessionUser.id
        const currentProfile = authBootstrapState.currentProfile
        
        // If profile already loaded for this user, just ensure loading is false
        if (currentProfile && currentProfile.id === userId) {
          setLoading(false)
          return
        }
        
        // If we're already loading this user's profile, skip
        if (
          authBootstrapState.loadingProfileUserId === userId ||
          authBootstrapState.profileLoadStarted.has(userId)
        ) {
          return
        }
        
        // If another user's profile is being loaded, wait a bit
        if (
          authBootstrapState.loadingProfileUserId &&
          authBootstrapState.loadingProfileUserId !== userId
        ) {
          return
        }
        
        // Mark that we're starting to load this profile
        authBootstrapState.profileLoadStarted.add(userId)
        authBootstrapState.loadingProfileUserId = userId
        
        // Add a small delay for INITIAL_SESSION to ensure session is fully ready
        // INITIAL_SESSION means the session is already initialized, so we just need a brief moment
        if (event === 'INITIAL_SESSION') {
          await new Promise(resolve => setTimeout(resolve, 20))
          if (!mounted) return
        }
        
        await loadOrCreateProfile(sessionUser)
      } finally {
        if (sessionUser?.id) {
          authBootstrapState.loadingProfileUserId = null
          authBootstrapState.profileLoadStarted.delete(sessionUser.id)
        }
      }
    }

    // Listen for auth state changes in real time
    // onAuthStateChange fires immediately with current session, so we don't need getSession()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (!mounted) return

        // If signOut() initiated this event, skip all React state updates.
        // signOut() will hard-redirect via window.location.replace, so
        // updating state here would just trigger AuthGuard's <Navigate>
        // and cause a visible double-reload.
        if (event === 'SIGNED_OUT' && _isSigningOut) {
          return
        }

        // Reset tracking on auth changes
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          authBootstrapState.profileLoadStarted.clear()
        }
        if (event === 'SIGNED_OUT') {
          blockedUserTenantPairs.clear()
          loggedTenantMismatchPairs.clear()
          authBootstrapState.currentProfile = null
          authBootstrapState.loadingProfileUserId = null
        }

        setUser(session?.user ?? null)
        
        if (session?.user) {
          // App host / platform routes have no tenant context, so there is no
          // tenant-scoped profile to load here. Unblock UI immediately.
          if (!tenantId) {
            setProfile(null)
            setCompany(null)
            setLoading(false)
            return
          }

          // Only fetch profile on INITIAL_SESSION (session is fully ready)
          // Skip SIGNED_IN for profile loading - session might not be ready yet
          // This prevents timeouts and duplicate fetches
          if (event === 'SIGNED_IN') {
            // Just set the user, don't fetch profile yet
            // INITIAL_SESSION will fire next and handle the profile fetch
            return
          }
          
          // Skip INITIAL_SESSION if we already started loading (prevents duplicate fetches)
          if (event === 'INITIAL_SESSION' && authBootstrapState.profileLoadStarted.has(session.user.id)) {
            return
          }

          // Token refresh should not re-run profile bootstrap on every refresh cycle.
          if (event === 'TOKEN_REFRESHED') {
            setLoading(false)
            return
          }
          
          await handleUserSession(session.user, event)
        } else {
          clear()
          setLoading(false)
          authBootstrapState.loadingProfileUserId = null
          authBootstrapState.currentProfile = null
          authBootstrapState.profileLoadStarted.clear()
        }
      } finally {
      }
    })

    // Handle email confirmation hash/query params - clean after 2s
    const hash = window.location.hash
    const searchParams = new URLSearchParams(window.location.search)
    const hasVerification = hash.includes('access_token') || hash.includes('type=recovery') || searchParams.has('verified')

    if (hasVerification) {
      // Clean URL after 2 seconds
      setTimeout(() => {
        if (!mounted) return
        
        // Clean hash from URL
        if (hash) {
          window.history.replaceState({}, '', window.location.pathname + window.location.search)
        }
        
        // Clean verified query param
        if (searchParams.has('verified')) {
          searchParams.delete('verified')
          const newSearch = searchParams.toString()
          const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname
          window.history.replaceState({}, '', newUrl)
        }
      }, 2000)
    }

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUser, setProfile, setLoading, clear, tenantId])

  /**
   * Loads company data from the database.
   */
  const loadCompany = async (companyId: string) => {
    try {
      if (!tenantId) {
        setCompany(null)
        return
      }
      const { data: companyRows, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .eq('tenant_id', tenantId)
        .limit(1)

      const company = companyRows?.[0]

      if (!company && !error) {
        // Try legacy fetch without tenant filter (pre-tenant migration data)
        const { data: legacyCompanyRows, error: legacyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .limit(1)

        const legacyCompany = legacyCompanyRows?.[0]

        if (legacyError) {
          console.error('Error loading legacy company:', legacyError)
          setCompany(null)
          return
        }

        if (legacyCompany) {
          if (legacyCompany.tenant_id && legacyCompany.tenant_id !== tenantId) {
            console.warn('Company tenant mismatch; refusing to attach company', {
              companyTenantId: legacyCompany.tenant_id,
              currentTenantId: tenantId,
              companyId,
            })
            setCompany(null)
            return
          }

          let companyToUse = legacyCompany
          if (!legacyCompany.tenant_id) {
            const { data: updatedCompany, error: updateError } = await supabase
              .from('companies')
              .update({ tenant_id: tenantId })
              .eq('id', companyId)
              .select()
              .limit(1)

            if (updateError) {
              console.warn('Failed to backfill tenant_id on legacy company; continuing with legacy company', updateError)
            } else if (updatedCompany?.[0]) {
              companyToUse = updatedCompany[0]
            }
          }

          useAuthStore.getState().setCompany(companyToUse as Company)
        } else {
          setCompany(null)
        }
        return
      }

      if (error) {
        console.error('Error loading company:', error)
        setCompany(null)
        return
      }

      if (company) {
        useAuthStore.getState().setCompany(company as Company)
      } else {
        setCompany(null)
      }
    } catch (error) {
      console.error('Unexpected error loading company:', error)
      setCompany(null)
    }
  }

  /**
   * Loads the user's profile from the database.
   * If the profile doesn't exist, creates it automatically with role = 'company'.
   * Bulletproof error handling - RLS errors or other issues won't hang the app.
   */
  const loadOrCreateProfile = async (user: User) => {
    const userTenantKey = `${user.id}:${tenantId ?? 'no-tenant'}`
    if (blockedUserTenantPairs.has(userTenantKey)) {
      setProfile(null)
      setCompany(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      if (!tenantId) {
        setProfile(null)
        setCompany(null)
        setLoading(false)
        return
      }

      // Fetch existing profile scoped to tenant
      const { data: existingProfileRows, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .eq('tenant_id', tenantId)
        .limit(1)

      const existingProfile = existingProfileRows?.[0]

      // Handle "not found" case (profile doesn't exist)
      if (!existingProfile && !fetchError) {
        // Profile doesn't exist for this tenant - try legacy lookup by id (no tenant filter)
        const { data: legacyProfileRows, error: legacyError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .limit(1)

        const legacyProfile = legacyProfileRows?.[0]

        if (legacyError) {
          console.error('Error fetching legacy profile:', {
            code: legacyError.code,
            message: legacyError.message,
            details: legacyError.details,
            hint: legacyError.hint,
          })
        }

        if (legacyProfile) {
          if (legacyProfile.tenant_id && legacyProfile.tenant_id !== tenantId) {
            blockedUserTenantPairs.add(userTenantKey)
            if (!loggedTenantMismatchPairs.has(userTenantKey)) {
              console.warn('Profile tenant mismatch; refusing to attach profile', {
                profileTenantId: legacyProfile.tenant_id,
                currentTenantId: tenantId,
                userId: user.id,
              })
              loggedTenantMismatchPairs.add(userTenantKey)
            }
            setProfile(null)
            setCompany(null)
            setLoading(false)
            return
          }

          let profileToUse = legacyProfile
          if (!legacyProfile.tenant_id) {
            const { data: updatedProfile, error: updateError } = await supabase
              .from('profiles')
              .update({ tenant_id: tenantId })
              .eq('id', user.id)
              .select()
              .limit(1)

            if (updateError) {
              console.warn('Failed to backfill tenant_id on legacy profile; continuing with legacy profile', updateError)
            } else if (updatedProfile?.[0]) {
              profileToUse = updatedProfile[0]
            }
          }

          const profileWithEmail = {
            ...profileToUse,
            email: user.email || undefined,
          } as Profile

          setProfile(profileWithEmail)

          if (profileToUse.company_id) {
            await loadCompany(profileToUse.company_id)
          } else {
            setCompany(null)
          }

          identifyUser(user.id, {
            email: user.email || '',
            role: profileToUse.role,
          })

          setLoading(false)
          return
        }
        // Profile doesn't exist anywhere - create it below
      } else if (fetchError) {
        // Real error occurred
        console.error('Error fetching profile:', {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
        })
        setProfile(null)
        setCompany(null)
        setLoading(false)
        return
      } else if (existingProfile) {
        blockedUserTenantPairs.delete(userTenantKey)
        loggedTenantMismatchPairs.delete(userTenantKey)
        // Profile found - return it
        const profileWithEmail = {
          ...existingProfile,
          email: user.email || undefined,
        } as Profile
        
        setProfile(profileWithEmail)
        
        // Load company if profile has company_id
        if (existingProfile.company_id) {
          await loadCompany(existingProfile.company_id)
        } else {
          setCompany(null)
        }
        
        identifyUser(user.id, {
          email: user.email || '',
          role: existingProfile.role,
        })
        
        setLoading(false)
        return
      }
      
      // If we get here, profile doesn't exist for this tenant - create it
      // Create it automatically with default role 'company'
      // Note: company_name will be set during onboarding, so it's nullable here
      const newProfile = {
        id: user.id,
        tenant_id: tenantId,
        role: 'company' as UserRole,
        company_name: null, // Will be set during onboarding
        phone: null, // Optional
      }

      // Insert new profile
      const { data: createdProfile, error: createError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .limit(1)

      if (createError) {
        if (createError.code === '23505') {
          // Duplicate key - profile already exists, try to load it
          const { data: fallbackRows, error: fallbackError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .limit(1)

          const fallbackProfile = fallbackRows?.[0]

          if (fallbackError) {
            console.error('Error fetching existing profile after duplicate:', fallbackError)
          } else if (fallbackProfile) {
            let profileToUse = fallbackProfile
            if (!fallbackProfile.tenant_id) {
              const { data: updatedProfile } = await supabase
                .from('profiles')
                .update({ tenant_id: tenantId })
                .eq('id', user.id)
                .select()
                .limit(1)
              if (updatedProfile?.[0]) {
                profileToUse = updatedProfile[0]
              }
            }

            const profileWithEmail = {
              ...profileToUse,
              email: user.email || undefined,
            } as Profile

            setProfile(profileWithEmail)

            if (profileToUse.company_id) {
              await loadCompany(profileToUse.company_id)
            } else {
              setCompany(null)
            }

            identifyUser(user.id, {
              email: user.email || '',
              role: profileToUse.role,
            })

            setLoading(false)
            return
          }
        }

        console.error('Error creating profile:', createError)
        // Don't throw - set profile to null and stop loading
        setProfile(null)
        setCompany(null)
        setLoading(false)
        return
      }

      // Add email from auth user to profile object (email is in auth.users, not profiles table)
      if (!createdProfile?.[0]) {
        console.error('Profile insert returned no row; stopping auth bootstrap')
        setProfile(null)
        setCompany(null)
        setLoading(false)
        return
      }

      const profileWithEmail = {
        ...createdProfile[0],
        email: user.email || undefined,
      } as Profile
      
      setProfile(profileWithEmail)
      
      // Load company if profile has company_id
      if (createdProfile[0].company_id) {
        await loadCompany(createdProfile[0].company_id)
      } else {
        setCompany(null)
      }
      
      // Track new user
      identifyUser(user.id, {
        email: user.email || '',
        role: createdProfile[0].role,
      })
      
      setLoading(false)
    } catch (error: unknown) {
      // Catch any unexpected errors (network issues, etc.)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Unexpected error loading/creating profile:', errorMessage)
      
      // Set profile to null and stop loading - don't hang
      setProfile(null)
      setCompany(null)
      setLoading(false)
    } finally {
      // Ensure loading is always set to false
      setLoading(false)
    }
  }

  // Sign out function — clears Supabase session then hard-redirects.
  // Optional `redirectTo` overrides the default login path (useful for passing
  // query params like ?reason=no-membership).
  const signOut = async (redirectTo?: string) => {
    // Prevent the SIGNED_OUT event handler (and downstream guards) from
    // doing React state updates that would race with our hard redirect.
    _isSigningOut = true

    blockedUserTenantPairs.clear()
    loggedTenantMismatchPairs.clear()

    // Give local sign-out a brief window to clear storage before redirect.
    await new Promise<void>((resolve) => {
      let settled = false

      supabase.auth
        .signOut({ scope: 'local' })
        .then(({ error }) => {
          if (error) {
            console.warn('Supabase signOut returned error, continuing logout anyway:', error)
          }
          settled = true
          resolve()
        })
        .catch((error) => {
          console.warn('Supabase signOut threw, continuing logout anyway:', error)
          settled = true
          resolve()
        })

      setTimeout(() => {
        if (!settled) {
          console.warn('Supabase signOut timed out, continuing logout anyway.')
          settled = true
          resolve()
        }
      }, 300)
    })

    // Skip React state updates (clear, setLoading, etc.) — the hard
    // redirect below reloads the page which starts with a fresh store.
    const loginPath = redirectTo ?? withBase('/auth/login')
    window.location.replace(loginPath)
  }

  // Computed values
  const isAuthenticated = !!user
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin'
  const isPlatformAdmin = profile?.is_platform_admin === true
  const isLoading = useAuthStore((state) => state.isLoading)
  const company = useAuthStore((state) => state.company)

  return {
    // Auth state
    user,
    profile,
    company,
    isLoading,
    isAuthenticated,
    isAdmin,
    isPlatformAdmin,
    isSigningOut: _isSigningOut,
    // Actions
    signOut,
  }
}
