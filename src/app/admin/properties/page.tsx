'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Property } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, ExternalLink, ChevronLeft, ChevronRight, Eye, MousePointer2, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function PropertiesListPage() {
    const [properties, setProperties] = useState<Property[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [totalCount, setTotalCount] = useState(0)
    const [orderBy, setOrderBy] = useState('created_at')
    const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc')

    const supabase = createClient()

    useEffect(() => {
        fetchProperties()
    }, [page, pageSize, orderBy, orderDir])

    const fetchProperties = async () => {
        setIsLoading(true)
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        let query = supabase
            .from('properties')
            .select('*, type:property_types(name)', { count: 'exact' })
            .order(orderBy, { ascending: orderDir === 'asc' })
            .range(from, to)

        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
        }

        const { data, error, count } = await query

        if (error) {
            toast.error('Erro ao carregar imóveis')
        } else {
            setProperties(data || [])
            setTotalCount(count || 0)
        }
        setIsLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este imóvel?')) return
        const { error } = await supabase.from('properties').delete().eq('id', id)
        if (error) {
            toast.error('Erro ao excluir')
        } else {
            setProperties(properties.filter(p => p.id !== id))
            toast.success('Imóvel excluído')
            fetchProperties()
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, any> = {
            available: { label: 'Disponível', variant: 'default' },
            reserved: { label: 'Reservado', variant: 'secondary' },
            sold: { label: 'Vendido', variant: 'destructive' },
            draft: { label: 'Rascunho', variant: 'outline' },
        }
        const s = variants[status] || { label: status, variant: 'outline' }
        return <Badge variant={s.variant}>{s.label}</Badge>
    }

    const totalPages = Math.ceil(totalCount / pageSize)

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
                    <p className="text-muted-foreground mt-1">Gerencie seu catálogo de ofertas e analise performance</p>
                </div>
                <Link href="/admin/properties/new">
                    <Button className="shadow-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Imóvel
                    </Button>
                </Link>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por título ou código OLI#..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchProperties()}
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Select value={orderBy} onValueChange={(v) => v && setOrderBy(v)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Ordenar por" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="created_at">Data de Criação</SelectItem>
                            <SelectItem value="title">Nome/Título</SelectItem>
                            <SelectItem value="value">Valor</SelectItem>
                            <SelectItem value="view_count">Visualizações</SelectItem>
                            <SelectItem value="click_count">Cliques</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={pageSize.toString()} onValueChange={v => { v && setPageSize(parseInt(v)); setPage(1); }}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10 itens</SelectItem>
                            <SelectItem value="20">20 itens</SelectItem>
                            <SelectItem value="50">50 itens</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="w-24">Código</TableHead>
                            <TableHead>Imóvel</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Performance</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : properties.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum imóvel encontrado.</TableCell></TableRow>
                        ) : properties.map((p: any) => (
                            <TableRow key={p.id} className="hover:bg-slate-50/30 transition-colors">
                                <TableCell className="font-mono text-xs font-bold text-slate-600">{p.code}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">{p.title}</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{p.type?.name || 'Imóvel'}</Badge>
                                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{p.address_city}, {p.address_uf}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                    {p.value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value) : 'Consulte'}
                                </TableCell>
                                <TableCell>{getStatusBadge(p.status)}</TableCell>
                                <TableCell>
                                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground font-medium">
                                        <div className="flex items-center gap-1" title="Visualizações">
                                            <Eye className="w-3 h-3" /> {p.view_count || 0}
                                        </div>
                                        <div className="flex items-center gap-1" title="Cliques em WhatsApp/Saiba Mais">
                                            <MousePointer2 className="w-3 h-3" /> {p.click_count || 0}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Link href={`/imoveis/${p.slug}`} target="_blank">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ver no site"><ExternalLink className="w-4 h-4 text-slate-500" /></Button>
                                        </Link>
                                        <Link href={`/admin/properties/${p.id}`}>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar"><Edit className="w-4 h-4 text-primary" /></Button>
                                        </Link>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(p.id)} title="Excluir">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 bg-slate-50/50 border-t">
                    <div className="text-xs text-muted-foreground">
                        Mostrando <b>{properties.length}</b> de <b>{totalCount}</b> imóveis
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || isLoading}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="text-xs font-medium px-2">
                            Página {page} de {totalPages || 1}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || isLoading}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
