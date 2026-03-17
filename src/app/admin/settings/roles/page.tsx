'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/hooks/useAuth'
import { CMSMenu, UserRole } from '@/types/database'
import { hasPermission, UserPermissions, PermissionAction, PermissionResource } from '@/lib/permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Trash2, Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'

type RoleOption = {
    key: UserRole
    label: string
    description: string
}

const ROLE_OPTIONS: RoleOption[] = [
    { key: 'hakunaadm', label: 'Administrador', description: 'Acesso total ao sistema' },
    { key: 'gestaoimoveis', label: 'Gestor', description: 'Gestão de imóveis e leads' },
    { key: 'corretor', label: 'Corretor', description: 'Atendimento e captação' },
]

const SYSTEM_MENUS: Array<Pick<CMSMenu, 'label' | 'path' | 'icon'> & { required_roles?: UserRole[] }> = [
    { label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' },
    { label: 'Leads', path: '/admin/leads', icon: 'Users' },
    { label: 'Imóveis', path: '/admin/properties', icon: 'Home' },
    { label: 'Tipos de Imóvel', path: '/admin/cms/types', icon: 'Building2' },
    { label: 'Status do Imóvel', path: '/admin/cms/status', icon: 'CheckCircle2' },
    { label: 'Campos do CMS', path: '/admin/cms/fields', icon: 'List' },
    { label: 'Gestão de Gráficos', path: '/admin/cms/charts', icon: 'BarChart3' },
    { label: 'Meus Gráficos', path: '/admin/dashboard/my-charts', icon: 'PieChart' },
    { label: 'Construtoras', path: '/admin/cms/construtoras', icon: 'Building2' },
    { label: 'FAQ', path: '/admin/settings/faq', icon: 'HelpCircle' },
    { label: 'Parcerias', path: '/admin/settings/parcerias', icon: 'Handshake' },
    { label: 'Acessos API', path: '/admin/settings/api-access', icon: 'KeyRound', required_roles: ['hakunaadm'] },
    { label: 'Usuários', path: '/admin/settings/users', icon: 'Users' },
    { label: 'Gestão e Controle', path: '/admin/management', icon: 'Shield' },
    { label: 'Perfis de Acesso', path: '/admin/settings/roles', icon: 'ShieldCheck' },
]

type RoleItem = {
    id: string
    key: string
    label: string
    description: string | null
    is_active: boolean
    permissions: any
}

const DEFAULT_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'master']

const RESOURCE_LABELS: Record<PermissionResource, string> = {
    properties: 'Imóveis',
    property_statuses: 'Status de Imóvel',
    leads: 'Leads',
    cms_fields: 'CMS - Campos',
    cms_types: 'CMS - Tipos',
    cms_menus: 'CMS - Menus',
    settings: 'Configurações',
    users: 'Usuários',
    charts: 'Gestão de Gráficos',
    my_charts: 'Meus Gráficos',
    management: 'Gestão e Controle',
    dashboard: 'Dashboard',
    construction_partners: 'Construtoras',
    faq: 'FAQ',
    partnerships: 'Parcerias',
    api_access: 'Acessos API',
}

const slugify = (value: string) => value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')

