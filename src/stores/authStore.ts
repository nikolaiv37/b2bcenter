import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { Profile, Company } from '@/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  company: Company | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setCompany: (company: Company | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  company: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setCompany: (company) => set({ company }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  clear: () => set({ user: null, profile: null, company: null }),
}))

