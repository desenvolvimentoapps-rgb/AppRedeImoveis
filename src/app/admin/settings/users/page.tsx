'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, UserRole, RoleDefinition } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Shield, Phone, Trash2, UserPlus, Loader2, Pencil, ShieldAlert, KeyRound } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/hooks/useAuth'
import { canManageUser, hasPermission } from '@/lib/permissions'

type NewUserForm = {
    fullName: string
    email: string
    password: string
    role: UserRole | ''
    roleId: string
    phone: string
    forceReset: boolean
}

export default function UsersPage() {
    const [users, setUsers] = useState<Profile[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newUser, setNewUser] = useState<NewUserForm>({
        fullName: '',
        email: '',
        password: '',
        role: '',
        roleId: '',
        phone: '',
        forceReset: false
    })
    const [editingUser, setEditingUser] = useState<Profile | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isResetOpen, setIsResetOpen] = useState(false)
    const [resetUser, setResetUser] = useState<Profile | null>(null)
    const [resetPassword, setResetPassword] = useState('')
    const [resetForceReset, setResetForceReset] = useState(true)
    const [roles, setRoles] = useState<RoleDefinition[]>([])

    const { profile } = useAuthStore()
    const supabase = createClient()
    const canCreateUsers = hasPermission(profile, 'users', 'create')
    const canEditUsers = hasPermission(profile, 'users', 'edit')
    const canDeleteUsers = hasPermission(profile, 'users', 'delete')
    const canResetUsers = hasPermission(profile, 'users', 'edit')
    const isAdmin = profile?.role === 'hakunaadm'

    useEffect(() => {
        if (profile) {
            fetchUsers()
            fetchRoles()
        }
    }, [profile])

    const fetchRoles = async () => {
        const { data, error } = await supabase
            .from('roles')
            .select('id, key, label, description, permissions, is_active')
            .order('label')

        if (!error) {
            setRoles(data || [])
        }
    }

    const fetchUsers = async () => {
        setIsLoading(true)
        let query = supabase
            .from('profiles')
            .select('*')
            .order('full_name')

        if (!isAdmin) {
            query = query.neq('role', 'hakunaadm')
        }

        const { data, error } = await query

        if (error) {
            toast.error('Erro ao carregar usuários')
        } else {
            setUsers(data || [])
        }
        setIsLoading(false)
    }

    const handleCreateUser = async () => {
        if (!canCreateUsers) {
            toast.error('Sem permissão para criar usuários')
            return
        }
        if (!newUser.email || !newUser.password || !newUser.fullName) {
            toast.error('Preencha os campos obrigatorios')
            return
        }
        if (!newUser.role) {
            toast.error('Selecione o nivel de acesso')
            return
        }
        if (newUser.role === 'hakunaadm' && !isAdmin) {
            toast.error('Apenas administradores podem criar outros administradores')
            return
        }
        if (newUser.roleId && !isAdmin) {
            toast.error('Apenas administradores podem definir roles personalizadas')
            return
        }

        setIsActionLoading(true)
        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: newUser.fullName,
                    email: newUser.email,
                    password: newUser.password,
                    role: newUser.role,
                    roleId: newUser.roleId || null,
                    phone: newUser.phone,
                    forceReset: newUser.forceReset,
                }),
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Falha ao criar usuário')
            }

            toast.success('Usuário criado com sucesso!')
            setIsCreateOpen(false)
            setNewUser({ fullName: '', email: '', password: '', role: '', roleId: '', phone: '', forceReset: false })
            fetchUsers()
        } catch (error: any) {
            toast.error('Erro ao criar usuário', { description: error.message })
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleUpdateUser = async () => {
        if (!editingUser) return
        if (!canEditUsers) {
            toast.error('Sem permissão para editar usuários')
            return
        }
        if (!canManageUser(profile, editingUser)) {
            toast.error('Sem permissão para editar este usuário')
            return
        }
        if (editingUser.role === 'hakunaadm' && !isAdmin) {
            toast.error('Apenas administradores podem atribuir nível de administrador')
            return
        }
        if ((editingUser as any).role_id && !isAdmin) {
            toast.error('Apenas administradores podem atribuir roles personalizadas')
            return
        }
        setIsActionLoading(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editingUser.full_name,
                    role: editingUser.role,
                    role_id: (editingUser as any).role_id || null,
                    phone: editingUser.phone,
                    force_password_reset: (editingUser as any).force_password_reset
                })
                .eq('id', editingUser.id)

            if (error) throw error

            toast.success('Usuário atualizado com sucesso!')
            setIsEditOpen(false)
            fetchUsers()
        } catch (error: any) {
            toast.error('Erro ao atualizar usuário', { description: error.message })
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleUpdateRole = async (userId: string, newRole: UserRole) => {
        if (!canEditUsers) {
            toast.error('Sem permissão para alterar níveis')
            return
        }
        if (newRole === 'hakunaadm' && !isAdmin) {
            toast.error('Apenas administradores podem atribuir nível de administrador')
            return
        }
        const target = users.find(u => u.id === userId)
        if (!canManageUser(profile, target)) {
            toast.error('Sem permissão para alterar este usuário')
            return
        }
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId)

            if (error) throw error

            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
            toast.success('Permissão atualizada!')
        } catch (error: any) {
            toast.error('Erro ao atualizar permissão', { description: error.message })
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!canDeleteUsers) {
            toast.error('Sem permissão para excluir usuários')
            return
        }
        const target = users.find(u => u.id === userId)
        if (!canManageUser(profile, target)) {
            toast.error('Sem permissão para excluir este usuário')
            return
        }
        if (!confirm('Tem certeza que deseja remover este usuário? O acesso será revogado.')) return

        setIsActionLoading(true)
        try {
            // Deleting the profile. Auth deletion usually requires service role.
            const { error } = await supabase.from('profiles').delete().eq('id', userId)
            if (error) throw error

            setUsers(users.filter(u => u.id !== userId))
            toast.success('Usuário removido do sistema.')
        } catch (error: any) {
            toast.error('Erro ao remover usuário', { description: error.message })
        } finally {
            setIsActionLoading(false)
        }
    }

    const openResetDialog = (user: Profile) => {
        setResetUser(user)
        setResetPassword('')
        setResetForceReset(true)
        setIsResetOpen(true)
    }

    const handleResetPassword = async () => {
        if (!resetUser || !resetPassword) {
            toast.error('Informe a nova senha temporária')
            return
        }
        if (!canResetUsers) {
            toast.error('Sem permissão para resetar senha')
            return
        }
        if (!canManageUser(profile, resetUser)) {
            toast.error('Sem permissão para resetar este usuário')
            return
        }

        setIsActionLoading(true)
        try {
            const response = await fetch('/api/admin/users/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: resetUser.id,
                    newPassword: resetPassword,
                    forceReset: resetForceReset,
                }),
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Falha ao resetar senha')
            }

            toast.success('Senha temporária atualizada!')
            setIsResetOpen(false)
            fetchUsers()
        } catch (error: any) {
            toast.error('Erro ao resetar senha', { description: error.message })
        } finally {
            setIsActionLoading(false)
        }
    }

    const toggleForceReset = async (user: Profile) => {
        if (!canEditUsers) {
            toast.error('Sem permissão para alterar este usuário')
            return
        }
        if (!canManageUser(profile, user)) {
            toast.error('Sem permissão para alterar este usuário')
            return
        }
        try {
            const response = await fetch('/api/admin/users/force-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, forceReset: !user.force_password_reset }),
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Falha ao atualizar status')
            }
            setUsers(users.map(u => u.id === user.id ? { ...u, force_password_reset: !u.force_password_reset } : u))
            toast.success('Status de redefinição atualizado!')
        } catch (error: any) {
            toast.error('Erro ao atualizar status', { description: error.message })
        }
    }

    const getRoleBadge = (role: UserRole) => {
        const variants: Record<UserRole, any> = {
            hakunaadm: { label: 'Administrador', variant: 'destructive' },
            gestaoimoveis: { label: 'Gestor', variant: 'default' },
            corretor: { label: 'Corretor', variant: 'secondary' },
        }
        const s = variants[role] || { label: role, variant: 'outline' }
        return <Badge variant={s.variant}>{s.label}</Badge>
    }

    const canEditDialog = !!editingUser && canEditUsers && canManageUser(profile, editingUser)

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Usuários e Permissões</h1>
                    <p className="text-muted-foreground mt-1">Gerencie os acessos do painel administrativo</p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger
                        render={
                            <Button
                                className="gap-2"
                                disabled={!canCreateUsers}
                                title={!canCreateUsers ? 'Sem permissão para criar usuários' : undefined}
                            >
                                <UserPlus className="w-4 h-4" /> Novo Usuário
                            </Button>
                        }
                    />
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                            <DialogDescription>
                                Prepare as credenciais de acesso para o novo colaborador.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Nome Completo</Label>
                                <Input
                                    placeholder="Ex: João Silva"
                                    value={newUser.fullName}
                                    onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>E-mail</Label>
                                <Input
                                    type="email"
                                    placeholder="joao@exemplo.com"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Senha Temporária</Label>
                                <Input
                                    type="text"
                                    autoComplete="new-password"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">Forçar Reset de Senha</Label>
                                    <p className="text-[10px] text-muted-foreground">Exigir nova senha no primeiro login</p>
                                </div>
                                <Switch
                                    checked={newUser.forceReset}
                                    onCheckedChange={v => setNewUser({ ...newUser, forceReset: v })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nível de Acesso</Label>
                                    <Select
                                        value={newUser.role}
                                        onValueChange={(v) => setNewUser({ ...newUser, role: v as UserRole })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                            {isAdmin && <SelectItem value="hakunaadm">Administrador</SelectItem>}
                                            <SelectItem value="gestaoimoveis">Gestor</SelectItem>
                                            <SelectItem value="corretor">Corretor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {isAdmin && (
                                    <div className="space-y-2">
                                        <Label>Role personalizada</Label>
                                        <Select
                                            value={newUser.roleId || 'none'}
                                            onValueChange={(v) => setNewUser({ ...newUser, roleId: v === 'none' ? '' : (v ?? '') })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sem role personalizada</SelectItem>
                                                {roles.filter(r => r.is_active !== false).map(role => (
                                                    <SelectItem key={role.id} value={role.id}>{role.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Telefone</Label>
                                    <Input
                                        placeholder="419..."
                                        value={newUser.phone}
                                        onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreateUser} disabled={isActionLoading || !canCreateUsers}>
                                {isActionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Criar Usuário
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead>Usuário</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>Permissão</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : users.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-10 italic text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
                        ) : users.map((user) => {
                            const canManage = canManageUser(profile, user)
                            const canEditRow = canEditUsers && canManage
                            const canDeleteRow = canDeleteUsers && canManage
                            const canResetRow = canResetUsers && canManage
                            return (
                            <TableRow key={user.id} className="hover:bg-slate-50/30 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                                            {user.full_name?.charAt(0) || <Shield className="w-4 h-4" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">{user.full_name || 'Usuário'}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono lowercase tracking-tight">{user.email}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {user.phone || 'N/A'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-2">
                                        {getRoleBadge(user.role)}
                                        <Select
                                            value={user.role}
                                            onValueChange={(v) => v && canEditRow && handleUpdateRole(user.id, v as UserRole)}
                                            disabled={!canEditRow}
                                        >
                                            <SelectTrigger className="h-7 text-[10px] w-[140px] bg-slate-50/50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {isAdmin && <SelectItem value="hakunaadm">Administrador</SelectItem>}
                                                <SelectItem value="gestaoimoveis">Gestor</SelectItem>
                                                <SelectItem value="corretor">Corretor</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`h-8 w-8 p-0 ${user.force_password_reset ? 'text-amber-500 bg-amber-50' : 'text-slate-400'} hover:text-amber-600 hover:bg-amber-100`}
                                            onClick={() => toggleForceReset(user)}
                                            disabled={!canEditRow}
                                            title="Forçar Alteração de Senha"
                                        >
                                            <ShieldAlert className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                            onClick={() => openResetDialog(user)}
                                            disabled={!canResetRow}
                                            title="Resetar senha manualmente"
                                        >
                                            <KeyRound className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-600 hover:bg-slate-50"
                                            onClick={() => {
                                                setEditingUser(user)
                                                setIsEditOpen(true)
                                            }}
                                            disabled={!canEditRow || isActionLoading}
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDeleteUser(user.id)}
                                            disabled={!canDeleteRow || isActionLoading}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar Usuário</DialogTitle>
                        <DialogDescription>
                            Atualize as informações do colaborador abaixo.
                        </DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Nome Completo</Label>
                                <Input
                                    value={editingUser.full_name || ''}
                                    onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                    disabled={!canEditDialog}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nível de Acesso</Label>
                                    <Select
                                        value={editingUser.role}
                                        onValueChange={v => setEditingUser({ ...editingUser, role: (v as UserRole) || editingUser.role })}
                                        disabled={!canEditDialog}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {isAdmin && <SelectItem value="hakunaadm">Administrador</SelectItem>}
                                            <SelectItem value="gestaoimoveis">Gestor</SelectItem>
                                            <SelectItem value="corretor">Corretor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {isAdmin && (
                                    <div className="space-y-2">
                                        <Label>Role personalizada</Label>
                                        <Select
                                            value={(editingUser as any).role_id || 'none'}
                                            onValueChange={v => setEditingUser({ ...(editingUser as any), role_id: v === 'none' ? null : v } as any)}
                                            disabled={!canEditDialog}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sem role personalizada</SelectItem>
                                                {roles.filter(r => r.is_active !== false).map(role => (
                                                    <SelectItem key={role.id} value={role.id}>{role.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Telefone</Label>
                                    <Input
                                        value={editingUser.phone || ''}
                                        onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })}
                                        disabled={!canEditDialog}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 border-orange-100">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold text-orange-900">Forçar Reset de Senha</Label>
                                    <p className="text-[10px] text-orange-700">O usuário deverá trocar a senha no próximo acesso</p>
                                </div>
                                <Switch
                                    checked={(editingUser as any).force_password_reset}
                                    onCheckedChange={v => setEditingUser({ ...editingUser, force_password_reset: v } as any)}
                                    disabled={!canEditDialog}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={handleUpdateUser} disabled={isActionLoading || !canEditDialog}>
                            {isActionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Resetar Senha</DialogTitle>
                        <DialogDescription>
                            Defina uma nova senha temporária para o usuário selecionado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {resetUser && (
                            <div className="text-xs text-muted-foreground">
                                {resetUser.full_name} ({resetUser.email})
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Nova Senha Temporária</Label>
                            <Input
                                type="text"
                                autoComplete="new-password"
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-amber-50">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-amber-900">Resetar no próximo login</Label>
                                <p className="text-[10px] text-amber-700">O usuário será obrigado a trocar a senha</p>
                            </div>
                            <Switch checked={resetForceReset} onCheckedChange={(v) => setResetForceReset(v)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleResetPassword} disabled={isActionLoading || !canResetUsers}>
                            {isActionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirmar Reset
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
