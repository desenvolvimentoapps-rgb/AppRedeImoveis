'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCMSStore } from '@/hooks/useCMS'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { CMSField, PropertyType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Settings2, Trash2, Info, HelpCircle, X, ChevronLeft, ChevronRight, Search } from 'lucide-react'

export default function CMSFieldsPage() {
    const { fields, setFields } = useCMSStore()
    const [types, setTypes] = useState<PropertyType[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingField, setEditingField] = useState<CMSField | null>(null)
    const supabase = createClient()
    const { profile } = useAuthStore()
    const canCreate = hasPermission(profile, 'cms_fields', 'create')
    const canEdit = hasPermission(profile, 'cms_fields', 'edit')
    const canDelete = hasPermission(profile, 'cms_fields', 'delete')

    // Form states
    const [name, setName] = useState('')
    const [label, setLabel] = useState('')
    const [labelEng, setLabelEng] = useState('')
    const [type, setType] = useState('text')
    const [section, setSection] = useState('ficha_tecnica')
    const [icon, setIcon] = useState('info')
    const [propertyTypeId, setPropertyTypeId] = useState<string>('all')
    const [instruction, setInstruction] = useState('')
    const [placeholder, setPlaceholder] = useState('')
    const [isRequired, setIsRequired] = useState(false)
    const [options, setOptions] = useState<string[]>([])
    const [newOption, setNewOption] = useState('')
    const [showInSummary, setShowInSummary] = useState(false)
    const [summaryOrder, setSummaryOrder] = useState(0)
    const [searchTerm, setSearchTerm] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sortKey, setSortKey] = useState<'label' | 'fields_label_eng' | 'type_link' | 'type_section'>('label')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    const fetchFields = async () => {
        const { data } = await supabase.from('cms_fields').select('*').order('section', { ascending: true })
        if (data) setFields(data)
    }

    const fetchTypes = async () => {
        const { data } = await supabase.from('property_types').select('*').order('name')
        if (data) setTypes(data)
    }

    useEffect(() => {
        fetchFields()
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
        if (sortKey !== key) return ''
        return sortDir === 'asc' ? '?' : '?'
    }

    const resolveTypeLabel = (field: CMSField) => {
        if (!field.property_type_id) return 'Todos'
        return types.find(t => t.id === field.property_type_id)?.name || 'Carregando...'
    }

    const filteredFields = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return fields
        return fields.filter((field) => {
            const haystack = [
                field.label,
                field.fields_label_eng || '',
                field.name,
                field.type,
                field.section,
                resolveTypeLabel(field),
            ].join(' ').toLowerCase()
            return haystack.includes(term)
        })
    }, [fields, searchTerm, types])

    const sortedFields = useMemo(() => {
        const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
        const direction = sortDir === 'asc' ? 1 : -1
        const getValue = (item: CMSField) => {
            if (sortKey === 'fields_label_eng') return item.fields_label_eng || ''
            if (sortKey === 'type_link') return resolveTypeLabel(item) || ''
            if (sortKey === 'type_section') return `${item.type || ''} ${item.section || ''}`.trim()
            return item.label || ''
        }
        return [...filteredFields].sort((a, b) => collator.compare(getValue(a), getValue(b)) * direction)
    }, [filteredFields, sortKey, sortDir, types])

    const totalPages = Math.max(1, Math.ceil(sortedFields.length / pageSize))
    const currentFields = sortedFields.slice((page - 1) * pageSize, page * pageSize)

    useEffect(() => {
        if (page > totalPages) setPage(totalPages)
    }, [page, totalPages])

    const handleOpenDialog = (field?: CMSField) => {
        if (field && !canEdit) {
            toast.error('Sem permissão para editar campos')
            return
        }
        if (!field && !canCreate) {
            toast.error('Sem permissão para criar campos')
            return
        }

        if (field) {
            setEditingField(field)
            setName(field.name)
            setLabel(field.label)
            setLabelEng(field.fields_label_eng || '')
            setType(field.type)
            setSection(field.section)
            setIcon(field.icon || 'info')
            setPropertyTypeId(field.property_type_id || 'all')
            setInstruction(field.instruction || '')
            setPlaceholder(field.placeholder || '')
            setIsRequired(field.is_required || false)
            setShowInSummary(field.show_in_summary || false)
            setSummaryOrder(field.summary_order || 0)
            setOptions(Array.isArray(field.options) ? field.options : [])
        } else {
            setEditingField(null)
            setName('')
            setLabel('')
            setLabelEng('')
            setType('text')
            setSection('ficha_tecnica')
            setIcon('info')
            setPropertyTypeId('all')
            setInstruction('')
            setPlaceholder('')
            setIsRequired(false)
            setShowInSummary(false)
            setSummaryOrder(0)
            setOptions([])
        }
        setIsOpen(true)
    }

    const handleAddOption = () => {
        if (newOption.trim()) {
            setOptions([...options, newOption.trim()])
            setNewOption('')
        }
    }

    const handleRemoveOption = (index: number) => {
        setOptions(options.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (editingField && !canEdit) {
            toast.error('Sem permissão para editar campos')
            return
        }
        if (!editingField && !canCreate) {
            toast.error('Sem permissão para criar campos')
            return
        }
        setIsLoading(true)

        try {
            const payload = {
                name,
                label,
                fields_label_eng: labelEng || null,
                type,
                section,
                icon,
                property_type_id: propertyTypeId === 'all' ? null : propertyTypeId,
                instruction,
                placeholder,
                is_required: isRequired,
                show_in_summary: showInSummary,
                summary_order: summaryOrder,
                options: type === 'select' ? options : null,
            }

            if (editingField) {
                const { error } = await supabase.from('cms_fields').update(payload).eq('id', editingField.id)
                if (error) throw error
                toast.success('Campo atualizado!')
            } else {
                const { error } = await supabase.from('cms_fields').insert([payload])
                if (error) throw error
                toast.success('Campo criado!')
            }

            setIsOpen(false)
            fetchFields()
        } catch (error: any) {
            toast.error('Erro ao salvar', { description: error.message })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteField = async (id: string) => {
        if (!canDelete) {
            toast.error('Sem permissão para excluir campos')
            return
        }
        if (!confirm('Tem certeza que deseja excluir este campo?')) return

        try {
            const { error } = await supabase.from('cms_fields').delete().eq('id', id)
            if (error) throw error
            fetchFields()
            toast.success('Campo excluído!')
        } catch (error: any) {
            toast.error('Erro ao excluir', { description: error.message })
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Gestão de Campos</h1>
                    <p className="text-muted-foreground mt-1">Configure os campos dinâmicos por tipo de imóvel</p>
                </div>
                <Button onClick={() => handleOpenDialog()} disabled={!canCreate} title={!canCreate ? 'Sem permissão para criar campos' : undefined}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Campo
                </Button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingField ? 'Editar Campo' : 'Novo Campo Dinâmico'}</DialogTitle>
                            <DialogDescription>
                                Este campo aparecerá nos formulários de cadastro conforme o tipo selecionado.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome Técnico (ID no banco)</Label>
                                    <Input id="name" placeholder="ex: vista_mar" value={name} onChange={e => setName(e.target.value)} required disabled={!!editingField} />
                                    <p className="text-[10px] text-muted-foreground">Não pode conter espaços ou caracteres especiais.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="label">Rótulo de Exibição</Label>
                                    <Input id="label" placeholder="ex: Vista para o Mar" value={label} onChange={e => setLabel(e.target.value)} required />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="label_eng">Tradução (Inglês)</Label>
                                    <Input id="label_eng" placeholder="ex: Sea View" value={labelEng} onChange={e => setLabelEng(e.target.value)} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="property_type">Vínculo de Tipo</Label>
                                    <Select value={propertyTypeId} onValueChange={v => setPropertyTypeId(v ?? 'all')}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Mostrar em TODOS</SelectItem>
                                            {types.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="type">Tipo de Dado</Label>
                                        <Select value={type} onValueChange={v => setType(v ?? 'text')}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text">Texto Curto</SelectItem>
                                                <SelectItem value="textarea">Texto Longo</SelectItem>
                                                <SelectItem value="number">Número</SelectItem>
                                                <SelectItem value="boolean">Sim/Não (Check)</SelectItem>
                                                <SelectItem value="select">Seleção (Dropdown)</SelectItem>
                                                <SelectItem value="date">Data</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="section">Seção no Formulário</Label>
                                        <Select value={section} onValueChange={v => setSection(v ?? 'ficha_tecnica')}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ficha_nenhum">Nenhum</SelectItem>
                                                <SelectItem value="ficha_tecnica">Ficha Técnica</SelectItem>
                                                <SelectItem value="comodidades">Comodidades</SelectItem>
                                                <SelectItem value="caracteristicas">Características</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="icon">Ícone (Nome Lucide)</Label>
                                    <div className="flex gap-2">
                                        <Input id="icon" placeholder="ex: waves, home, user" value={icon} onChange={e => setIcon(e.target.value)} />
                                        <div className="w-10 h-10 border rounded flex items-center justify-center bg-muted/30">
                                            <Info className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Veja a lista em lucide.dev</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="instruction">Instrução de Preenchimento</Label>
                                    <Input id="instruction" placeholder="ex: Marque se o imóvel possui vista definitiva" value={instruction} onChange={e => setInstruction(e.target.value)} />
                                </div>

                                <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50/30 border-orange-100">
                                    <div className="space-y-0.5">
                                        <Label>Obrigatório</Label>
                                        <p className="text-[10px] text-muted-foreground">Bloqueia o salvamento sem este campo</p>
                                    </div>
                                    <Switch checked={isRequired} onCheckedChange={setIsRequired} />
                                </div>

                                <div className="flex items-center justify-between p-3 border rounded-lg bg-indigo-50/50 border-indigo-100">
                                    <div className="space-y-0.5">
                                        <Label className="font-bold text-indigo-900">Mostrar no resumo</Label>
                                        <p className="text-[10px] text-indigo-700">Exibe no topo do detalhe do imóvel</p>
                                    </div>
                                    <Switch checked={showInSummary} onCheckedChange={setShowInSummary} />
                                </div>

                                {showInSummary && (
                                    <div className="space-y-2">
                                        <Label>Ordem de Exibição</Label>
                                        <Input type="number" value={summaryOrder} onChange={e => setSummaryOrder(parseInt(e.target.value))} />
                                    </div>
                                )}

                                {type === 'select' && (
                                    <div className="space-y-2 p-4 border rounded-lg bg-slate-50">
                                        <Label>Opções do Select</Label>
                                        <div className="flex gap-2">
                                            <Input placeholder="Nova opção..." value={newOption} onChange={e => setNewOption(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddOption())} />
                                            <Button type="button" size="sm" onClick={handleAddOption}>Add</Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {options.map((opt, i) => (
                                                <span key={i} className="flex items-center gap-1 px-2 py-1 bg-white border rounded text-xs">
                                                    {opt}
                                                    <button type="button" onClick={() => handleRemoveOption(i)} className="text-destructive"><X className="w-3 h-3" /></button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="border-t pt-6">
                            <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando...' : editingField ? 'Salvar Alterações' : 'Criar Campo'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        placeholder="Pesquisar por campo, tradução ou seção..."
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
                                Campo / Label {getSortIndicator('label')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('fields_label_eng')}>
                                Tradução (EN) {getSortIndicator('fields_label_eng')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('type_link')}>
                                V?nculo {getSortIndicator('type_link')}
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('type_section')}>
                                Tipo / Seção {getSortIndicator('type_section')}
                            </TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentFields.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum campo encontrado.</TableCell>
                            </TableRow>
                        ) : currentFields.map((field) => (
                            <TableRow key={field.id} className="group">
                                <TableCell>
                                    <HelpCircle className="w-4 h-4 text-muted-foreground opacity-50" />
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-bold">{field.label}</span>
                                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{field.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{field.fields_label_eng || '-'}</TableCell>
                                <TableCell>
                                    {field.property_type_id ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                                            {types.find(t => t.id === field.property_type_id)?.name || 'Carregando...'}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                            Todos
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-xs capitalize">{field.type}</span>
                                        <span className="text-[10px] text-muted-foreground capitalize">{field.section.replace('_', ' ')}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(field)} disabled={!canEdit} title={!canEdit ? 'Sem permiss?o' : 'Editar'}>
                                            <Settings2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteField(field.id)} disabled={!canDelete} title={!canDelete ? 'Sem permiss?o' : 'Excluir'}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 text-xs text-muted-foreground">
                    <span>Mostrando {currentFields.length} de {filteredFields.length} resultados</span>
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

