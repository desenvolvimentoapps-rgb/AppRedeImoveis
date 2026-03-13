'use client'

import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { PropertyForm } from '@/modules/property/components/PropertyForm'
import { Loader2 } from 'lucide-react'

export default function NewPropertyPage() {
    const { profile, isLoading } = useAuthStore()
    const canCreate = hasPermission(profile, 'properties', 'create')

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Carregando permissões...</p>
            </div>
        )
    }

    if (!canCreate) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
                <h1 className="text-2xl font-bold">Acesso restrito</h1>
                <p className="text-muted-foreground">Você não tem permissão para criar imóveis.</p>
            </div>
        )
    }

    return (
        <div className="container py-6">
            <PropertyForm />
        </div>
    )
}
