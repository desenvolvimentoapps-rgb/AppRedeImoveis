'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { ConstructionPartner } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Settings2, Trash2, Search, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'

export default function ConstrutorasPage() {
    const [partners, setPartners] = useState<ConstructionPartner[]>([])
    const [propertyCounts, setPropertyCounts] = useState<Record<string, number>>({})
    const [isOpen, setIsOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingPartner, setEditingPartner] = useState<ConstructionPartner | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ConstructionPartner | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sortKey, setSortKey] = useState<'name' | 'trade_name' | 'cnpj' | 'code' | 'city' | 'uf' | 'contract_end_date'>('name')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    const supabase = createClient()
    const { profile } = useAuthStore()
    const canCreate = hasPermission(profile, 'cms_types', 'create')
    const canEdit = hasPermission(profile, 'cms_types', 'edit')
    const canDelete = hasPermission(profile, 'cms_types', 'delete')

    const [name, setName] = useState('')
    const [tradeName, setTradeName] = useState('')
    const [cnpj, setCnpj] = useState('')
    const [code, setCode] = useState('')
    const [contractValue, setContractValue] = useState('')
    const [contractStart, setContractStart] = useState('')
    const [contractEnd, setContractEnd] = useState('')
    const [city, setCity] = useState('')
    const [state, setState] = useState('')
    const [uf, setUf] = useState('')
    const [country, setCountry] = useState('')
    const [isActive, setIsActive] = useState(true)

    const fetchPartners = async () => {
        const { data } = await supabase.from('construction_partners').select('*').order('name')
        if (data) setPartners(data as ConstructionPartner[])

        const { data: props } = await supabase.from('properties').select('construction_partner_id')
        const counts: Record<string, number> = {}
        props?.forEach((row: any) => {
            if (!row.construction_partner_id) return
            counts[row.construction_partner_id] = (counts[row.construction_partner_id] || 0) + 1
        })
        setPropertyCounts(counts)
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
                partner.name,
                partner.trade_name || '',
                partner.cnpj || '',
                partner.code || '',
                partner.city || '',
                partner.uf || '',
                partner.country || '',
            ].join(' ').toLowerCase()
            return haystack.includes(term)
        })
    }, [partners, searchTerm])

    const sortedPartners = useMemo(() => {
        const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
        const direction = sortDir === 'asc' ? 1 : -1
        const getValue = (item: ConstructionPartner) => {
            if (sortKey === 'trade_name') return item.trade_name || ''
            if (sortKey === 'cnpj') return item.cnpj || ''
            if (sortKey === 'code') return item.code || ''
            if (sortKey === 'city') return item.city || ''
            if (sortKey === 'uf') return item.uf || ''
            if (sortKey === 'contract_end_date') return item.contract_end_date || ''
            return item.name || ''
        }
        return [...filteredPartners].sort((a, b) => collator.compare(getValue(a), getValue(b)) * direction)
    }, [filteredPartners, sortKey, sortDir])

    const totalPages = Math.max(1, Math.ceil(sortedPartners.length / pageSize))
    const currentPartners = sortedPartners.slice((page - 1) * pageSize, page * pageSize)

    useEffect(() => {
        if (page > totalPages) setPage(totalPages)
    }, [page, totalPages])

    const handleOpenDialog = (partner?: ConstructionPartner) => {
        if (partner && !canEdit) {
            toast.error('Sem permissão para editar construtoras')
            return
        }
        if (!partner && !canCreate) {
            toast.error('Sem permissão para criar construtoras')
            return
        }

        if (partner) {
            setEditingPartner(partner)
            setName(partner.name || '')
            setTradeName(partner.trade_name || '')
            setCnpj(partner.cnpj || '')
            setCode(partner.code || '')
            setContractValue(partner.contract_value?.toString() || '')
            setContractStart(partner.contract_start_date || '')
            setContractEnd(partner.contract_end_date || '')
            setCity(partner.city || '')
            setState(partner.state || '')
            setUf(partner.uf || '')
            setCountry(partner.country || '')
            setIsActive(partner.is_active)
        } else {
            setEditingPartner(null)
            setName('')
            setTradeName('')
            setCnpj('')
            setCode('')
            setContractValue('')
            setContractStart('')
            setContractEnd('')
            setCity('')
            setState('')
            setUf('')
            setCountry('')
            setIsActive(true)
        }
        setIsOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (editingPartner && !canEdit) {
            toast.error('Sem permissão para editar construtoras')
            return
        }
        if (!editingPartner && !canCreate) {
            toast.error('Sem permissão para criar construtoras')
            return
        }
        if (!name.trim()) {
            toast.error('Nome da construtora é obrigatório')
            return
        }

        setIsLoading(true)
        try {
            const payload = {
                name: name.trim(),
                trade_name: tradeName.trim() || null,
                cnpj: cnpj.trim() || null,
                code: code.trim() || null,
                contract_value: contractValue ? Number(contractValue.replace(',', '.')) : null,
                contract_start_date: contractStart || null,
                contract_end_date: contractEnd || null,
                city: city.trim() || null,
                state: state.trim() || null,
                uf: uf.trim() || null,
                country: country.trim() || null,
                is_active: isActive,
                updated_at: new Date().toISOString(),
            }

            if (editingPartner) {
                const { error } = await supabase.from('construction_partners').update(payload).eq('id', editingPartner.id)
                if (error) throw error
                toast.success('Construtora atualizada!')
            } else {
                const { error } = await supabase.from('construction_partners').insert([payload])
                if (error) throw error
                toast.success('Construtora criada!')
            }

            setIsOpen(false)
            fetchPartners()
        } catch (error: any) {
            toast.error('Erro ao salvar', { description: error.message })
        } finally {
            setIsLoading(false)
        }
    }

    const openDeleteDialog = (partner: ConstructionPartner) => {
        if (!canDelete) {
            toast.error('Sem permissão para excluir construtoras')
            return
        }
        setDeleteTarget(partner)
        setDeleteConfirm('')
        setIsDeleteOpen(true)
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        if (deleteConfirm.trim().toLowerCase() !== 'deletar') {
            toast.error('Digite "deletar" para confirmar')
            return
        }
        try {
            const { error } = await supabase.from('construction_partners').delete().eq('id', deleteTarget.id)
            if (error) throw error
            toast.success('Construtora excluída!')
            setIsDeleteOpen(false)
            setDeleteTarget(null)
            fetchPartners()
        } catch (error: any) {
            toast.error('Erro ao excluir', { description: error.message })
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Construtoras</h1>
                    <p className="text-muted-foreground mt-1">Cadastre e gerencie construtoras parceiras</p>
                </div>
                <Button onClick={() => handleOpenDialog()} disabled={!canCreate} title={!canCreate ? 'Sem permissão para criar' : undefined}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Construtora
                </Button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingPartner ? 'Editar Construtora' : 'Adicionar Construtora'}</DialogTitle>
                            <DialogDescription>Preencha os dados da construtora parceira.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label>Nome da Construtora</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Nome Fantasia</Label>
                                <Input value={tradeName} onChange={e => setTradeName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>CNPJ</Label>
                                <Input value={cnpj} onChange={e => setCnpj(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Código</Label>
                                <Input value={code} onChange={e => setCode(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Valor do Contrato</Label>
                                <Input value={contractValue} onChange={e => setContractValue(e.target.value)} placeholder="ex: 2500000" />
                            </div>
                            <div className="space-y-2">
                                <Label>Início do Contrato</Label>
                                <Input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Fim do Contrato</Label>
                                <Input type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cidade</Label>
                                <Input value={city} onChange={e => setCity(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Estado</Label>
                                <Input value={state} onChange={e => setState(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>UF</Label>
                                <Input value={uf} onChange={e => setUf(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>País</Label>
                                <Input value={country} onChange={e => setCountry(e.target.value)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg md:col-span-2">
                                <div className="space-y-0.5">
                                    <Label>Ativa</Label>
                                    <p className="text-[10px] text-muted-foreground">Controla disponibilidade no cadastro</p>
                                </div>
                                <Switch checked={isActive} onCheckedChange={setIsActive} />
                            </div>
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

            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>Digite "deletar" para confirmar a exclusão da construtora.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label>Confirmação</Label>
                        <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="digite deletar" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        placeholder="Pesquisar por nome, CNPJ, cidade..."
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
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                                Nome {getSortIndicator('name')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('trade_name')}>
                                Nome Fantasia {getSortIndicator('trade_name')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('cnpj')}>
                                CNPJ {getSortIndicator('cnpj')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('code')}>
                                Código {getSortIndicator('code')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('city')}>
                                Cidade {getSortIndicator('city')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('uf')}>
                                UF {getSortIndicator('uf')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('contract_end_date')}>
                                Fim do Contrato {getSortIndicator('contract_end_date')}
                            </TableHead>
                            <TableHead>Imóveis</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentPartners.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Nenhuma construtora encontrada.</TableCell>
                            </TableRow>
                        ) : currentPartners.map((partner) => (
                            <TableRow key={partner.id}>
                                <TableCell><Building2 className="w-4 h-4 text-primary/60" /></TableCell>
                                <TableCell className="font-bold">{partner.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{partner.trade_name || '-'}</TableCell>
                                <TableCell className="font-mono text-xs">{partner.cnpj || '-'}</TableCell>
                                <TableCell className="font-mono text-xs">{partner.code || '-'}</TableCell>
                                <TableCell className="text-sm">{partner.city || '-'}</TableCell>
                                <TableCell className="text-sm">{partner.uf || '-'}</TableCell>
                                <TableCell className="text-sm">{partner.contract_end_date || '-'}</TableCell>
                                <TableCell className="text-sm font-semibold">{propertyCounts[partner.id] || 0}</TableCell>
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
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(partner)} disabled={!canDelete} title={!canDelete ? 'Sem permissão' : 'Excluir'}>
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
