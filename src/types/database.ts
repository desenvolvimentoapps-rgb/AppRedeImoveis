export type UserRole = 'hakunaadm' | 'gestaoimoveis' | 'corretor'

export interface Profile {
    id: string
    full_name: string | null
    role: UserRole
    phone: string | null
    created_at: string
    updated_at: string
}

export interface PropertyType {
    id: string
    name: string
    created_at: string
}

export interface Property {
    id: string
    code: string
    title: string
    value: number | null
    description: string | null
    status: string
    type_id: string | null
    delivery_date: string | null
    show_delivery_date: boolean

    address_cep: string | null
    address_street: string | null
    address_neighborhood: string | null
    address_city: string | null
    address_state: string | null
    address_uf: string | null
    address_country: string
    is_exterior: boolean

    real_estate_code: string | null
    internal_code: string | null
    is_internal_code_visible: boolean

    whatsapp_br: string | null
    whatsapp_intl: string | null

    images: string[]
    main_image_index: number

    specs: Record<string, any>
    amenities: Record<string, any>
    features: Record<string, any>

    slug: string
    seo_title: string | null
    seo_description: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface Lead {
    id: string
    property_id: string | null
    name: string
    email: string
    phone: string | null
    message: string | null
    status: string
    created_at: string
}

export interface CMSField {
    id: string
    name: string
    label: string
    type: string
    section: string
    icon: string | null
    is_active: boolean
    is_visible: boolean
    is_filterable: boolean
    options: any
    created_at: string
}

export interface CMSMenu {
    id: string
    label: string
    path: string
    icon: string | null
    required_roles: UserRole[]
    display_order: number
    is_active: boolean
}
