import { Suspense } from 'react'
import AdminLayout from '@/modules/admin/AdminLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground animate-pulse">Carregando...</p></div>}>
            <AdminLayout>{children}</AdminLayout>
        </Suspense>
    )
}
