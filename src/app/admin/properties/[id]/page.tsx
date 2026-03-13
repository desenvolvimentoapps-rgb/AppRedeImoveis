'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { Property } from '@/types/database'
import { PropertyForm } from '@/modules/property/components/PropertyForm'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function EditPropertyPage() {
    const params = useParams<{ id: string }>()
    const rawId = params?.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId
    const [property, setProperty] = useState<Property | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()
    const { profile, isLoading: authLoading } = useAuthStore()
    const canEdit = hasPermission(profile, 'properties', 'edit')

    useEffect(() => {
        const fetchProperty = async () => {
            const { data, error } = await supabase
                .from('properties')
                .select('*')
                .eq('id', id)
                .single()

            if (error) {
                toast.error('Imóvel não encontrado')
                console.error(error)
            } else {
                setProperty(data)
            }
            setIsLoading(false)
        }

        if (id) fetchProperty()
    }, [id, supabase])

    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Carregando permissões...</p>
            </div>
        )
    }

    if (!canEdit) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
                <h1 className="text-2xl font-bold">Acesso restrito</h1>
                <p className="text-muted-foreground">Você não tem permissão para editar imóveis.</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Carregando dados do imóvel...</p>
            </div>
        )
    }

    if (!property) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h1 className="text-2xl font-bold">Imóvel não encontrado</h1>
                <p className="text-muted-foreground">O imóvel que você está tentando editar não existe ou foi removido.</p>
            </div>
        )
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <PropertyForm initialData={property} isEditing />
        </div>
    )
}
