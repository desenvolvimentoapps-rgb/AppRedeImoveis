'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCMSStore } from '@/hooks/useCMS'
import { CMSField, PropertyType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Settings2, Trash2, Info, HelpCircle, X } from 'lucide-react'

export default function CMSFieldsPage() {
    const { fields, setFields } = useCMSStore()
    const [types, setTypes] = useState<PropertyType[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingField, setEditingField] = useState<CMSField | null>(null)
    const supabase = createClient()

    // Form states
    const [name, setName] = useState('')
    const [label, setLabel] = useState('')
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

    const handleOpenDialog = (field?: CMSField) => {
        if (field) {
            setEditingField(field)
            setName(field.name)
            setLabel(field.label)
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
        setIsLoading(true)

        try {
            const payload = {
                name,
                label,
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
                <Button onClick={() => handleOpenDialog()}>
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
                                        <Label className="font-bold text-indigo-900">Show in Summary Row</Label>
                                        <p className="text-[10px] text-indigo-700">Display at the top of property page</p>
                                    </div>
                                    <Switch checked={showInSummary} onCheckedChange={setShowInSummary} />
                                </div>

                                {showInSummary && (
                                    <div className="space-y-2">
                                        <Label>Summary Display Order</Label>
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

            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Campo / Label</TableHead>
                            <TableHead>Vínculo</TableHead>
                            <TableHead>Tipo / Seção</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field) => (
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
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(field)}>
                                            <Settings2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteField(field.id)}>
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
