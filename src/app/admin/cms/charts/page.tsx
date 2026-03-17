'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission, isMenuAllowed } from '@/lib/permissions'
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
import { BarChart3, PieChart, LineChart, AreaChart, Hash, Plus, Trash2, Users, Loader2, Pencil } from 'lucide-react'

type ChartType = 'bar' | 'pie' | 'donut' | 'line' | 'area' | 'number'

interface ChartConfig {
    groupBy: string
    color: string
    palette: string
}

interface Chart {
    id: string
    title: string
    description: string
    type: ChartType
    data_source: string
    config: ChartConfig
}

const DEFAULT_CHART_CONFIG: ChartConfig = {
    groupBy: 'status',
    color: '#0f172a',
    palette: 'classic'
}

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
    { value: 'bar', label: 'Barra' },
    { value: 'line', label: 'Linha' },
    { value: 'area', label: 'Área' },
    { value: 'pie', label: 'Pizza' },
    { value: 'donut', label: 'Rosca' },
    { value: 'number', label: 'Número (KPI)' },
]

const DATA_SOURCE_OPTIONS = [
    { value: 'properties', label: 'Imóveis (Contagem)' },
    { value: 'property_values', label: 'Imóveis (Soma de Valores)' },
    { value: 'leads', label: 'Leads (Contagem)' },
    { value: 'performance_views', label: 'Visualizações (Soma)' },
    { value: 'performance_clicks', label: 'Cliques (Soma)' },
    { value: 'registered_vs_accessed', label: 'Cadastrados vs Acessados (Pro)' },
]

const GROUP_BY_OPTIONS = [
    { value: 'status', label: 'Status do Imóvel' },
    { value: 'type_id', label: 'Tipo de Imóvel' },
    { value: 'construction_partner_id', label: 'Construtora' },
    { value: 'is_exterior', label: 'Brasil / Exterior' },
    { value: 'locale', label: 'Idioma' },
    { value: 'address_state', label: 'Estado' },
    { value: 'address_city', label: 'Cidade' },
    { value: 'address_uf', label: 'UF' },
    { value: 'address_neighborhood', label: 'Bairro' },
    { value: 'is_active', label: 'Ativo / Inativo' },
    { value: 'is_featured', label: 'Destaque' },
    { value: 'plan_index', label: 'Plantas' },
    { value: 'specs:area_total', label: 'Características (Área Total)' },
    { value: 'specs:quartos', label: 'Características (Dormitórios)' },
    { value: 'specs:banheiros', label: 'Características (Banheiros)' },
    { value: 'amenities:piscina', label: 'Lazer (Piscina)' },
]

