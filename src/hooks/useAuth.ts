import { create } from 'zustand'
import { Profile } from '@/types/database'

interface AuthState {
    profile: Profile | null
    setProfile: (profile: Profile | null) => void
    isLoading: boolean
    setIsLoading: (isLoading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
    profile: null,
    setProfile: (profile) => set({ profile }),
    isLoading: true,
    setIsLoading: (isLoading) => set({ isLoading }),
}))
