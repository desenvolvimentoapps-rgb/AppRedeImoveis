'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Plus, Settings2, Trash2, CheckCircle2, ChevronLeft, ChevronRight, Search } from 'lucide-react'

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
    const [labelEng, setLabelEng] = useState('')
    const [value, setValue] = useState('')
    const [description, setDescription] = useState('')
    const [isActive, setIsActive] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sortKey, setSortKey] = useState<'label' | 'status_label_eng' | 'value' | 'is_active'>('label')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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

    useEffect(() => {
        setPage(1)
    }, [searchTerm, pageSize])

    const handleSort = (key: typeof sortKey) => {
        if (sortKey === key) {
            setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
            return
        }
        setSortKey(key)
        setSortDir('asc')
    }

    const getSortIndicator = (key: typeof sortKey) => {
        if (sortKey !== key) return ''
        return sortDir === 'asc' ? '?' : '?'
    }

    const filteredStatuses = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return statuses
        return statuses.filter((status) => {
            const haystack = [
                status.label,
                status.status_label_eng || '',
                status.value || '',
                status.description || '',
            ].join(' ').toLowerCase()
            return haystack.includes(term)
        })
    }, [statuses, searchTerm])

    const sortedStatuses = useMemo(() => {
        const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
        const direction = sortDir === 'asc' ? 1 : -1
        const getValue = (item: PropertyStatus) => {
            if (sortKey === 'status_label_eng') return item.status_label_eng || ''
            if (sortKey === 'value') return item.value || ''
            if (sortKey === 'is_active') return item.is_active ? 'Ativo' : 'Inativo'
            return item.label || ''
        }
        return [...filteredStatuses].sort((a, b) => collator.compare(getValue(a), getValue(b)) * direction)
    }, [filteredStatuses, sortKey, sortDir])

    const totalPages = Math.max(1, Math.ceil(sortedStatuses.length / pageSize))
    const currentStatuses = sortedStatuses.slice((page - 1) * pageSize, page * pageSize)

    useEffect(() => {
        if (page > totalPages) setPage(totalPages)
    }, [page, totalPages])

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
            setLabelEng(status.status_label_eng || '')
            setValue(status.value)
            setDescription(status.description || '')
            setIsActive(status.is_active)
        } else {
            setEditingStatus(null)
            setLabel('')
            setLabelEng('')
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
                status_label_eng: labelEng.trim() || null,
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
                                <Label htmlFor="label_eng">Tradu\u00e7\u00e3o (Ingl\u00eas)</Label>
                                <Input id="label_eng" placeholder="Ex: Available" value={labelEng} onChange={e => setLabelEng(e.target.value)} />
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

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        placeholder="Pesquisar por status, tradu\u00e7\u00e3o ou valor..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Mostrar</span>
                    <select
                        className="border rounded-md px-2 py-1 bg-background text-foreground"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                    </select>
                    <span>por p?gina</span>
                </div>
            </div>

            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('label')}>
                                Status {getSortIndicator('label')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status_label_eng')}>
                                Tradu\u00e7\u00e3o (EN) {getSortIndicator('status_label_eng')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('value')}>
                                Valor {getSortIndicator('value')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('is_active')}>
                                Ativo {getSortIndicator('is_active')}
                            </TableHead>
                            <TableHead className="text-right">A\u00e7\u00f5es</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentStatuses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum status encontrado.</TableCell>
                            </TableRow>
                        ) : currentStatuses.map((status) => (
                            <TableRow key={status.id}>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-primary/60" /></TableCell>
                                <TableCell className="font-bold">{status.label}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{status.status_label_eng || '-'}</TableCell>
                                <TableCell className="font-mono text-xs">{status.value}</TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${status.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {status.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(status)} disabled={!canEdit} title={!canEdit ? 'Sem permiss?o' : 'Editar'}>
                                            <Settings2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(status.id)} disabled={!canDelete} title={!canDelete ? 'Sem permiss?o' : 'Excluir'}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 text-xs text-muted-foreground">
                    <span>Mostrando {currentStatuses.length} de {filteredStatuses.length} resultados</span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Anterior
                        </Button>
                        <span>{page} / {totalPages}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            Pr?xima
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
