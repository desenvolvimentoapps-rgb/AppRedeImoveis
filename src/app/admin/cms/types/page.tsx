'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PropertyType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Settings2, Trash2, Home } from 'lucide-react'

export default function PropertyTypesPage() {
    const [types, setTypes] = useState<PropertyType[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingType, setEditingType] = useState<PropertyType | null>(null)
    const supabase = createClient()

    // Form states
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [isActive, setIsActive] = useState(true)

    const fetchTypes = async () => {
        const { data } = await supabase.from('property_types').select('*').order('name')
        if (data) setTypes(data)
    }

    useEffect(() => {
        fetchTypes()
    }, [supabase])

    const handleOpenDialog = (type?: PropertyType) => {
        if (type) {
            setEditingType(type)
            setName(type.name)
            setDescription(type.description || '')
            setIsActive(type.is_active)
        } else {
            setEditingType(null)
            setName('')
            setDescription('')
            setIsActive(true)
        }
        setIsOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
            const payload = { name, slug, description, is_active: isActive }

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
                <Button onClick={() => handleOpenDialog()}>
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

            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {types.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum tipo cadastrado.</TableCell>
                            </TableRow>
                        ) : types.map((type) => (
                            <TableRow key={type.id}>
                                <TableCell><Home className="w-4 h-4 text-primary/60" /></TableCell>
                                <TableCell className="font-bold">{type.name}</TableCell>
                                <TableCell className="font-mono text-xs">{type.slug}</TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${type.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {type.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(type)}>
                                            <Settings2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(type.id)}>
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
