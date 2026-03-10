export type UserRole = 'hakunaadm' | 'gestaoimoveis' | 'corretor'

export interface Profile {
    id: string
    full_name: string | null
    email: string | null
    role: UserRole
    phone: string | null
    force_password_reset: boolean
    created_at: string
    updated_at: string
}

export interface PropertyType {
    id: string
    name: string
    slug: string
    description: string | null
    is_active: boolean
    created_at: string
}

export interface Property {
    id: string
    code: string
    title: string
    value: number | null
    type?: { name: string }
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
    owner_code: string | null
    construction_code: string | null

    show_internal_code: boolean
    show_owner_code: boolean
    show_construction_code: boolean

    whatsapp_br: string | null
    whatsapp_intl: string | null
    show_whatsapp_br: boolean
    show_whatsapp_intl: boolean

    images: string[]
    main_image_index: number

    specs: Record<string, any>
    amenities: Record<string, any>
    features: Record<string, any>

    is_featured: boolean
    is_active: boolean
    address_number: string | null

    view_count: number
    click_count: number

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
    property_type_id: string | null
    instruction: string | null
    placeholder: string | null
    is_required: boolean
    show_in_summary: boolean
    summary_order: number
    created_at: string
}

export interface CMSSettings {
    id: string
    key: string
    value: any
    label: string | null
    description: string | null
    updated_at: string
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
