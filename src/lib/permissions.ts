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

    const permissions = (profile as any)?.permissions as UserPermissions | undefined
    if (!permissions) return true
    if (permissions.master) return true

    const actions = permissions.actions?.[resource] || []
    if (actions.includes('master')) return true
    return actions.includes(action)
}

export function isMenuAllowed(profile: Profile | null | undefined, menuKey: string) {
    if (!profile) return false
    if (profile.role === 'hakunaadm') return true

    const permissions = (profile as any)?.permissions as UserPermissions | undefined
    if (!permissions || !permissions.menus || permissions.menus.length === 0) return true
    return permissions.menus.includes(menuKey)
}

export function canManageUser(actor: Profile | null | undefined, target: Profile | null | undefined) {
    if (!actor || !target) return false
    if (actor.role === 'hakunaadm') return true
    return ROLE_ORDER[actor.role] > ROLE_ORDER[target.role]
}
