'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { Partnership } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Settings2, Trash2, Search, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'

export default function ParceriasPage() {
    const [partners, setPartners] = useState<Partnership[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingPartner, setEditingPartner] = useState<Partnership | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sortKey, setSortKey] = useState<'name' | 'sort_order'>('sort_order')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    const [name, setName] = useState('')
    const [logoUrl, setLogoUrl] = useState('')
    const [linkUrl, setLinkUrl] = useState('')
    const [sortOrder, setSortOrder] = useState('0')
    const [isActive, setIsActive] = useState(true)

    const supabase = createClient()
    const { profile } = useAuthStore()
    const canCreate = hasPermission(profile, 'settings', 'create')
    const canEdit = hasPermission(profile, 'settings', 'edit')
    const canDelete = hasPermission(profile, 'settings', 'delete')

    const fetchPartners = async () => {
        const { data } = await supabase.from('partnerships').select('*').order('sort_order', { ascending: true })
        if (data) setPartners(data as Partnership[])
    }

    useEffect(() => {
        fetchPartners()
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
        return sortDir === 'asc' ? '▲' : '▼'
    }

    const filteredPartners = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return partners
        return partners.filter((partner) => {
            const haystack = [
                partner.name || '',
                partner.logo_url,
                partner.link_url || '',
            ].join(' ').toLowerCase()
            return haystack.includes(term)
        })
    }, [partners, searchTerm])

    const sortedPartners = useMemo(() => {
        const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
        const direction = sortDir === 'asc' ? 1 : -1
        const getValue = (item: Partnership) => {
            if (sortKey === 'name') return item.name || ''
            return item.sort_order?.toString() || '0'
        }
        return [...filteredPartners].sort((a, b) => collator.compare(getValue(a), getValue(b)) * direction)
    }, [filteredPartners, sortKey, sortDir])

    const totalPages = Math.max(1, Math.ceil(sortedPartners.length / pageSize))
    const currentPartners = sortedPartners.slice((page - 1) * pageSize, page * pageSize)

    useEffect(() => {
        if (page > totalPages) setPage(totalPages)
    }, [page, totalPages])

    const handleOpenDialog = (partner?: Partnership) => {
        if (partner && !canEdit) {
            toast.error('Sem permissão para editar parcerias')
            return
        }
        if (!partner && !canCreate) {
            toast.error('Sem permissão para criar parcerias')
            return
        }

        if (partner) {
            setEditingPartner(partner)
            setName(partner.name || '')
            setLogoUrl(partner.logo_url || '')
            setLinkUrl(partner.link_url || '')
            setSortOrder(String(partner.sort_order ?? 0))
            setIsActive(partner.is_active)
        } else {
            setEditingPartner(null)
            setName('')
            setLogoUrl('')
            setLinkUrl('')
            setSortOrder('0')
            setIsActive(true)
        }
        setIsOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (editingPartner && !canEdit) {
            toast.error('Sem permissão para editar parcerias')
            return
        }
        if (!editingPartner && !canCreate) {
            toast.error('Sem permissão para criar parcerias')
            return
        }
        if (!logoUrl.trim()) {
            toast.error('Logo é obrigatória')
            return
        }

        setIsLoading(true)
        try {
            const payload = {
                name: name.trim() || null,
                logo_url: logoUrl.trim(),
                link_url: linkUrl.trim() || null,
                sort_order: Number(sortOrder || 0),
                is_active: isActive,
                updated_at: new Date().toISOString(),
            }

            if (editingPartner) {
                const { error } = await supabase.from('partnerships').update(payload).eq('id', editingPartner.id)
                if (error) throw error
                toast.success('Parceria atualizada!')
            } else {
                const { error } = await supabase.from('partnerships').insert([payload])
                if (error) throw error
                toast.success('Parceria criada!')
            }

            setIsOpen(false)
            fetchPartners()
        } catch (error: any) {
            toast.error('Erro ao salvar', { description: error.message })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!canDelete) {
            toast.error('Sem permissão para excluir parcerias')
            return
        }
        if (!confirm('Tem certeza que deseja excluir esta parceria?')) return
        try {
            const { error } = await supabase.from('partnerships').delete().eq('id', id)
            if (error) throw error
            toast.success('Parceria excluída!')
            fetchPartners()
        } catch (error: any) {
            toast.error('Erro ao excluir', { description: error.message })
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Parcerias</h1>
                    <p className="text-muted-foreground mt-1">Cadastre logos e links das parcerias do site</p>
                </div>
                <Button onClick={() => handleOpenDialog()} disabled={!canCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Parceria
                </Button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-xl">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingPartner ? 'Editar Parceria' : 'Adicionar Parceria'}</DialogTitle>
                            <DialogDescription>Cadastre as logos exibidas na Home.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nome (opcional)</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Logo (URL)</Label>
                                <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Link (opcional)</Label>
                                <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Ordem</Label>
                                <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>Ativa</Label>
                                    <p className="text-[10px] text-muted-foreground">Exibir no carrossel</p>
                                </div>
                                <Switch checked={isActive} onCheckedChange={setIsActive} />
                            </div>
                            {logoUrl && (
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <ImageIcon className="w-4 h-4" />
                                    <span>Preview:</span>
                                    <img src={logoUrl} alt={name || 'Logo'} className="h-10 object-contain" />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando...' : editingPartner ? 'Atualizar' : 'Criar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        placeholder="Pesquisar parcerias..."
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
                    <span>por página</span>
                </div>
            </div>

            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-16"></TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                                Nome {getSortIndicator('name')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('sort_order')}>
                                Ordem {getSortIndicator('sort_order')}
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentPartners.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma parceria encontrada.</TableCell>
                            </TableRow>
                        ) : currentPartners.map((partner) => (
                            <TableRow key={partner.id}>
                                <TableCell>
                                    <img src={partner.logo_url} alt={partner.name || 'Logo'} className="h-8 object-contain" />
                                </TableCell>
                                <TableCell className="font-medium">{partner.name || '-'}</TableCell>
                                <TableCell>{partner.sort_order}</TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${partner.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {partner.is_active ? 'Ativa' : 'Inativa'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(partner)} disabled={!canEdit} title={!canEdit ? 'Sem permissão' : 'Editar'}>
                                            <Settings2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(partner.id)} disabled={!canDelete} title={!canDelete ? 'Sem permissão' : 'Excluir'}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 text-xs text-muted-foreground">
                    <span>Mostrando {currentPartners.length} de {filteredPartners.length} resultados</span>
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
                            Próxima
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
