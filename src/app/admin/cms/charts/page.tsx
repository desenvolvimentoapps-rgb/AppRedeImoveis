'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { BarChart3, PieChart, LineChart, Hash, Plus, Settings2, Trash2, Users, Loader2, Pencil } from 'lucide-react'

interface Chart {
    id: string
    title: string
    description: string
    type: 'bar' | 'pie' | 'line' | 'number'
    data_source: string
    config: any
}

export default function ChartsManagementPage() {
    const [charts, setCharts] = useState<Chart[]>([])
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newChart, setNewChart] = useState<Partial<Chart>>({
        title: '',
        description: '',
        type: 'bar',
        data_source: 'properties',
        config: { color: '#0f172a', groupBy: 'status' }
    })
    const { profile } = useAuthStore()
    const supabase = createClient()
    const canCreateChart = hasPermission(profile, 'charts', 'create')
    const canEditChart = hasPermission(profile, 'charts', 'edit')
    const canDeleteChart = hasPermission(profile, 'charts', 'delete')

    useEffect(() => {
        if (profile) fetchData()
    }, [profile])

    const fetchData = async () => {
        setIsLoading(true)
        let chartQuery = supabase.from('dashboard_charts').select('*').order('created_at', { ascending: false })

        if (profile?.role !== 'hakunaadm') {
            const { data: visibleChartIds } = await supabase
                .from('chart_visibility')
                .select('chart_id')
                .eq('profile_id', profile?.id)

            const ids = (visibleChartIds || []).map((v: { chart_id: string }) => v.chart_id)
            chartQuery = chartQuery.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
        }

        const [chartRes, profileRes] = await Promise.all([
            chartQuery,
            supabase.from('profiles').select('*').order('full_name')
        ])

        if (chartRes.data) setCharts(chartRes.data)
        if (profileRes.data) setProfiles(profileRes.data)
        setIsLoading(false)
    }

    const handleCreateChart = async () => {
        if (!canCreateChart) {
            toast.error('Sem permissão para criar gráficos')
            return
        }
        if (!newChart.title) return toast.error('Título é obrigatório')

        try {
            const { data, error } = await supabase
                .from('dashboard_charts')
                .insert([newChart])
                .select()
                .single()

            if (error) throw error

            setCharts([data, ...charts])
            setIsCreateOpen(false)
            setNewChart({ title: '', description: '', type: 'bar', data_source: 'properties', config: { color: '#0f172a', groupBy: 'status' } })
            toast.success('Gráfico criado com sucesso!')
        } catch (error: any) {
            toast.error('Erro ao criar gráfico', { description: error.message })
        }
    }

    const handleDeleteChart = async (id: string) => {
        if (!canDeleteChart) {
            toast.error('Sem permissão para excluir gráficos')
            return
        }
        if (!confirm('Tem certeza que deseja excluir este gráfico?')) return

        try {
            const { error } = await supabase.from('dashboard_charts').delete().eq('id', id)
            if (error) throw error
            setCharts(charts.filter(c => c.id !== id))
            toast.success('Gráfico excluído')
        } catch (error: any) {
            toast.error('Erro ao excluir', { description: error.message })
        }
    }

    const [isVisibilityOpen, setIsVisibilityOpen] = useState(false)
    const [selectedChart, setSelectedChart] = useState<Chart | null>(null)
    const [chartVisibility, setChartVisibility] = useState<string[]>([])

    const openVisibility = async (chart: Chart) => {
        setSelectedChart(chart)
        const { data } = await supabase.from('chart_visibility').select('profile_id').eq('chart_id', chart.id)
        const ids = (data || []).map((v: { profile_id: string }) => v.profile_id)
        setChartVisibility(ids)
        setIsVisibilityOpen(true)
    }

    const toggleVisibility = async (profileId: string) => {
        if (!selectedChart) return

        const isVisible = chartVisibility.includes(profileId)
        if (isVisible) {
            await supabase.from('chart_visibility').delete().eq('chart_id', selectedChart.id).eq('profile_id', profileId)
            setChartVisibility(chartVisibility.filter(id => id !== profileId))
        } else {
            await supabase.from('chart_visibility').insert([{ chart_id: selectedChart.id, profile_id: profileId }])
            setChartVisibility([...chartVisibility, profileId])
        }
    }

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestão de Gráficos</h1>
                    <p className="text-muted-foreground mt-1">Crie e gerencie análises dinâmicas para o dashboard</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} disabled={!canCreateChart} title={!canCreateChart ? 'Sem permissão' : undefined}>
                    <Plus className="w-4 h-4 mr-2" /> Novo Gráfico
                </Button>
            </div>

            <Card className="border-slate-200">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="w-[100px]">Tipo</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead>Fonte de Dados</TableHead>
                            <TableHead>Agrupamento</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {charts.map((chart) => (
                            <TableRow key={chart.id} className="group transition-colors">
                                <TableCell>
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary w-fit">
                                        {chart.type === 'bar' && <BarChart3 className="w-4 h-4" />}
                                        {chart.type === 'pie' && <PieChart className="w-4 h-4" />}
                                        {chart.type === 'line' && <LineChart className="w-4 h-4" />}
                                        {chart.type === 'number' && <Hash className="w-4 h-4" />}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-900">{chart.title}</span>
                                        <span className="text-xs text-muted-foreground line-clamp-1">{chart.description}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize">{chart.data_source}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="capitalize">{chart.config?.groupBy || '-'}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setNewChart(chart)
                                                setIsCreateOpen(true)
                                            }}
                                            disabled={!canEditChart}
                                            title={!canEditChart ? 'Sem permissão' : 'Editar'}
                                        >
                                            <Pencil className="w-4 h-4 text-emerald-600" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openVisibility(chart)}
                                            disabled={!canEditChart}
                                            title={!canEditChart ? 'Sem permissão' : 'Visibilidade'}
                                        >
                                            <Users className="w-4 h-4 text-blue-600" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteChart(chart.id)}
                                            disabled={!canDeleteChart}
                                            title={!canDeleteChart ? 'Sem permissão' : 'Excluir'}
                                        >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {charts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    Nenhum gráfico cadastrado. Clique em "Novo Gráfico" para começar.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Create Chart Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Novo Gráfico Dinâmico</DialogTitle>
                        <DialogDescription>Configure os dados e a aparência da sua análise</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Título do Gráfico</Label>
                            <Input value={newChart.title} onChange={e => setNewChart({ ...newChart, title: e.target.value })} placeholder="Ex: Imóveis por Status" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo de Gráfico</Label>
                                <Select
                                    value={newChart.type}
                                    onValueChange={(v) => {
                                        if (!v) return
                                        setNewChart({ ...newChart, type: v as Chart['type'] })
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bar">Barra</SelectItem>
                                        <SelectItem value="pie">Pizza</SelectItem>
                                        <SelectItem value="line">Linha</SelectItem>
                                        <SelectItem value="number">Número (KPI)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Fonte de Dados</Label>
                                <Select value={newChart.data_source} onValueChange={v => setNewChart({ ...newChart, data_source: v ?? 'properties' })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="properties">Imóveis (Contagem)</SelectItem>
                                        <SelectItem value="leads">Leads (Contagem)</SelectItem>
                                        <SelectItem value="performance_views">Visualizações (Soma)</SelectItem>
                                        <SelectItem value="performance_clicks">Cliques (Soma)</SelectItem>
                                        <SelectItem value="registered_vs_accessed">Cadastrados vs Acessados (Pro)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Agrupar por (Campo do banco)</Label>
                            <Select value={newChart.config?.groupBy} onValueChange={v => setNewChart({ ...newChart, config: { ...newChart.config, groupBy: v ?? 'status' } })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="status">Status</SelectItem>
                                    <SelectItem value="address_city">Cidade</SelectItem>
                                    <SelectItem value="type_id">Tipo de Imóvel</SelectItem>
                                    <SelectItem value="is_active">Ativo / Inativo</SelectItem>
                                    <SelectItem value="is_featured">Destaque</SelectItem>
                                    <SelectItem value="specs:area_total">Características (Área)</SelectItem>
                                    <SelectItem value="specs:quartos">Características (Dormitórios)</SelectItem>
                                    <SelectItem value="amenities:piscina">Lazer (Piscina)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Descrição (Opcional)</Label>
                            <Textarea value={newChart.description} onChange={e => setNewChart({ ...newChart, description: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateChart} disabled={!canCreateChart}>Criar Gráfico</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Visibility Dialog */}
            <Dialog open={isVisibilityOpen} onOpenChange={setIsVisibilityOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Visibilidade: {selectedChart?.title}</DialogTitle>
                        <DialogDescription>Selecione quais usuários podem visualizar este gráfico</DialogDescription>
                    </DialogHeader>
                    <Card className="max-h-[300px] overflow-y-auto">
                        <Table>
                            <TableBody>
                                {profiles.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="py-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{p.full_name}</span>
                                                <span className="text-xs text-muted-foreground">{p.role}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-2">
                                            <Button
                                                variant={chartVisibility.includes(p.id) ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => toggleVisibility(p.id)}
                                                disabled={!canEditChart}
                                            >
                                                {chartVisibility.includes(p.id) ? "Visível" : "Privado"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                    <DialogFooter>
                        <Button onClick={() => setIsVisibilityOpen(false)}>Pronto</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

