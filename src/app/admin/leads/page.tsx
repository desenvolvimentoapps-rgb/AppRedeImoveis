'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { Lead } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Mail, Phone, MessageSquare, Search, Download } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [page, setPage] = useState(1)
    const pageSize = 10
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [isFinalizeOpen, setIsFinalizeOpen] = useState(false)
    const [finalizeDate, setFinalizeDate] = useState('')
    const [finalizeAction, setFinalizeAction] = useState('')
    const [pendingFinalizeLead, setPendingFinalizeLead] = useState<Lead | null>(null)
    const [isExporting, setIsExporting] = useState(false)

    const supabase = createClient()
    const { profile } = useAuthStore()
    const canEditStatus = hasPermission(profile, 'leads', 'edit')
    const canExport = hasPermission(profile, 'leads', 'view')

    useEffect(() => {
        const fetchLeads = async () => {
            setIsLoading(true)
            const { data, error } = await supabase
                .from('leads')
                .select('*, property:properties(title, code, type:property_types(name))')
                .order('created_at', { ascending: false })

            if (error) {
                toast.error('Erro ao carregar leads', { description: error.message })
            } else {
                setLeads(data || [])
            }
            setIsLoading(false)
        }
        fetchLeads()
    }, [supabase])

    useEffect(() => {
        setPage(1)
    }, [searchTerm])

    const filteredLeads = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return leads

        return leads.filter((lead) => {
            const haystack = [
                lead.name,
                lead.email,
                lead.phone,
                lead.message,
                lead.status,
                lead.property?.code,
                lead.property?.title,
                lead.property?.type?.name,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            return haystack.includes(term)
        })
    }, [leads, searchTerm])

    const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize))
    const currentLeads = filteredLeads.slice((page - 1) * pageSize, page * pageSize)

    const openDetails = (lead: Lead) => {
        setSelectedLead(lead)
        setIsDetailOpen(true)
    }

    const getStatusBadge = (status: string) => {
        if (status === 'new') return { label: 'Novo', variant: 'destructive' as const }
        if (status === 'contacted') return { label: 'Em Contato', variant: 'default' as const }
        return { label: 'Finalizado', variant: 'secondary' as const }
    }

    const updateLeadStatus = async (lead: Lead, newStatus: string) => {
        if (!canEditStatus) {
            toast.error('Sem permissao para atualizar status')
            return
        }

        try {
            const response = await fetch('/api/admin/leads', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lead.id, status: newStatus }),
            })
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result?.error || 'Falha ao atualizar lead')
            }
            const updated = result?.data
            setLeads((prev) => prev.map(l => l.id === lead.id ? { ...l, ...updated } : l))
            toast.success('Status atualizado!')
        } catch (e: any) {
            toast.error('Erro ao atualizar status', { description: e?.message })
        }
    }

    const handleUpdateStatus = (lead: Lead, newStatus: string) => {
        if (newStatus === 'completed') {
            setPendingFinalizeLead(lead)
            setFinalizeDate(lead.date_contato || format(new Date(), 'yyyy-MM-dd'))
            setFinalizeAction(lead.action_contato || '')
            setIsFinalizeOpen(true)
            return
        }

        updateLeadStatus(lead, newStatus)
    }

    const handleFinalize = async () => {
        if (!pendingFinalizeLead) return
        if (!finalizeDate) {
            toast.error('Informe a data de finalizacao')
            return
        }

        try {
            const payload = {
                id: pendingFinalizeLead.id,
                status: 'completed',
                date_contato: finalizeDate,
                action_contato: finalizeAction || null,
            }

            const response = await fetch('/api/admin/leads', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result?.error || 'Falha ao finalizar lead')
            }

            const updated = result?.data
            setLeads((prev) =>
                prev.map(l =>
                    l.id === pendingFinalizeLead.id
                        ? { ...l, ...updated }
                        : l
                )
            )
            toast.success('Lead finalizado com sucesso!')
            setIsFinalizeOpen(false)
            setPendingFinalizeLead(null)
        } catch (e: any) {
            toast.error('Erro ao finalizar lead', { description: e?.message })
        }
    }

    const handleExportCsv = async () => {
        if (!canExport) {
            toast.error('Sem permissao para exportar leads')
            return
        }

        if (filteredLeads.length === 0) {
            toast.info('Nenhum lead para exportar')
            return
        }

        setIsExporting(true)
        try {
            const headers = [
                'created_at',
                'name',
                'email',
                'phone',
                'message',
                'status',
                'date_contato',
                'action_contato',
                'property_code',
                'property_title',
                'property_type',
            ]

            const normalize = (value: any) => {
                if (value === null || value === undefined) return ''
                if (typeof value === 'object') return JSON.stringify(value)
                return String(value)
            }

            const escapeCsv = (value: string) => {
                const escaped = value.replace(/\"/g, '\"\"')
                return /[\",\\n]/.test(escaped) ? `\"${escaped}\"` : escaped
            }

            const rows = filteredLeads.map((lead) => ({
                created_at: lead.created_at,
                name: lead.name,
                email: lead.email,
                phone: lead.phone || '',
                message: lead.message || '',
                status: lead.status,
                date_contato: lead.date_contato || '',
                action_contato: lead.action_contato || '',
                property_code: lead.property?.code || '',
                property_title: lead.property?.title || '',
                property_type: lead.property?.type?.name || '',
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
            link.download = `leads-${timestamp}.csv`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
            toast.success('Exportacao concluida')
        } catch (error: any) {
            toast.error('Erro ao exportar', { description: error.message })
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Leads</h1>
                    <p className="text-muted-foreground mt-1">Gerencie os contatos recebidos</p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleExportCsv}
                    disabled={!canExport || isExporting}
                    title={!canExport ? 'Sem permissao para exportar' : 'Exportar CSV'}
                >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                </Button>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Pesquisar por nome, e-mail, mensagem, codigo ou tipo..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {filteredLeads.length} resultado(s)
                </div>
            </div>

            <div className="border rounded-lg bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>Tipo Imovel</TableHead>
                            <TableHead>Mensagem</TableHead>
                            <TableHead>Imovel</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Acao</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-10">Carregando...</TableCell></TableRow>
                        ) : currentLeads.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
                        ) : currentLeads.map((lead) => {
                            const statusBadge = getStatusBadge(lead.status)
                            const messageSnippet = lead.message
                                ? `${lead.message.slice(0, 30)}${lead.message.length > 30 ? '...' : ''}`
                                : '-'

                            return (
                                <TableRow
                                    key={lead.id}
                                    className="hover:bg-slate-50/50 cursor-pointer"
                                    onClick={() => openDetails(lead)}
                                >
                                    <TableCell className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                        {format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                    </TableCell>
                                    <TableCell className="font-bold">{lead.name}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 text-[10px]">
                                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>
                                            <span className="flex items-center gap-1 font-semibold"><Phone className="w-3 h-3" /> {lead.phone || '-'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-[10px] font-semibold text-muted-foreground">
                                        {lead.property?.type?.name || '-'}
                                    </TableCell>
                                    <TableCell className="text-[10px] text-muted-foreground max-w-[140px] truncate">
                                        {messageSnippet}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-[10px]">
                                            <span className="font-black text-primary">{lead.property?.code || 'Geral'}</span>
                                            <span className="text-muted-foreground truncate max-w-[150px]">{lead.property?.title || 'Interesse Geral'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="px-2 py-0.5 text-[10px]" variant={statusBadge.variant}>
                                            {statusBadge.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <Select
                                            value={lead.status}
                                            onValueChange={(v) => v && handleUpdateStatus(lead, v)}
                                            disabled={!canEditStatus}
                                        >
                                            <SelectTrigger className="w-[140px] h-8 text-[10px]" title={!canEditStatus ? 'Sem permissao' : undefined}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="new">Novo</SelectItem>
                                                <SelectItem value="contacted">Entrar em Contato</SelectItem>
                                                <SelectItem value="completed">Finalizado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>

                <div className="flex items-center justify-between p-4 bg-slate-50/50 border-t">
                    <div className="text-xs text-muted-foreground">
                        Mostrando <b>{currentLeads.length}</b> de <b>{filteredLeads.length}</b> leads
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            Anterior
                        </Button>
                        <div className="text-xs font-medium px-2">
                            Pagina {page} de {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            Proxima
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Lead</DialogTitle>
                        <DialogDescription>Informacoes completas do contato selecionado.</DialogDescription>
                    </DialogHeader>
                    {selectedLead && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Nome</p>
                                    <p className="font-semibold">{selectedLead.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    <p className="font-semibold">{getStatusBadge(selectedLead.status).label}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Email</p>
                                    <p className="font-semibold">{selectedLead.email}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Telefone</p>
                                    <p className="font-semibold">{selectedLead.phone || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Data de contato</p>
                                    <p className="font-semibold">{selectedLead.date_contato || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Acao do contato</p>
                                    <p className="font-semibold">{selectedLead.action_contato || '-'}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                                <div className="border rounded-lg p-3 text-sm bg-slate-50/40 whitespace-pre-wrap">
                                    {selectedLead.message || 'Sem mensagem'}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isFinalizeOpen} onOpenChange={setIsFinalizeOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Finalizar Lead</DialogTitle>
                        <DialogDescription>Registre a data e a descricao da finalizacao.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Data de finalizacao</label>
                            <Input
                                type="date"
                                value={finalizeDate}
                                onChange={(e) => setFinalizeDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descricao da finalizacao</label>
                            <Textarea
                                value={finalizeAction}
                                onChange={(e) => setFinalizeAction(e.target.value)}
                                placeholder="Ex: Cliente visitou o imovel e confirmou interesse..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFinalizeOpen(false)}>Cancelar</Button>
                        <Button onClick={handleFinalize}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
