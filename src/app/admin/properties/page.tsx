'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Property, PropertyStatus } from '@/types/database'
import { DEFAULT_PROPERTY_STATUSES, normalizePropertyStatus, resolveStatusLabel } from '@/lib/property-status'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, ExternalLink, ChevronLeft, ChevronRight, Eye, MousePointer2, Loader2, MessageSquare, Globe, Mail } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'

export default function PropertiesListPage() {
    const [properties, setProperties] = useState<Property[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [statuses, setStatuses] = useState<PropertyStatus[]>([])
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [totalCount, setTotalCount] = useState(0)
    const [orderBy, setOrderBy] = useState('created_at')
    const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc')
    const [isExporting, setIsExporting] = useState(false)

    const supabase = createClient()
    const { profile } = useAuthStore()
    const canCreate = hasPermission(profile, 'properties', 'create')
    const canEdit = hasPermission(profile, 'properties', 'edit')
    const canDelete = hasPermission(profile, 'properties', 'delete')
    const canExport = hasPermission(profile, 'properties', 'view')

    useEffect(() => {
        fetchStatuses()
    }, [])

    useEffect(() => {
        fetchProperties()
    }, [page, pageSize, orderBy, orderDir, searchTerm])

    useEffect(() => {
        setPage(1)
    }, [searchTerm])

    const handleSort = (column: string) => {
        if (orderBy === column) {
            setOrderDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
            setPage(1)
            return
        }
        setOrderBy(column)
        setOrderDir('asc')
        setPage(1)
    }

    const getSortIndicator = (column: string) => {
        if (orderBy !== column) return ''
        return orderDir === 'asc' ? '▲' : '▼'
    }

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

    const fetchProperties = async () => {
        setIsLoading(true)
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        let query = supabase
            .from('properties')
            .select('*, type:property_types(name)', { count: 'exact' })
            .range(from, to)

        if (orderBy === 'type_name') {
            query = query.order('name', { foreignTable: 'property_types', ascending: orderDir === 'asc' })
        } else {
            query = query.order(orderBy, { ascending: orderDir === 'asc' })
        }

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
        if (!canDelete) {
            toast.error('Sem permissão para excluir imóveis')
            return
        }
        const confirmation = prompt('Digite "deletar" para confirmar a exclusão do imóvel')
        if (confirmation?.toLowerCase() !== 'deletar') return
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
            inactive: { label: 'Inativo', variant: 'outline' },
        }
        const label = resolveStatusLabel(status, statuses.length ? statuses : DEFAULT_PROPERTY_STATUSES) || status
        const s = variants[status] || { label, variant: 'outline' }
        return <Badge variant={s.variant}>{s.label}</Badge>
    }

    const getPriceDisplay = (item: Property) => {
        const pricing = (item.features as any)?.pricing
        if (!pricing || pricing.mode === 'exact') {
            return item.value
                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)
                : 'Consulte'
        }
        const label = pricing.label || (pricing.mode === 'special' ? 'Investimento Especial' : 'Preços a partir de')
        const valueText = item.value
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)
            : ''
        return valueText ? `${label} ${valueText}` : label
    }

    const getMetricValue = (item: any, candidates: string[]) => {
        for (const key of candidates) {
            if (Object.prototype.hasOwnProperty.call(item, key)) {
                return Number(item[key] || 0)
            }
        }
        return 0
    }

    const handleExportCsv = async () => {
        if (!canExport) {
            toast.error('Sem permissão para exportar imóveis')
            return
        }

        setIsExporting(true)
        try {
            const batchSize = 1000
            let from = 0
            let allRows: any[] = []

            while (true) {
                let exportQuery = supabase
                    .from('properties')
                    .select('*, type:property_types(name)')
                    .order('created_at', { ascending: false })
                    .range(from, from + batchSize - 1)

                if (searchTerm) {
                    exportQuery = exportQuery.or(`title.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
                }

                const { data, error } = await exportQuery

                if (error) throw error

                const rows = data || []
                allRows = allRows.concat(rows)
                if (rows.length < batchSize) break
                from += batchSize
            }

            if (allRows.length === 0) {
                toast.info('Nenhum imóvel para exportar')
                return
            }

            const baseHeaders = [
                'code',
                'title',
                'value',
                'status',
                'type_name',
                'address_city',
                'address_uf',
                'is_active',
                'is_featured',
                'created_at',
            ]

            const headersSet = new Set<string>(baseHeaders)
            allRows.forEach((row) => {
                Object.keys(row || {}).forEach((key) => {
                    if (key === 'type') return
                    headersSet.add(key)
                })
            })

            const headers = baseHeaders.concat([...headersSet].filter((k) => !baseHeaders.includes(k)))

            const normalize = (value: any) => {
                if (value === null || value === undefined) return ''
                if (typeof value === 'object') return JSON.stringify(value)
                return String(value)
            }

            const escapeCsv = (value: string) => {
                const escaped = value.replace(/\"/g, '\"\"')
                return /[\",\\n]/.test(escaped) ? `\"${escaped}\"` : escaped
            }

            const rows = allRows.map((row) => ({
                ...row,
                type_name: row?.type?.name || '',
            }))

            const csvLines = [
                headers.join(','),
                ...rows.map((row) =>
                    headers.map((key) => escapeCsv(normalize((row as any)[key]))).join(',')
                ),
            ]

            const csvContent = csvLines.join('\n')
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            const timestamp = new Date().toISOString().split('T')[0]
            link.href = url
            link.download = `imoveis-${timestamp}.csv`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
            toast.success('Exportação concluída')
        } catch (error: any) {
            toast.error('Erro ao exportar', { description: error.message })
        } finally {
            setIsExporting(false)
        }
    }
    const totalPages = Math.ceil(totalCount / pageSize)

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
                    <p className="text-muted-foreground mt-1">Gerencie seu catálogo de ofertas e analise performance</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleExportCsv}
                        disabled={!canExport || isExporting}
                        title={!canExport ? 'Sem permissão para exportar' : 'Exportar CSV'}
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                        Exportar CSV
                    </Button>
                    {canCreate ? (
                        <Link href="/admin/properties/new">
                            <Button className="shadow-sm">
                                <Plus className="w-4 h-4 mr-2" />
                                Novo Imóvel
                            </Button>
                        </Link>
                    ) : (
                        <Button className="shadow-sm" disabled title="Sem permissão para criar imóveis">
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Imóvel
                        </Button>
                    )}
                </div>
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
                            <SelectItem value="code">Código</SelectItem>
                            <SelectItem value="title">Nome/Título</SelectItem>
                            <SelectItem value="type_name">Tipo de Imóvel</SelectItem>
                            <SelectItem value="address_city">Cidade</SelectItem>
                            <SelectItem value="address_uf">Estado</SelectItem>
                            <SelectItem value="is_exterior">Exterior</SelectItem>
                            <SelectItem value="value">Valor</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
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
                            <TableHead className="w-24">
                                <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => handleSort('code')}>
                                    Código <span className="text-[10px] text-muted-foreground">{getSortIndicator('code')}</span>
                                </button>
                            </TableHead>
                            <TableHead>
                                <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => handleSort('title')}>
                                    Imóvel <span className="text-[10px] text-muted-foreground">{getSortIndicator('title')}</span>
                                </button>
                            </TableHead>
                            <TableHead>
                                <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => handleSort('type_name')}>
                                    Tipo <span className="text-[10px] text-muted-foreground">{getSortIndicator('type_name')}</span>
                                </button>
                            </TableHead>
                            <TableHead>
                                <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => handleSort('address_city')}>
                                    Cidade <span className="text-[10px] text-muted-foreground">{getSortIndicator('address_city')}</span>
                                </button>
                            </TableHead>
                            <TableHead>
                                <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => handleSort('address_uf')}>
                                    Estado <span className="text-[10px] text-muted-foreground">{getSortIndicator('address_uf')}</span>
                                </button>
                            </TableHead>
                            <TableHead>
                                <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => handleSort('is_exterior')}>
                                    Exterior <span className="text-[10px] text-muted-foreground">{getSortIndicator('is_exterior')}</span>
                                </button>
                            </TableHead>
                            <TableHead>
                                <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => handleSort('value')}>
                                    Valor <span className="text-[10px] text-muted-foreground">{getSortIndicator('value')}</span>
                                </button>
                            </TableHead>
                            <TableHead>
                                <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => handleSort('status')}>
                                    Status <span className="text-[10px] text-muted-foreground">{getSortIndicator('status')}</span>
                                </button>
                            </TableHead>
                            <TableHead className="text-center">Performance</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={10} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : properties.length === 0 ? (
                            <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Nenhum imóvel encontrado.</TableCell></TableRow>
                        ) : properties.map((p: any) => (
                            <TableRow key={p.id} className="hover:bg-slate-50/30 transition-colors">
                                <TableCell className="font-mono text-xs font-bold text-slate-600">{p.code}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">{p.title}</span>
                                        <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">{p.address_neighborhood || '-'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{p.type?.name || '-'}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{p.address_city || '-'}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{p.address_state || p.address_uf || '-'}</TableCell>
                                <TableCell className="text-xs font-semibold">{p.is_exterior ? 'Sim' : 'Não'}</TableCell>
                                <TableCell className="text-sm font-medium">
                                    {getPriceDisplay(p)}
                                </TableCell>
                                <TableCell>{getStatusBadge(p.status)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground font-medium">
                                        <div className="flex items-center gap-1" title="Visualizações">
                                            <Eye className="w-3 h-3" /> {p.view_count || 0}
                                        </div>
                                        <div className="flex items-center gap-1" title="Cliques gerais">
                                            <MousePointer2 className="w-3 h-3" /> {p.click_count || 0}
                                        </div>
                                        <div className="flex items-center gap-1" title="WhatsApp Brasil">
                                            <MessageSquare className="w-3 h-3" /> {getMetricValue(p, ['whastbr_count', 'WhastBR_count', 'whatsapp_clicks_br'])}
                                        </div>
                                        <div className="flex items-center gap-1" title="WhatsApp Exterior">
                                            <Globe className="w-3 h-3" /> {getMetricValue(p, ['whastusa_count', 'WhastUSA_count', 'whatsapp_clicks_intl'])}
                                        </div>
                                        <div className="flex items-center gap-1" title="E-mail">
                                            <Mail className="w-3 h-3" /> {getMetricValue(p, ['email_count', 'email_clicks'])}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Link href={`${p.locale === 'en' ? '/imoveis/en' : '/imoveis'}/${p.slug}`} target="_blank">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ver no site"><ExternalLink className="w-4 h-4 text-slate-500" /></Button>
                                        </Link>
                                        {canEdit ? (
                                            <Link href={`/admin/properties/${p.id}`}>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar"><Edit className="w-4 h-4 text-primary" /></Button>
                                            </Link>
                                        ) : (
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Sem permissão" disabled>
                                                <Edit className="w-4 h-4 text-slate-300" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDelete(p.id)}
                                            title={canDelete ? 'Excluir' : 'Sem permissão'}
                                            disabled={!canDelete}
                                        >
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

