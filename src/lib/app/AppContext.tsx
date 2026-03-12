import { createContext, useContext, useMemo } from 'react'
import type { Company, Profile } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/lib/tenant/TenantProvider'

export interface CurrentAccount {
  userId: string | null
  email: string | null
  profile: Profile | null
  isAdmin: boolean
  membershipRole: string | null
}

interface AppContextValue {
  currentAccount: CurrentAccount
  currentCompany: Company | null
  workspaceId: string | null
  workspaceName: string | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, company, isAdmin } = useAuth()
  const { tenant, membership } = useTenant()

  const value = useMemo<AppContextValue>(
    () => ({
      currentAccount: {
        userId: user?.id ?? null,
        email: user?.email ?? profile?.email ?? null,
        profile: profile ?? null,
        isAdmin,
        membershipRole: membership?.role ?? null,
      },
      currentCompany: company ?? null,
      workspaceId: tenant?.id ?? null,
      workspaceName: tenant?.name ?? null,
    }),
    [user?.id, user?.email, profile, isAdmin, membership?.role, company, tenant?.id, tenant?.name]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useAppContext must be used within AppContextProvider')
  }
  return ctx
}
