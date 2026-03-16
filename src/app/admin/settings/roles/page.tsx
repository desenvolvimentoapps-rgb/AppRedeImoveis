'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/hooks/useAuth'
import { UserPermissions, PermissionAction, PermissionResource, hasPermission } from '@/lib/permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Pencil, Trash2, Shield } from 'lucide-react'
import { toast } from 'sonner'

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

    const [roles, setRoles] = useState<RoleItem[]>([])
    const [menus, setMenus] = useState<{ label: string; path: string }[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
    const [roleForm, setRoleForm] = useState({ label: '', key: '', description: '', is_active: true })
    const [permissions, setPermissions] = useState<UserPermissions>({ menus: [], actions: {}, master: false })

    useEffect(() => {
        if (profile) {
            fetchData()
        }
    }, [profile])

    const fetchData = async () => {
        setIsLoading(true)
        const [rolesRes, menusRes] = await Promise.all([
            supabase.from('roles').select('*').order('label'),
            supabase.from('cms_menus').select('label, path').eq('is_active', true).order('display_order', { ascending: true }),
        ])

        if (rolesRes.data) setRoles(rolesRes.data as RoleItem[])
        if (menusRes.data) setMenus(menusRes.data)
        setIsLoading(false)
    }

    const staticMenus = [
        { label: 'Gestão de Gráficos', path: '/admin/cms/charts' },
        { label: 'Meus Gráficos', path: '/admin/dashboard/my-charts' },
        { label: 'Gestão e Controle', path: '/admin/management' },
        { label: 'Status do Imóvel', path: '/admin/cms/status' },
        { label: 'Construtoras', path: '/admin/cms/construtoras' },
        { label: 'FAQ', path: '/admin/settings/faq' },
        { label: 'Parcerias', path: '/admin/settings/parcerias' },
        { label: 'Perfis de Acesso', path: '/admin/settings/roles' },
    ]

    const allMenus = useMemo(() => {
        const unique = new Map<string, { label: string; path: string }>()
        menus.concat(staticMenus).forEach((menu) => {
            if (!unique.has(menu.path)) unique.set(menu.path, menu)
        })
        return Array.from(unique.values())
    }, [menus])

    const normalizePermissions = (raw: any): UserPermissions => {
        const parsed = typeof raw === 'string' ? (() => {
            try { return JSON.parse(raw) as UserPermissions } catch { return undefined }
        })() : (raw as UserPermissions | undefined)
        return {
            menus: parsed?.menus && parsed.menus.length > 0 ? parsed.menus : allMenus.map(m => m.path),
            actions: parsed?.actions || {},
            master: parsed?.master || false,
        }
    }

    const openCreate = () => {
        setEditingRole(null)
        setRoleForm({ label: '', key: '', description: '', is_active: true })
        setPermissions({
            menus: allMenus.map(m => m.path),
            actions: {},
            master: false,
        })
        setIsDialogOpen(true)
    }

    const openEdit = (role: RoleItem) => {
        setEditingRole(role)
        setRoleForm({
            label: role.label,
            key: role.key,
            description: role.description || '',
            is_active: role.is_active,
        })
        setPermissions(normalizePermissions(role.permissions))
        setIsDialogOpen(true)
    }

    const toggleMenu = (path: string) => {
        if (!canEdit) return
        setPermissions(prev => {
            const menusList = prev.menus || []
            if (menusList.includes(path)) {
                return { ...prev, menus: menusList.filter(m => m !== path) }
            }
            return { ...prev, menus: [...menusList, path] }
        })
    }

    const toggleAction = (resource: PermissionResource, action: PermissionAction) => {
        if (!canEdit) return
        setPermissions(prev => {
            const current = prev.actions?.[resource] || []
            const next = current.includes(action) ? current.filter(a => a !== action) : [...current, action]
            return { ...prev, actions: { ...prev.actions, [resource]: next } }
        })
    }

    const handleSave = async () => {
        if (!canEdit) {
            toast.error('Sem permissão para salvar')
            return
        }

        if (!roleForm.label || !roleForm.key) {
            toast.error('Preencha o nome e a chave da role')
            return
        }

        setIsSaving(true)
        try {
            const payload = {
                label: roleForm.label,
                key: roleForm.key,
                description: roleForm.description || null,
                is_active: roleForm.is_active,
                permissions,
                updated_at: new Date().toISOString(),
            }

            if (editingRole) {
                const { error } = await supabase
                    .from('roles')
                    .update(payload)
                    .eq('id', editingRole.id)

                if (error) throw error
                toast.success('Role atualizada!')
            } else {
                const { error } = await supabase
                    .from('roles')
                    .insert([{ ...payload, created_at: new Date().toISOString() }])

                if (error) throw error
                toast.success('Role criada!')
            }

            setIsDialogOpen(false)
            fetchData()
        } catch (error: any) {
            toast.error('Erro ao salvar role', { description: error.message })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (role: RoleItem) => {
        if (!canEdit) {
            toast.error('Sem permissão para excluir')
            return
        }
        if (!confirm(`Excluir a role "${role.label}"?`)) return

        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('roles')
                .delete()
                .eq('id', role.id)

            if (error) throw error
            toast.success('Role removida')
            setRoles(prev => prev.filter(r => r.id !== role.id))
        } catch (error: any) {
            toast.error('Erro ao excluir role', { description: error.message })
        } finally {
            setIsSaving(false)
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Perfis de Acesso</h1>
                    <p className="text-muted-foreground mt-1">Defina roles e permissões padrão por grupo</p>
                </div>
                <Button onClick={openCreate} disabled={!canEdit}>
                    <Plus className="w-4 h-4 mr-2" /> Nova Role
                </Button>
            </div>

            <Card className="shadow-sm border-slate-200">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead>Role</TableHead>
                            <TableHead>Chave</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {roles.map(role => (
                            <TableRow key={role.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-semibold">{role.label}</span>
                                        <span className="text-xs text-muted-foreground">{role.description}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{role.key}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={role.is_active ? 'default' : 'secondary'}>
                                        {role.is_active ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(role)} disabled={!canEdit}>
                                            <Pencil className="w-4 h-4 text-emerald-600" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(role)} disabled={!canEdit}>
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {roles.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                                    Nenhuma role cadastrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? 'Editar Role' : 'Nova Role'}</DialogTitle>
                        <DialogDescription>Configure os dados e permissões padrão desta role.</DialogDescription>
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
                            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {allMenus.map(menu => (
                                    <label key={menu.path} className="flex items-center gap-3 border rounded-lg p-3 text-sm">
                                        <Checkbox
                                            checked={permissions.master ? true : (permissions.menus || []).includes(menu.path)}
                                            onCheckedChange={() => toggleMenu(menu.path)}
                                            disabled={permissions.master || !canEdit}
                                        />
                                        <span>{menu.label}</span>
                                    </label>
                                ))}
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
                                                        checked={permissions.master ? true : (permissions.actions?.[resource] || []).includes(action)}
                                                        onCheckedChange={() => toggleAction(resource, action)}
                                                        disabled={permissions.master || !canEdit}
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
                                        checked={!!permissions.master}
                                        onCheckedChange={(v) => canEdit && setPermissions(prev => ({ ...prev, master: v }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving || !canEdit}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                            Salvar Role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