const PALETTE_OPTIONS = [
    { value: 'classic', label: 'Clássica', colors: ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'] },
    { value: 'ocean', label: 'Oceano', colors: ['#0ea5e9', '#22d3ee', '#14b8a6', '#38bdf8', '#06b6d4'] },
    { value: 'sunset', label: 'Pôr do Sol', colors: ['#f97316', '#fb7185', '#f43f5e', '#a855f7', '#8b5cf6'] },
    { value: 'forest', label: 'Floresta', colors: ['#065f46', '#10b981', '#84cc16', '#22c55e', '#16a34a'] },
    { value: 'pastel', label: 'Pastel', colors: ['#fbcfe8', '#fecaca', '#fde68a', '#bfdbfe', '#c7d2fe'] },
]

const DATA_SOURCE_LABELS = DATA_SOURCE_OPTIONS.reduce((acc, item) => {
    acc[item.value] = item.label
    return acc
}, {} as Record<string, string>)

const GROUP_BY_LABELS = GROUP_BY_OPTIONS.reduce((acc, item) => {
    acc[item.value] = item.label
    return acc
}, {} as Record<string, string>)

const getDefaultChart = (): Partial<Chart> => ({
    title: '',
    description: '',
    type: 'bar',
    data_source: 'properties',
    config: { ...DEFAULT_CHART_CONFIG },
})

const normalizeConfig = (config: any): ChartConfig => {
    if (!config || typeof config !== 'object') return { ...DEFAULT_CHART_CONFIG }
    return { ...DEFAULT_CHART_CONFIG, ...config }
}

export default function ChartsManagementPage() {
    const [charts, setCharts] = useState<Chart[]>([])
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingChartId, setEditingChartId] = useState<string | null>(null)
    const [newChart, setNewChart] = useState<Partial<Chart>>(getDefaultChart())
    const [menuAccess, setMenuAccess] = useState(false)
    const [menuAccessLoading, setMenuAccessLoading] = useState(true)
    const { profile } = useAuthStore()
    const supabase = createClient()
    const canCreateChart = hasPermission(profile, 'charts', 'create')
    const canEditChart = hasPermission(profile, 'charts', 'edit')
    const canDeleteChart = hasPermission(profile, 'charts', 'delete')
    const canViewChart = !!profile && hasPermission(profile, 'charts', 'view') && menuAccess

    useEffect(() => {
        let isActive = true
        const checkMenuAccess = async () => {
            if (!profile) {
                if (isActive) {
                    setMenuAccess(false)
                    setMenuAccessLoading(false)
                }
                return
            }
            if (profile.role === 'hakunaadm') {
                if (isActive) {
                    setMenuAccess(true)
                    setMenuAccessLoading(false)
                }
                return
            }

            const hasExplicitPermissions = !!(profile as any)?.permissions || !!(profile as any)?.custom_role?.permissions
            if (hasExplicitPermissions) {
                if (isActive) {
                    setMenuAccess(isMenuAllowed(profile, '/admin/cms/charts'))
                    setMenuAccessLoading(false)
                }
                return
            }

            const { data } = await supabase
                .from('cms_menus')
                .select('required_roles')
                .eq('path', '/admin/cms/charts')
                .maybeSingle()

            const roles = Array.isArray(data?.required_roles) ? data?.required_roles : []
            if (isActive) {
                setMenuAccess(roles.includes(profile.role))
                setMenuAccessLoading(false)
            }
        }

        void checkMenuAccess()
        return () => {
            isActive = false
        }
    }, [profile, supabase])

    useEffect(() => {
        if (profile && menuAccess) {
            fetchData()
        }
        if (profile && !menuAccess && !menuAccessLoading) {
            setIsLoading(false)
        }
    }, [profile, menuAccess, menuAccessLoading])

    const resetChartForm = () => {
        setNewChart(getDefaultChart())
        setEditingChartId(null)
    }

    const openCreate = () => {
        resetChartForm()
        setIsCreateOpen(true)
    }

    const openEdit = (chart: Chart) => {
        setEditingChartId(chart.id)
        setNewChart({
            ...chart,
            config: normalizeConfig(chart.config),
        })
        setIsCreateOpen(true)
    }

    const updateConfig = (patch: Partial<ChartConfig>) => {
        setNewChart(prev => ({
            ...prev,
            config: { ...normalizeConfig(prev.config), ...patch }
        }))
    }

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

    const handleSaveChart = async () => {
        const isEditing = !!editingChartId
        if (isEditing && !canEditChart) {
            toast.error('Sem permissão para editar gráficos')
            return
        }
        if (!isEditing && !canCreateChart) {
            toast.error('Sem permissão para criar gráficos')
            return
        }
        if (!newChart.title) return toast.error('Título é obrigatório')

        const payload = {
            title: newChart.title,
            description: newChart.description || '',
            type: (newChart.type || 'bar') as ChartType,
            data_source: newChart.data_source || 'properties',
            config: normalizeConfig(newChart.config),
        }

        try {
            if (isEditing) {
                const { data, error } = await supabase
                    .from('dashboard_charts')
                    .update(payload)
                    .eq('id', editingChartId)
                    .select()
                    .single()

                if (error) throw error

                setCharts(prev => prev.map(c => c.id === editingChartId ? data : c))
                toast.success('Gráfico atualizado com sucesso!')
            } else {
                const { data, error } = await supabase
                    .from('dashboard_charts')
                    .insert([payload])
                    .select()
                    .single()

                if (error) throw error

                setCharts([data, ...charts])
                toast.success('Gráfico criado com sucesso!')
            }

            setIsCreateOpen(false)
            resetChartForm()
        } catch (error: any) {
            toast.error('Erro ao salvar gráfico', { description: error.message })
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

    if (isLoading || menuAccessLoading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )

    if (!canViewChart) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
                <h2 className="text-xl font-bold">Acesso restrito</h2>
                <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestão de Gráficos</h1>
                    <p className="text-muted-foreground mt-1">Crie e gerencie análises dinâmicas para o dashboard</p>
                </div>
                <Button onClick={openCreate} disabled={!canCreateChart} title={!canCreateChart ? 'Sem permissão' : undefined}>
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
                                        {chart.type === 'donut' && <PieChart className="w-4 h-4" />}
                                        {chart.type === 'line' && <LineChart className="w-4 h-4" />}
                                        {chart.type === 'area' && <AreaChart className="w-4 h-4" />}
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
                                    <Badge variant="outline">{DATA_SOURCE_LABELS[chart.data_source] || chart.data_source}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{GROUP_BY_LABELS[chart.config?.groupBy] || chart.config?.groupBy || '-'}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                openEdit(chart)
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
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
                setIsCreateOpen(open)
                if (!open) resetChartForm()
            }}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingChartId ? 'Editar Gráfico Dinâmico' : 'Novo Gráfico Dinâmico'}</DialogTitle>
                        <DialogDescription>Configure os dados, agrupamentos e aparência da sua análise</DialogDescription>
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
                                        {CHART_TYPE_OPTIONS.map(option => (
                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                        ))}
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
                                        {DATA_SOURCE_OPTIONS.map(option => (
                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Agrupar por (Campo do banco)</Label>
                            <Select value={newChart.config?.groupBy} onValueChange={v => updateConfig({ groupBy: v ?? 'status' })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {GROUP_BY_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Cor principal</Label>
                                <Input
                                    type="color"
                                    value={newChart.config?.color || DEFAULT_CHART_CONFIG.color}
                                    onChange={(e) => updateConfig({ color: e.target.value })}
                                    className="h-12 p-2"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Paleta de cores</Label>
                                <Select value={newChart.config?.palette} onValueChange={(v) => updateConfig({ palette: v ?? DEFAULT_CHART_CONFIG.palette })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PALETTE_OPTIONS.map(option => (
                                            <SelectItem key={option.value} value={option.value}>
                                                <div className="flex items-center gap-2">
                                                    <span>{option.label}</span>
                                                    <span className="flex items-center gap-1">
                                                        {option.colors.map(color => (
                                                            <span key={color} className="h-3 w-3 rounded-full border" style={{ backgroundColor: color }} />
                                                        ))}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Descrição (Opcional)</Label>
                            <Textarea value={newChart.description} onChange={e => setNewChart({ ...newChart, description: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveChart} disabled={editingChartId ? !canEditChart : !canCreateChart}>
                            {editingChartId ? 'Salvar Alterações' : 'Criar Gráfico'}
                        </Button>
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

