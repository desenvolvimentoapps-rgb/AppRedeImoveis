import { create } from 'zustand'
import { Profile } from '@/types/database'

interface AuthState {
    profile: Profile | null
    setProfile: (profile: Profile | null) => void
    isLoading: boolean
    setIsLoading: (isLoading: boolean) => void
    refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
    profile: null,
    setProfile: (profile) => set({ profile }),
    isLoading: true,
    setIsLoading: (isLoading) => set({ isLoading }),
    refreshProfile: async () => {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*, custom_role:roles(id, key, label, description, permissions, is_active)')
                .eq('id', user.id)
                .single()
            if (profile) {
                const raw = (profile as any)?.permissions
                const parsed = typeof raw === 'string' ? (() => {
                    try { return JSON.parse(raw) } catch { return raw }
                })() : raw
                set({ profile: { ...profile, permissions: parsed } })
            }
        }
    }
}))
