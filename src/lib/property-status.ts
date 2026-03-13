import { PropertyStatus } from '@/types/database'

export const DEFAULT_PROPERTY_STATUSES: PropertyStatus[] = [
    { id: 'available', label: 'Disponível', value: 'available', is_active: true, created_at: new Date().toISOString() },
    { id: 'reserved', label: 'Reservado', value: 'reserved', is_active: true, created_at: new Date().toISOString() },
    { id: 'sold', label: 'Vendido', value: 'sold', is_active: true, created_at: new Date().toISOString() },
    { id: 'draft', label: 'Rascunho', value: 'draft', is_active: true, created_at: new Date().toISOString() },
    { id: 'inactive', label: 'Inativo', value: 'inactive', is_active: true, created_at: new Date().toISOString() },
]

export const normalizePropertyStatus = (status: any): PropertyStatus => {
    const value = status?.value || status?.slug || status?.key || status?.name || status?.id || ''
    const label = status?.label || status?.name || status?.title || value
    return {
        id: status?.id || value || label,
        label,
        value,
        is_active: status?.is_active !== false,
        description: status?.description ?? null,
        created_at: status?.created_at || new Date().toISOString(),
    }
}

export const resolveStatusLabel = (value: string | null | undefined, statuses: PropertyStatus[]) => {
    if (!value) return ''
    return statuses.find((status) => status.value === value)?.label || value
}
