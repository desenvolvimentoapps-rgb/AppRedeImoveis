'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, UserRole } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Shield, UserCog, Mail, Phone, Trash2, UserPlus, Loader2, Key, Pencil, ShieldAlert, KeyRound } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export default function UsersPage() {
    const [users, setUsers] = useState<Profile[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'corretor' as UserRole, phone: '', forceReset: false })
    const [editingUser, setEditingUser] = useState<Profile | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        setIsLoading(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name')

        if (error) {
            toast.error('Erro ao carregar usuÃ¡rios')
        } else {
            setUsers(data || [])
        }
        setIsLoading(false)
    }

    const handleCreateUser = async () => {
        if (!newUser.email || !newUser.password || !newUser.fullName) {
            toast.error('Preencha os campos obrigatÃ³rios')
            return
        }

        setIsActionLoading(true)
        try {
            // In a real production app with restricted permissions, you'd use a service role via an Edge Function
            // to create users in auth.users. For this dev environment, we assume the user has enough permission
            // or the profiles table has a trigger to handle sync if needed.
            // Note: client-side signUp creates a session. We use signUp for now.
            const { data, error: authError } = await supabase.auth.signUp({
                email: newUser.email,
                password: newUser.password,
                options: {
                    data: {
                        full_name: newUser.fullName,
                        role: newUser.role,
                        phone: newUser.phone,
                        force_password_reset: newUser.forceReset
                    }
                }
            })

            if (authError) throw authError

            toast.success('UsuÃ¡rio criado com sucesso!')
            setIsCreateOpen(false)
            setNewUser({ fullName: '', email: '', password: '', role: 'corretor', phone: '', forceReset: false })
            fetchUsers()
        } catch (error: any) {
            toast.error('Erro ao criar usuÃ¡rio', { description: error.message })
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleUpdateUser = async () => {
        if (!editingUser) return
        setIsActionLoading(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editingUser.full_name,
                    role: editingUser.role,
                    phone: editingUser.phone,
                    force_password_reset: (editingUser as any).force_password_reset
                })
                .eq('id', editingUser.id)

            if (error) throw error

            toast.success('UsuÃ¡rio atualizado com sucesso!')
            setIsEditOpen(false)
            fetchUsers()
        } catch (error: any) {
            toast.error('Erro ao atualizar usuÃ¡rio', { description: error.message })
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleUpdateRole = async (userId: string, newRole: UserRole) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId)

            if (error) throw error

            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
            toast.success('PermissÃ£o atualizada!')
        } catch (error: any) {
            toast.error('Erro ao atualizar permissÃ£o', { description: error.message })
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Tem certeza que deseja remover este usuÃ¡rio? O acesso serÃ¡ revogado.')) return

        setIsActionLoading(true)
        try {
            // Deleting the profile. Auth deletion usually requires service role.
            const { error } = await supabase.from('profiles').delete().eq('id', userId)
            if (error) throw error

            setUsers(users.filter(u => u.id !== userId))
            toast.success('UsuÃ¡rio removido do sistema.')
        } catch (error: any) {
            toast.error('Erro ao remover usuÃ¡rio', { description: error.message })
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleResetPasswordEmail = async (email: string) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/admin/reset-password`,
            })
            if (error) throw error
            toast.success('E-mail de redefiniÃ§Ã£o enviado!')
        } catch (error: any) {
            toast.error('Erro ao enviar e-mail', { description: error.message })
        }
    }

    const toggleForceReset = async (user: Profile) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ force_password_reset: !user.force_password_reset })
                .eq('id', user.id)

            if (error) throw error
            setUsers(users.map(u => u.id === user.id ? { ...u, force_password_reset: !u.force_password_reset } : u))
            toast.success('Status de redefiniÃ§Ã£o atualizado!')
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

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">UsuÃ¡rios e PermissÃµes</h1>
                    <p className="text-muted-foreground mt-1">Gerencie os acessos do painel administrativo</p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger
                        render={
                            <Button className="gap-2">
                                <UserPlus className="w-4 h-4" /> Novo UsuÃ¡rio
                            </Button>
                        }
                    />
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Cadastrar Novo UsuÃ¡rio</DialogTitle>
                            <DialogDescription>
                                Prepare as credenciais de acesso para o novo colaborador.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Nome Completo</Label>
                                <Input
                                    placeholder="Ex: JoÃ£o Silva"
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
                                <Label>Senha TemporÃ¡ria</Label>
                                <Input
                                    type="password"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold">ForÃ§ar Reset de Senha</Label>
                                    <p className="text-[10px] text-muted-foreground">Exigir nova senha no primeiro login</p>
                                </div>
                                <Switch
                                    checked={newUser.forceReset}
                                    onCheckedChange={v => setNewUser({ ...newUser, forceReset: v })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>NÃ­vel de Acesso</Label>
                                    <Select
                                        defaultValue={newUser.role}
                                        onValueChange={v => setNewUser({ ...newUser, role: (v as UserRole) || 'corretor' })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hakunaadm">Admin</SelectItem>
                                            <SelectItem value="gestaoimoveis">Gestor</SelectItem>
                                            <SelectItem value="corretor">Corretor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
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
                            <Button onClick={handleCreateUser} disabled={isActionLoading}>
                                {isActionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Criar UsuÃ¡rio
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead>UsuÃ¡rio</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>PermissÃ£o</TableHead>
                            <TableHead className="text-right">AÃ§Ãµes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : users.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-10 italic text-muted-foreground">Nenhum usuÃ¡rio encontrado.</TableCell></TableRow>
                        ) : users.map((user) => (
                            <TableRow key={user.id} className="hover:bg-slate-50/30 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                                            {user.full_name?.charAt(0) || <Shield className="w-4 h-4" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">{user.full_name || 'UsuÃ¡rio'}</span>
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
                                            defaultValue={user.role}
                                            onValueChange={(v) => v && handleUpdateRole(user.id, v as UserRole)}
                                        >
                                            <SelectTrigger className="h-7 text-[10px] w-[140px] bg-slate-50/50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="hakunaadm">Administrador</SelectItem>
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
                                            title="ForÃ§ar AlteraÃ§Ã£o de Senha"
                                        >
                                            <ShieldAlert className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                            onClick={() => user.email && handleResetPasswordEmail(user.email)}
                                            title="Enviar E-mail de RedefiniÃ§Ã£o"
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
                                            disabled={isActionLoading}
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDeleteUser(user.id)}
                                            disabled={isActionLoading}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar UsuÃ¡rio</DialogTitle>
                        <DialogDescription>
                            Atualize as informaÃ§Ãµes do colaborador abaixo.
                        </DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Nome Completo</Label>
                                <Input
                                    value={editingUser.full_name || ''}
                                    onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>NÃ­vel de Acesso</Label>
                                    <Select
                                        value={editingUser.role}
                                        onValueChange={v => setEditingUser({ ...editingUser, role: (v as UserRole) || editingUser.role })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hakunaadm">Admin</SelectItem>
                                            <SelectItem value="gestaoimoveis">Gestor</SelectItem>
                                            <SelectItem value="corretor">Corretor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Telefone</Label>
                                    <Input
                                        value={editingUser.phone || ''}
                                        onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 border-orange-100">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold text-orange-900">ForÃ§ar Reset de Senha</Label>
                                    <p className="text-[10px] text-orange-700">O usuÃ¡rio deverÃ¡ trocar a senha no prÃ³ximo acesso</p>
                                </div>
                                <Switch
                                    checked={(editingUser as any).force_password_reset}
                                    onCheckedChange={v => setEditingUser({ ...editingUser, force_password_reset: v } as any)}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={handleUpdateUser} disabled={isActionLoading}>
                            {isActionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Salvar AlteraÃ§Ãµes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
