'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { useAuthStore } from './useAuth'

export function useAuthProvider() {
    const { setProfile, setIsLoading } = useAuthStore()
    const supabase = createClient()

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single()

                setProfile(profile)
            } else {
                setProfile(null)
            }
            setIsLoading(false)
        }

        fetchProfile()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single()
                    setProfile(profile)
                } else {
                    setProfile(null)
                }
                setIsLoading(false)
            }
        )

        return () => {
            subscription.unsubscribe()
        }
    }, [supabase, setProfile, setIsLoading])
}
