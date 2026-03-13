'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { UserPermissions, PermissionAction, PermissionResource, hasPermission } from '@/lib/permissions'
import { useAuthStore } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2, Shield } from 'lucide-react'

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

export default function ManagementPage() {
    const [users, setUsers] = useState<Profile[]>([])
    const [menus, setMenus] = useState<{ label: string; path: string }[]>([])
    const [selectedUserId, setSelectedUserId] = useState<string>('')
    const [permissions, setPermissions] = useState<UserPermissions>({ menus: [], actions: {}, master: false })
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const supabase = createClient()
    const { profile, isLoading: authLoading } = useAuthStore()
    const canView = hasPermission(profile, 'management', 'view')
    const canEdit = hasPermission(profile, 'management', 'edit')

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            const [usersRes, menusRes] = await Promise.all([
                supabase.from('profiles').select('*').order('full_name'),
                supabase.from('cms_menus').select('label, path').eq('is_active', true).order('display_order', { ascending: true }),
            ])

            if (usersRes.data) setUsers(usersRes.data)
            if (menusRes.data) setMenus(menusRes.data)
            setIsLoading(false)
        }

        fetchData()
    }, [supabase])

    const staticMenus = [
        { label: 'Gestão de Gráficos', path: '/admin/cms/charts' },
        { label: 'Meus Gráficos', path: '/admin/dashboard/my-charts' },
        { label: 'Gestão e Controle', path: '/admin/management' },
        { label: 'Status do Imóvel', path: '/admin/cms/status' },
    ]

    const allMenus = useMemo(() => {
        const unique = new Map<string, { label: string; path: string }>()
        menus.concat(staticMenus).forEach((menu) => {
            if (!unique.has(menu.path)) unique.set(menu.path, menu)
        })
        return Array.from(unique.values())
    }, [menus])

    const selectedUser = users.find(u => u.id === selectedUserId)

    useEffect(() => {
        if (!selectedUser) return

        const current = (selectedUser as any)?.permissions as UserPermissions | undefined
        const normalized: UserPermissions = {
            menus: current?.menus && current.menus.length > 0 ? current.menus : allMenus.map(m => m.path),
            actions: current?.actions || {},
            master: current?.master || false,
        }
        setPermissions(normalized)
    }, [selectedUser, allMenus])

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
        if (!selectedUserId) return
        if (!canEdit) {
            toast.error('Sem permissão para salvar alterações')
            return
        }

        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ permissions })
                .eq('id', selectedUserId)

            if (error) throw error
            toast.success('Permissões salvas!')
        } catch (error: any) {
            toast.error('Erro ao salvar permissões', { description: error.message })
        } finally {
            setIsSaving(false)
        }
    }

    if (authLoading || isLoading) {
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
                <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestão e Controle</h1>
                    <p className="text-muted-foreground mt-1">Defina acesso por usuário, menus e permissões granulares</p>
                </div>
                <Button onClick={handleSave} disabled={!selectedUserId || isSaving || !canEdit}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                    Salvar Permissões
                </Button>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50">
                    <CardTitle>Selecionar Usuário</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v ?? '')}>
                        <SelectTrigger className="w-full max-w-md">
                            <SelectValue placeholder="Escolha um usuário" />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.id}>{user.full_name || user.email}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {selectedUser && (
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Acesso Master</Label>
                                <p className="text-[10px] text-muted-foreground">Libera todas as ações e menus</p>
                            </div>
                            <Switch
                                checked={!!permissions.master}
                                onCheckedChange={(v) => canEdit && setPermissions(prev => ({ ...prev, master: v }))}
                                disabled={!canEdit}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedUser && (
                <>
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
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
