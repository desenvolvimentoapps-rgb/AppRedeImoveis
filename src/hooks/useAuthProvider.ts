'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { useAuthStore } from './useAuth'

export function useAuthProvider() {
    const { setProfile, setIsLoading } = useAuthStore()
    const supabase = createClient()

    useEffect(() => {
        let isMounted = true;
        const fetchProfile = async () => {
            try {
                // Small delay to ensure browser auth client is fully ready
                await new Promise(resolve => setTimeout(resolve, 100));
                if (!isMounted) return;

                const { data: { user } } = await supabase.auth.getUser()

                if (user && isMounted) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single()

                    if (isMounted) setProfile(profile)
                } else if (isMounted) {
                    setProfile(null)
                }
            } catch (err) {
                console.error("Auth initialization error:", err);
            } finally {
                if (isMounted) setIsLoading(false)
            }
        }

        fetchProfile()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user && isMounted) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single()
                    if (isMounted) setProfile(profile)
                } else if (!session && isMounted) {
                    setProfile(null)
                }
                if (isMounted) setIsLoading(false)
            }
        )

        return () => {
            isMounted = false;
            subscription.unsubscribe()
        }
    }, [supabase, setProfile, setIsLoading])
}
