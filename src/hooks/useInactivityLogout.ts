'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from './useAuth'

const INACTIVITY_MS = 30 * 60 * 1000
const LAST_ACTIVITY_KEY = 'app:lastActivityAt'

export function useInactivityLogout() {
    const { profile, isLoading, setProfile } = useAuthStore()
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        if (isLoading || !profile) return

        const updateActivity = () => {
            try {
                localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
            } catch {
                // Ignore storage errors (private mode, etc.)
            }
        }

        const checkIdle = async () => {
            try {
                const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0)
                if (!last) return
                if (Date.now() - last >= INACTIVITY_MS) {
                    await supabase.auth.signOut()
                    setProfile(null)
                    router.push('/login')
                    router.refresh()
                }
            } catch {
                // Ignore idle check errors
            }
        }

        updateActivity()

        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'focus']
        events.forEach((event) => window.addEventListener(event, updateActivity, { passive: true }))
        const intervalId = window.setInterval(checkIdle, 60 * 1000)

        return () => {
            events.forEach((event) => window.removeEventListener(event, updateActivity))
            window.clearInterval(intervalId)
        }
    }, [profile, isLoading, router, supabase, setProfile])
}
