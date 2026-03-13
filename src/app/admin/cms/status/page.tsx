'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { PropertyStatus } from '@/types/database'
import { DEFAULT_PROPERTY_STATUSES, normalizePropertyStatus } from '@/lib/property-status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Settings2, Trash2, CheckCircle2 } from 'lucide-react'

const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')

export default function PropertyStatusPage() {
    const [statuses, setStatuses] = useState<PropertyStatus[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingStatus, setEditingStatus] = useState<PropertyStatus | null>(null)
    const supabase = createClient()
    const { profile } = useAuthStore()
    const canView = hasPermission(profile, 'property_statuses', 'view')
    const canCreate = hasPermission(profile, 'property_statuses', 'create')
    const canEdit = hasPermission(profile, 'property_statuses', 'edit')
    const canDelete = hasPermission(profile, 'property_statuses', 'delete')

    // Form states
    const [label, setLabel] = useState('')
    const [value, setValue] = useState('')
    const [description, setDescription] = useState('')
    const [isActive, setIsActive] = useState(true)

    const fetchStatuses = async () => {
        const { data, error } = await supabase
            .from('property_statuses')
            .select('*')
            .order('label', { ascending: true })

        if (error) {
            setStatuses(DEFAULT_PROPERTY_STATUSES)
            return
        }

        if (data && data.length > 0) {
            setStatuses(data.map(normalizePropertyStatus))
        } else {
            setStatuses(DEFAULT_PROPERTY_STATUSES)
        }
    }

    useEffect(() => {
        fetchStatuses()
    }, [supabase])

    const handleOpenDialog = (status?: PropertyStatus) => {
        if (status && !canEdit) {
            toast.error('Sem permissão para editar status')
            return
        }
        if (!status && !canCreate) {
            toast.error('Sem permissão para criar status')
            return
        }

        if (status) {
            setEditingStatus(status)
            setLabel(status.label)
            setValue(status.value)
            setDescription(status.description || '')
            setIsActive(status.is_active)
        } else {
            setEditingStatus(null)
            setLabel('')
            setValue('')
            setDescription('')
            setIsActive(true)
        }
        setIsOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (editingStatus && !canEdit) {
            toast.error('Sem permissão para editar status')
            return
        }
        if (!editingStatus && !canCreate) {
            toast.error('Sem permissão para criar status')
            return
        }
        if (!label.trim()) {
            toast.error('Informe o nome do status')
            return
        }

        setIsLoading(true)

        try {
            const computedValue = value.trim() || slugify(label)
            const payload = {
                label: label.trim(),
                value: computedValue,
                description: description.trim() || null,
                is_active: isActive,
                updated_at: new Date().toISOString(),
            }

            if (editingStatus) {
                const { error } = await supabase
                    .from('property_statuses')
                    .update(payload)
                    .eq('id', editingStatus.id)
                if (error) throw error
                toast.success('Status atualizado!')
            } else {
                const { error } = await supabase.from('property_statuses').insert([payload])
                if (error) throw error
                toast.success('Status criado!')
            }

            setIsOpen(false)
            fetchStatuses()
        } catch (error: any) {
            toast.error('Erro ao salvar', { description: error.message })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!canDelete) {
            toast.error('Sem permissão para excluir status')
            return
        }
        if (!confirm('Tem certeza? Isso pode afetar imóveis vinculados.')) return

        try {
            const { error } = await supabase.from('property_statuses').delete().eq('id', id)
            if (error) throw error
            toast.success('Status excluído!')
            fetchStatuses()
        } catch (error: any) {
            toast.error('Erro ao excluir', { description: error.message })
        }
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Status do Imóvel</h1>
                    <p className="text-muted-foreground mt-1">Defina os status disponíveis para os imóveis</p>
                </div>
                <Button onClick={() => handleOpenDialog()} disabled={!canCreate} title={!canCreate ? 'Sem permissão para criar status' : undefined}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Status
                </Button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingStatus ? 'Editar Status' : 'Adicionar Novo Status'}</DialogTitle>
                            <DialogDescription>
                                Configure o rótulo e o identificador usado no sistema.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="label">Nome do Status</Label>
                                <Input id="label" placeholder="Ex: Disponível" value={label} onChange={e => setLabel(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="value">Identificador (interno)</Label>
                                <Input id="value" placeholder="ex: available" value={value} onChange={e => setValue(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Descrição (Opcional)</Label>
                                <Textarea id="description" placeholder="Breve explicação sobre este status..." value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>Ativo</Label>
                                    <p className="text-[10px] text-muted-foreground">Inativo remove da lista de seleção</p>
                                </div>
                                <Switch checked={isActive} onCheckedChange={setIsActive} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando...' : editingStatus ? 'Atualizar' : 'Criar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Ativo</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {statuses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum status cadastrado.</TableCell>
                            </TableRow>
                        ) : statuses.map((status) => (
                            <TableRow key={status.id}>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-primary/60" /></TableCell>
                                <TableCell className="font-bold">{status.label}</TableCell>
                                <TableCell className="font-mono text-xs">{status.value}</TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${status.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {status.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(status)} disabled={!canEdit} title={!canEdit ? 'Sem permissão' : 'Editar'}>
                                            <Settings2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(status.id)} disabled={!canDelete} title={!canDelete ? 'Sem permissão' : 'Excluir'}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