export default function RolesPage() {
    const supabase = createClient()
    const { profile } = useAuthStore()
    const isAdmin = profile?.role === 'hakunaadm'
    const canView = isAdmin && hasPermission(profile, 'settings', 'view')
    const canEdit = isAdmin && hasPermission(profile, 'settings', 'edit')

    const [menus, setMenus] = useState<CMSMenu[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [selectedRole, setSelectedRole] = useState<UserRole>('hakunaadm')
    const [search, setSearch] = useState('')
    const [customRoles, setCustomRoles] = useState<RoleItem[]>([])
    const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
    const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
    const [roleForm, setRoleForm] = useState({ label: '', key: '', description: '', is_active: true })
    const [rolePermissions, setRolePermissions] = useState<UserPermissions>({ menus: [], actions: {}, master: false })
    const [isRoleSaving, setIsRoleSaving] = useState(false)

    useEffect(() => {
        if (profile) {
            fetchMenus()
        }
    }, [profile])

    const ensureSystemMenus = async (current: CMSMenu[]) => {
        const currentPaths = new Set(current.map(menu => menu.path))
        const currentLabels = new Set(current.map(menu => menu.label))
        const toInsert = SYSTEM_MENUS.filter(menu => !currentPaths.has(menu.path) && !currentLabels.has(menu.label))

        if (toInsert.length === 0) return

        await supabase.from('cms_menus').insert(
            toInsert.map(menu => ({
                label: menu.label,
                path: menu.path,
                icon: menu.icon,
                required_roles: menu.required_roles ?? ROLE_OPTIONS.map(role => role.key),
                display_order: 0,
                is_active: true,
            }))
        )
    }

    const fetchMenus = async () => {
        setIsLoading(true)
        const [menusRes, rolesRes] = await Promise.all([
            supabase.from('cms_menus').select('*').order('display_order', { ascending: true }),
            supabase.from('roles').select('*').order('label'),
        ])

        const data = menusRes.data
        const error = menusRes.error

        if (error) {
            toast.error('Erro ao carregar menus', { description: error.message })
            setIsLoading(false)
            return
        }

        const normalized = (data || []).map((menu: CMSMenu) => ({
            ...menu,
            required_roles: Array.isArray(menu.required_roles) ? menu.required_roles : [],
        })) as CMSMenu[]

        await ensureSystemMenus(normalized)

        const { data: refreshed } = await supabase
            .from('cms_menus')
            .select('*')
            .order('display_order', { ascending: true })

        setMenus(((refreshed || []) as CMSMenu[]).map(menu => ({
            ...menu,
            required_roles: Array.isArray(menu.required_roles) ? menu.required_roles : [],
        })))
        if (rolesRes.data) setCustomRoles(rolesRes.data as RoleItem[])
        setIsLoading(false)
    }

    const filteredMenus = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return menus
        return menus.filter(menu =>
            menu.label.toLowerCase().includes(term) ||
            menu.path.toLowerCase().includes(term)
        )
    }, [menus, search])

    const selectedRoleInfo = ROLE_OPTIONS.find(role => role.key === selectedRole)
    const selectedRoleCount = menus.filter(menu => (menu.required_roles || []).includes(selectedRole)).length
    const allMenuPaths = menus.map(menu => menu.path)

    const normalizeRolePermissions = (raw: any): UserPermissions => {
        const parsed = typeof raw === 'string' ? (() => {
            try { return JSON.parse(raw) as UserPermissions } catch { return undefined }
        })() : (raw as UserPermissions | undefined)

        return {
            menus: Array.isArray(parsed?.menus) ? parsed?.menus : allMenuPaths,
            actions: parsed?.actions || {},
            master: parsed?.master || false,
        }
    }

    const toggleMenuRole = (menuId: string) => {
        if (!canEdit) return
        setMenus(prev => prev.map(menu => {
            if (menu.id !== menuId) return menu
            const required = Array.isArray(menu.required_roles) ? menu.required_roles : []
            const hasRole = required.includes(selectedRole)
            const nextRoles = hasRole
                ? required.filter(role => role !== selectedRole)
                : [...required, selectedRole]
            return { ...menu, required_roles: nextRoles }
        }))
    }

    const handleSave = async () => {
        if (!canEdit) {
            toast.error('Sem permissão para salvar')
            return
        }

        setIsSaving(true)
        try {
            await Promise.all(
                menus.map(menu => supabase
                    .from('cms_menus')
                    .update({ required_roles: menu.required_roles || [] })
                    .eq('id', menu.id)
                )
            )
            toast.success('Permissões do menu atualizadas!')
        } catch (error: any) {
            toast.error('Erro ao salvar', { description: error.message })
        } finally {
            setIsSaving(false)
        }
    }

    const handleRemoveRole = async () => {
        if (!canEdit) return
        if (!confirm(`Remover o acesso da role "${selectedRoleInfo?.label}" de todos os menus?`)) return
        setMenus(prev => prev.map(menu => ({
            ...menu,
            required_roles: (menu.required_roles || []).filter(role => role !== selectedRole)
        })))
        await handleSave()
    }

    const openRoleCreate = () => {
        setEditingRole(null)
        setRoleForm({ label: '', key: '', description: '', is_active: true })
        setRolePermissions({ menus: allMenuPaths, actions: {}, master: false })
        setIsRoleDialogOpen(true)
    }

    const openRoleEdit = (role: RoleItem) => {
        setEditingRole(role)
        setRoleForm({
            label: role.label,
            key: role.key,
            description: role.description || '',
            is_active: role.is_active,
        })
        setRolePermissions(normalizeRolePermissions(role.permissions))
        setIsRoleDialogOpen(true)
    }

    const toggleRoleMenu = (path: string) => {
        if (!canEdit) return
        setRolePermissions(prev => {
            const menusList = prev.menus || []
            if (menusList.includes(path)) {
                return { ...prev, menus: menusList.filter(m => m !== path) }
            }
            return { ...prev, menus: [...menusList, path] }
        })
    }

    const toggleRoleAction = (resource: PermissionResource, action: PermissionAction) => {
        if (!canEdit) return
        setRolePermissions(prev => {
            const current = prev.actions?.[resource] || []
            const next = current.includes(action) ? current.filter(a => a !== action) : [...current, action]
            return { ...prev, actions: { ...prev.actions, [resource]: next } }
        })
    }

    const handleRoleSave = async () => {
        if (!canEdit) {
            toast.error('Sem permissão para salvar')
            return
        }
        if (!roleForm.label || !roleForm.key) {
            toast.error('Preencha o nome e a chave da role')
            return
        }

        setIsRoleSaving(true)
        try {
            const payload = {
                label: roleForm.label,
                key: roleForm.key,
                description: roleForm.description || null,
                is_active: roleForm.is_active,
                permissions: rolePermissions,
                updated_at: new Date().toISOString(),
            }

            if (editingRole) {
                const { error } = await supabase
                    .from('roles')
                    .update(payload)
                    .eq('id', editingRole.id)
                if (error) throw error
                toast.success('Role personalizada atualizada!')
            } else {
                const { error } = await supabase
                    .from('roles')
                    .insert([{ ...payload, created_at: new Date().toISOString() }])
                if (error) throw error
                toast.success('Role personalizada criada!')
            }

            setIsRoleDialogOpen(false)
            fetchMenus()
        } catch (error: any) {
            toast.error('Erro ao salvar role', { description: error.message })
        } finally {
            setIsRoleSaving(false)
        }
    }

    const handleRoleDelete = async (role: RoleItem) => {
        if (!canEdit) return
        if (!confirm(`Excluir a role personalizada "${role.label}"?`)) return

        setIsRoleSaving(true)
        try {
            const { error } = await supabase
                .from('roles')
                .delete()
                .eq('id', role.id)
            if (error) throw error
            toast.success('Role personalizada removida')
            setCustomRoles(prev => prev.filter(r => r.id !== role.id))
        } catch (error: any) {
            toast.error('Erro ao excluir role', { description: error.message })
        } finally {
            setIsRoleSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
                <h2 className="text-xl font-bold">Acesso restrito</h2>
                <p className="text-muted-foreground">Apenas administradores podem gerenciar roles.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Perfis de Acesso</h1>
                    <p className="text-muted-foreground mt-1">Defina quais menus cada role pode visualizar</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleRemoveRole} disabled={!canEdit}>
                        <Trash2 className="w-4 h-4 mr-2" /> Remover acesso da role
                    </Button>
                    <Button onClick={handleSave} disabled={!canEdit || isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Salvar alterações
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle>Roles do Sistema</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {ROLE_OPTIONS.map(role => (
                            <button
                                key={role.key}
                                className={`w-full text-left rounded-xl border p-3 transition-all ${selectedRole === role.key ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}
                                onClick={() => setSelectedRole(role.key)}
                                type="button"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="font-semibold">{role.label}</div>
                                    <Badge variant={selectedRole === role.key ? 'default' : 'secondary'}>
                                        {menus.filter(menu => (menu.required_roles || []).includes(role.key)).length}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                            </button>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border-slate-200">
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <CardTitle>Menus: {selectedRoleInfo?.label}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                                {selectedRoleCount} de {menus.length} menus com acesso
                            </p>
                        </div>
                        <Input
                            placeholder="Buscar menu..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="md:max-w-xs"
                        />
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2">
                            {filteredMenus.map(menu => {
                                const checked = (menu.required_roles || []).includes(selectedRole)
                                return (
                                    <label key={menu.id} className="flex items-start gap-3 border rounded-xl p-3 hover:bg-slate-50 transition-colors">
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleMenuRole(menu.id)}
                                            disabled={!canEdit}
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{menu.label}</span>
                                            <span className="text-[10px] text-muted-foreground">{menu.path}</span>
                                        </div>
                                    </label>
                                )
                            })}
                            {filteredMenus.length === 0 && (
                                <div className="text-sm text-muted-foreground text-center py-10">
                                    Nenhum menu encontrado.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <CardTitle>Roles Personalizadas</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">Crie perfis adicionais com menus e permissões próprias</p>
                    </div>
                    <Button onClick={openRoleCreate} disabled={!canEdit}>
                        <Plus className="w-4 h-4 mr-2" /> Nova Role
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    {customRoles.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-8">
                            Nenhuma role personalizada cadastrada.
                        </div>
                    )}
                    {customRoles.map(role => (
                        <div key={role.id} className="flex items-center justify-between border rounded-xl p-4">
                            <div className="flex flex-col">
                                <span className="font-semibold">{role.label}</span>
                                <span className="text-xs text-muted-foreground">{role.description}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant={role.is_active ? 'default' : 'secondary'}>
                                    {role.is_active ? 'Ativa' : 'Inativa'}
                                </Badge>
                                <Button variant="ghost" size="icon" onClick={() => openRoleEdit(role)} disabled={!canEdit}>
                                    <Pencil className="w-4 h-4 text-emerald-600" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleRoleDelete(role)} disabled={!canEdit}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? 'Editar Role Personalizada' : 'Nova Role Personalizada'}</DialogTitle>
                        <DialogDescription>Configure os dados e permissões desta role.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome da Role</Label>
                                <Input
                                    value={roleForm.label}
                                    onChange={(e) => setRoleForm(prev => ({
                                        ...prev,
                                        label: e.target.value,
                                        key: prev.key ? prev.key : slugify(e.target.value)
                                    }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Chave</Label>
                                <Input
                                    value={roleForm.key}
                                    onChange={(e) => setRoleForm(prev => ({ ...prev, key: slugify(e.target.value) }))}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Descrição</Label>
                                <Textarea
                                    value={roleForm.description}
                                    onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 md:col-span-2">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Role ativa</Label>
                                    <p className="text-[10px] text-muted-foreground">Roles inativas não são exibidas para seleção</p>
                                </div>
                                <Switch
                                    checked={roleForm.is_active}
                                    onCheckedChange={(v) => setRoleForm(prev => ({ ...prev, is_active: v }))}
                                />
                            </div>
                        </div>

                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="bg-slate-50/50">
                                <CardTitle>Menus Disponíveis</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="max-h-[240px] overflow-y-auto pr-2 space-y-2">
                                    {menus.map(menu => (
                                        <label key={menu.id} className="flex items-center gap-3 border rounded-lg p-3 text-sm">
                                            <Checkbox
                                                checked={rolePermissions.master ? true : (rolePermissions.menus || []).includes(menu.path)}
                                                onCheckedChange={() => toggleRoleMenu(menu.path)}
                                                disabled={rolePermissions.master || !canEdit}
                                            />
                                            <span>{menu.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="bg-slate-50/50">
                                <CardTitle>Permissões Granulares</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                {(Object.keys(RESOURCE_LABELS) as PermissionResource[]).map(resource => (
                                    <div key={resource} className="space-y-3">
                                        <h3 className="text-sm font-bold text-slate-700">{RESOURCE_LABELS[resource]}</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            {DEFAULT_ACTIONS.map(action => (
                                                <label key={`${resource}-${action}`} className="flex items-center gap-2 text-xs border rounded-lg p-2">
                                                    <Checkbox
                                                        checked={rolePermissions.master ? true : (rolePermissions.actions?.[resource] || []).includes(action)}
                                                        onCheckedChange={() => toggleRoleAction(resource, action)}
                                                        disabled={rolePermissions.master || !canEdit}
                                                    />
                                                    <span className="uppercase tracking-wide">{action}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold">Acesso Master</Label>
                                        <p className="text-[10px] text-muted-foreground">Libera todas as ações e menus</p>
                                    </div>
                                    <Switch
                                        checked={!!rolePermissions.master}
                                        onCheckedChange={(v) => canEdit && setRolePermissions(prev => ({ ...prev, master: v }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleRoleSave} disabled={isRoleSaving || !canEdit}>
                            {isRoleSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
