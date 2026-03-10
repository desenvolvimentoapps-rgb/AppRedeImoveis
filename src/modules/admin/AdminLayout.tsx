'use client'

import { AdminSidebar } from './components/AdminSidebar'
import { useAuthStore } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { profile, isLoading } = useAuthStore()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && !profile) {
            router.push('/login')
            return
        }

        if (profile?.force_password_reset && window.location.pathname !== '/admin/reset-password') {
            router.push('/admin/reset-password')
        }
    }, [profile, isLoading, router])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground animate-pulse">Carregando...</p>
            </div>
        )
    }

    if (!profile) return null

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <AdminSidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    )
}
