'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useRef } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useAuthStore } from './useAuth'

export function useAuthProvider() {
    const { setProfile, setIsLoading } = useAuthStore()
    const supabase = createClient()
    const initializedRef = useRef(false)
    const syncInFlight = useRef<Promise<void> | null>(null)

    useEffect(() => {
        let isMounted = true

        const syncProfile = async (session: Session | null) => {
            if (syncInFlight.current) return syncInFlight.current

            syncInFlight.current = (async () => {
                const run = async () => {
                    if (!session?.user) {
                        if (isMounted) setProfile(null)
                        return
                    }

                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('*, custom_role:roles(id, key, label, description, permissions, is_active)')
                        .eq('id', session.user.id)
                        .maybeSingle()

                    if (error) throw error

                    if (!profile) {
                        const fallbackProfile = {
                            id: session.user.id,
                            full_name: (session.user.user_metadata as any)?.full_name || session.user.email,
                            email: session.user.email,
                            role: (session.user.user_metadata as any)?.role || 'corretor',
                            updated_at: new Date().toISOString(),
                        }
                        const { data: createdProfile } = await supabase
                            .from('profiles')
                            .upsert(fallbackProfile, { onConflict: 'id' })
                            .select('*')
                            .maybeSingle()
                        if (isMounted) setProfile(createdProfile || (fallbackProfile as any))
                    } else if (isMounted) {
                        setProfile(profile)
                    }
                }

                try {
                    for (let attempt = 0; attempt < 2; attempt++) {
                        try {
                            await run()
                            return
                        } catch (err: any) {
                            const message = String(err?.message || '')
                            const isLock = err?.name === 'AbortError' || message.includes('Lock') || message.includes('lock:')
                            if (!isLock || attempt === 1) throw err
                            await new Promise(resolve => setTimeout(resolve, 250))
                        }
                    }
                } catch (err) {
                    console.error('Auth initialization error:', err)
                } finally {
                    if (isMounted) setIsLoading(false)
                }
            })().finally(() => {
                syncInFlight.current = null
            })

            return syncInFlight.current
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                if (event === 'INITIAL_SESSION' && initializedRef.current) return
                initializedRef.current = true
                await syncProfile(session)
            }
        )

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [supabase, setProfile, setIsLoading])
}
