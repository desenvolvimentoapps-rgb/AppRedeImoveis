import { Profile, UserRole } from '@/types/database'

export type PermissionAction = 'create' | 'edit' | 'delete' | 'master' | 'view'
export type PermissionResource =
    | 'properties'
    | 'property_statuses'
    | 'leads'
    | 'cms_fields'
    | 'cms_types'
    | 'cms_menus'
    | 'settings'
    | 'users'
    | 'charts'
    | 'my_charts'
    | 'management'
    | 'dashboard'
    | 'construction_partners'
    | 'faq'
    | 'partnerships'
    | 'api_access'

export interface UserPermissions {
    menus?: string[]
    actions?: Record<string, PermissionAction[]>
    master?: boolean
}

const ROLE_ORDER: Record<UserRole, number> = {
    hakunaadm: 3,
    gestaoimoveis: 2,
    corretor: 1,
}

export function hasPermission(profile: Profile | null | undefined, resource: PermissionResource, action: PermissionAction = 'view') {
    if (!profile) return false
    if (profile.role === 'hakunaadm') return true

    const permissions = resolvePermissions(profile)
    if (!permissions) return true
    if (permissions.master) return true

    const actions = permissions.actions?.[resource] || []
    if (actions.includes('master')) return true
    return actions.includes(action)
}

export function isMenuAllowed(profile: Profile | null | undefined, menuKey: string) {
    if (!profile) return false
    if (profile.role === 'hakunaadm') return true

    const permissions = resolvePermissions(profile)
    if (!permissions) return true
    if (!permissions.menus) return true
    return permissions.menus.includes(menuKey)
}

function parsePermissions(raw: any): UserPermissions | undefined {
    if (!raw) return undefined
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw) as UserPermissions
        } catch {
            return undefined
        }
    }
    return raw as UserPermissions
}

function resolvePermissions(profile: Profile | null | undefined): UserPermissions | undefined {
    if (!profile) return undefined
    const userPermissions = parsePermissions((profile as any)?.permissions)
    if (userPermissions) return userPermissions
    const rolePermissions = parsePermissions((profile as any)?.custom_role?.permissions)
    if (rolePermissions) return rolePermissions
    return undefined
}

export function canManageUser(actor: Profile | null | undefined, target: Profile | null | undefined) {
    if (!actor || !target) return false
    if (actor.role === 'hakunaadm') return true
    return ROLE_ORDER[actor.role] > ROLE_ORDER[target.role]
}
