'use client'

import { AdminSidebar } from './components/AdminSidebar'
import { useAuthStore } from '@/hooks/useAuth'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { profile, isLoading } = useAuthStore()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => {
        if (!isLoading && !profile) {
            const query = searchParams?.toString()
            const redirectTarget = `${pathname}${query ? `?${query}` : ''}`
            router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
            return
        }

        if (profile?.force_password_reset && pathname !== '/admin/reset-password') {
            router.push('/admin/reset-password')
        }
    }, [profile, isLoading, router, pathname, searchParams])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground animate-pulse">Carregando...</p>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground animate-pulse">Redirecionando...</p>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <AdminSidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    )
}



