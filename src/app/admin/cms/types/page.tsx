'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { PropertyType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Settings2, Trash2, Home, ChevronLeft, ChevronRight, Search } from 'lucide-react'

export default function PropertyTypesPage() {
    const [types, setTypes] = useState<PropertyType[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingType, setEditingType] = useState<PropertyType | null>(null)
    const supabase = createClient()
    const { profile } = useAuthStore()
    const canCreate = hasPermission(profile, 'cms_types', 'create')
    const canEdit = hasPermission(profile, 'cms_types', 'edit')
    const canDelete = hasPermission(profile, 'cms_types', 'delete')

    // Form states
    const [name, setName] = useState('')
    const [nameEng, setNameEng] = useState('')
    const [description, setDescription] = useState('')
    const [isActive, setIsActive] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sortKey, setSortKey] = useState<'name' | 'types_label_eng' | 'slug' | 'is_active'>('name')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    const fetchTypes = async () => {
        const { data } = await supabase.from('property_types').select('*').order('name')
        if (data) setTypes(data)
    }

    useEffect(() => {
        fetchTypes()
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
        if (sortKey != key) return ''
        return sortDir === 'asc' ? '?' : '?'
    }

    const filteredTypes = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return types
        return types.filter((type) => {
            const haystack = [
                type.name,
                type.slug,
                type.types_label_eng || '',
            ].join(' ').toLowerCase()
            return haystack.includes(term)
        })
    }, [types, searchTerm])

    const sortedTypes = useMemo(() => {
        const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
        const direction = sortDir === 'asc' ? 1 : -1
        const getValue = (item: PropertyType) => {
            if (sortKey === 'types_label_eng') return item.types_label_eng || ''
            if (sortKey === 'slug') return item.slug || ''
            if (sortKey === 'is_active') return item.is_active ? 'Ativo' : 'Inativo'
            return item.name || ''
        }
        return [...filteredTypes].sort((a, b) => collator.compare(getValue(a), getValue(b)) * direction)
    }, [filteredTypes, sortKey, sortDir])

    const totalPages = Math.max(1, Math.ceil(sortedTypes.length / pageSize))
    const currentTypes = sortedTypes.slice((page - 1) * pageSize, page * pageSize)

    useEffect(() => {
        if (page > totalPages) setPage(totalPages)
    }, [page, totalPages])

    const handleOpenDialog = (type?: PropertyType) => {
        if (type && !canEdit) {
            toast.error('Sem permissão para editar tipos')
            return
        }
        if (!type && !canCreate) {
            toast.error('Sem permissão para criar tipos')
            return
        }

        if (type) {
            setEditingType(type)
            setName(type.name)
            setNameEng(type.types_label_eng || '')
            setDescription(type.description || '')
            setIsActive(type.is_active)
        } else {
            setEditingType(null)
            setName('')
            setNameEng('')
            setDescription('')
            setIsActive(true)
        }
        setIsOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (editingType && !canEdit) {
            toast.error('Sem permissão para editar tipos')
            return
        }
        if (!editingType && !canCreate) {
            toast.error('Sem permissão para criar tipos')
            return
        }
        setIsLoading(true)

        try {
            const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
            const payload = { name, slug, description, is_active: isActive, types_label_eng: nameEng || null }

            if (editingType) {
                const { error } = await supabase.from('property_types').update(payload).eq('id', editingType.id)
                if (error) throw error
                toast.success('Tipo de imóvel atualizado!')
            } else {
                const { error } = await supabase.from('property_types').insert([payload])
                if (error) throw error
                toast.success('Tipo de imóvel criado!')
            }

            setIsOpen(false)
            fetchTypes()
        } catch (error: any) {
            toast.error('Erro ao salvar', { description: error.message })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!canDelete) {
            toast.error('Sem permissão para excluir tipos')
            return
        }
        if (!confirm('Tem certeza? Isso pode afetar imóveis vinculados.')) return

        try {
            const { error } = await supabase.from('property_types').delete().eq('id', id)
            if (error) throw error
            toast.success('Tipo excluído!')
            fetchTypes()
        } catch (error: any) {
            toast.error('Erro ao excluir', { description: error.message })
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Tipos de Imóvel</h1>
                    <p className="text-muted-foreground mt-1">Gerencie as categorias de imóveis do sistema</p>
                </div>
                <Button onClick={() => handleOpenDialog()} disabled={!canCreate} title={!canCreate ? 'Sem permissão para criar tipos' : undefined}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Tipo
                </Button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingType ? 'Editar Tipo' : 'Adicionar Novo Tipo'}</DialogTitle>
                            <DialogDescription>
                                Defina o nome e detalhes da categoria de imóvel.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome da Categoria</Label>
                                <Input id="name" placeholder="ex: Apartamento, Casa, Terreno" value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name_eng">Tradu\u00e7\u00e3o (Ingl\u00eas)</Label>
                                <Input id="name_eng" placeholder="ex: Apartment, House, Land" value={nameEng} onChange={e => setNameEng(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Descrição (Opcional)</Label>
                                <Textarea id="description" placeholder="Breve descrição sobre este tipo..." value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>Ativo</Label>
                                    <p className="text-[10px] text-muted-foreground">Inativo esconde este tipo nos cadastros e filtros</p>
                                </div>
                                <Switch checked={isActive} onCheckedChange={setIsActive} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando...' : editingType ? 'Atualizar' : 'Criar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        placeholder="Pesquisar por nome, tradu\u00e7\u00e3o ou slug..."
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
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                                Nome {getSortIndicator('name')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('types_label_eng')}>
                                Tradu\u00e7\u00e3o (EN) {getSortIndicator('types_label_eng')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('slug')}>
                                Slug {getSortIndicator('slug')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('is_active')}>
                                Status {getSortIndicator('is_active')}
                            </TableHead>
                            <TableHead className="text-right">A\u00e7\u00f5es</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentTypes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum tipo encontrado.</TableCell>
                            </TableRow>
                        ) : currentTypes.map((type) => (
                            <TableRow key={type.id}>
                                <TableCell><Home className="w-4 h-4 text-primary/60" /></TableCell>
                                <TableCell className="font-bold">{type.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{type.types_label_eng || '-'}</TableCell>
                                <TableCell className="font-mono text-xs">{type.slug}</TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${type.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {type.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(type)} disabled={!canEdit} title={!canEdit ? 'Sem permiss?o' : 'Editar'}>
                                            <Settings2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(type.id)} disabled={!canDelete} title={!canDelete ? 'Sem permiss?o' : 'Excluir'}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 text-xs text-muted-foreground">
                    <span>Mostrando {currentTypes.length} de {filteredTypes.length} resultados</span>
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

