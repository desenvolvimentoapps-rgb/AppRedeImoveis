'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lead } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Mail, Phone, MessageSquare, CheckCircle2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const fetchLeads = async () => {
            const { data } = await supabase.from('leads').select('*, property:properties(title, code)').order('created_at', { ascending: false })
            if (data) setLeads(data)
            setIsLoading(false)
        }
        fetchLeads()
    }, [supabase])

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        try {
            const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', id)
            if (error) throw error
            setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l))
            toast.success('Status atualizado!')
        } catch (e: any) {
            toast.error('Erro ao atualizar status')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Leads</h1>
                    <p className="text-muted-foreground mt-1">Gerencie os contatos recebidos</p>
                </div>
            </div>

            <div className="border rounded-lg bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>Imóvel de Interesse</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10">Carregando...</TableCell></TableRow>
                        ) : leads.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
                        ) : leads.map((lead: any) => (
                            <TableRow key={lead.id}>
                                <TableCell className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                    {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </TableCell>
                                <TableCell className="font-bold">{lead.name}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1 text-[10px]">
                                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>
                                        <span className="flex items-center gap-1 font-semibold"><Phone className="w-3 h-3" /> {lead.phone}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col text-[10px]">
                                        <span className="font-black text-primary">{lead.property?.code || 'Geral'}</span>
                                        <span className="text-muted-foreground truncate max-w-[150px]">{lead.property?.title || 'Interesse Geral'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge className="px-2 py-0.5 text-[10px]" variant={lead.status === 'new' ? 'destructive' : lead.status === 'contacted' ? 'default' : 'secondary'}>
                                        {lead.status === 'new' ? 'Novo' : lead.status === 'contacted' ? 'Em Contato' : 'Finalizado'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Select
                                        defaultValue={lead.status}
                                        onValueChange={(v) => handleUpdateStatus(lead.id, v)}
                                    >
                                        <SelectTrigger className="w-[120px] h-8 text-[10px]">
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
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
