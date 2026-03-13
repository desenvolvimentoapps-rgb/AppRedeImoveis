'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts'
import { Loader2, TrendingUp, Users, Building2, AlertCircle, Maximize2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const COLORS = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function MyChartsPage() {
    const { profile } = useAuthStore()
    const [charts, setCharts] = useState<any[]>([])
    const [dataSources, setDataSources] = useState<{ properties: any[], leads: any[] }>({ properties: [], leads: [] })
    const [isLoading, setIsLoading] = useState(true)
    const [expandedChart, setExpandedChart] = useState<any>(null)
    const supabase = createClient()

    useEffect(() => {
        if (profile) {
            fetchChartsAndData()
        }
    }, [profile])

    const fetchChartsAndData = async () => {
        setIsLoading(true)

        // 1. Fetch available charts for this user (respect visibility)
        let chartQuery = supabase.from('dashboard_charts').select('*')

        const { data: visibleChartIds } = await supabase
            .from('chart_visibility')
            .select('chart_id')
            .eq('profile_id', profile?.id)

        const ids = (visibleChartIds || []).map((v: { chart_id: string }) => v.chart_id)
        if (ids.length === 0) {
            setCharts([])
            setDataSources({ properties: [], leads: [] })
            setIsLoading(false)
            return
        }
        chartQuery = chartQuery.in('id', ids)

        const [chartsRes, propRes, leadRes] = await Promise.all([
            chartQuery,
            supabase.from('properties').select('*'),
            supabase.from('leads').select('*')
        ])

        if (chartsRes.data) setCharts(chartsRes.data)
        setDataSources({
            properties: propRes.data || [],
            leads: leadRes.data || []
        })
        setIsLoading(false)
    }

    const processChartData = (chart: any) => {
        const sourceData = dataSources[chart.data_source as keyof typeof dataSources] || []
        const groupBy = chart.config?.groupBy || 'status'

        if (chart.type === 'number') {
            return sourceData.length
        }

        if (chart.data_source === 'performance_views' || chart.data_source === 'performance_clicks') {
            const field = chart.data_source === 'performance_views' ? 'view_count' : 'click_count'
            const groups: Record<string, number> = {}
            sourceData.forEach(item => {
                let key = item[groupBy] || 'Outros'
                if (typeof key === 'boolean') key = key ? 'Sim' : 'Não'
                groups[key] = (groups[key] || 0) + (item[field] || 0)
            })
            return Object.entries(groups).map(([name, value]) => ({ name, value }))
        }

        if (chart.data_source === 'registered_vs_accessed') {
            const totalProps = sourceData.length
            const totalViews = sourceData.reduce((acc, p) => acc + (p.view_count || 0), 0)
            const totalClicks = sourceData.reduce((acc, p) => acc + (p.click_count || 0), 0)
            return [
                { name: 'Total Imóveis', value: totalProps },
                { name: 'Total Visitas', value: totalViews },
                { name: 'Total Cliques', value: totalClicks }
            ]
        }

        const groups: Record<string, number> = {}
        sourceData.forEach(item => {
            let val: any = ''
            if (groupBy.startsWith('specs:')) val = item.specs?.[groupBy.split(':')[1]]
            else if (groupBy.startsWith('amenities:')) val = item.amenities?.[groupBy.split(':')[1]]
            else val = item[groupBy]

            if (val === null || val === undefined || val === '') val = 'Não Definido'
            if (typeof val === 'boolean') val = val ? 'Sim' : 'Não'
            groups[val] = (groups[val] || 0) + 1
        })

        return Object.entries(groups).map(([name, value]) => ({ name, value }))
    }

    const expandedChartData = expandedChart ? processChartData(expandedChart) : []
    const expandedTotal = typeof expandedChartData === 'number'
        ? expandedChartData
        : Array.isArray(expandedChartData)
            ? expandedChartData.reduce((total, item) => total + (Number(item?.value) || 0), 0)
            : 0

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )

    if (charts.length === 0) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
            <div className="p-4 rounded-full bg-slate-100 text-slate-400">
                <AlertCircle className="w-12 h-12" />
            </div>
            <div className="max-w-md">
                <h2 className="text-xl font-bold text-slate-900">Nenhum gráfico disponível</h2>
                <p className="text-muted-foreground mt-2">Você ainda não tem permissão para visualizar gráficos. Solicite a liberação ao gestor do sistema.</p>
            </div>
        </div>
    )

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Meus Gráficos</h1>
                <p className="text-muted-foreground mt-1">Análise de desempenho e indicadores em tempo real</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {charts.map((chart) => {
                    const chartData = processChartData(chart)
                    const numberValue = typeof chartData === 'number'
                        ? chartData
                        : Array.isArray(chartData)
                            ? chartData.reduce((total, item) => total + (Number(item?.value) || 0), 0)
                            : 0

                    if (chart.type === 'number') {
                        return (
                            <Card key={chart.id} className="overflow-hidden border-none shadow-sm bg-primary text-white cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setExpandedChart(chart)}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-sm font-medium text-white/70 uppercase tracking-wider">{chart.title}</CardTitle>
                                        <Maximize2 className="w-4 h-4 text-white/40" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-4xl font-black">{numberValue}</div>
                                    <p className="text-xs text-white/60 mt-2">{chart.description || 'Total acumulado'}</p>
                                </CardContent>
                            </Card>
                        )
                    }

                    return (
                        <Card key={chart.id} className="col-span-1 md:col-span-1 border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary/20" onClick={() => setExpandedChart(chart)}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-lg font-bold">{chart.title}</CardTitle>
                                    {chart.description && <CardDescription className="line-clamp-1">{chart.description}</CardDescription>}
                                </div>
                                <Maximize2 className="w-4 h-4 text-slate-300" />
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full pt-4">
                                    <ChartRenderer type={chart.type} data={chartData} />
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Expanded Chart Dialog */}
            <Dialog open={!!expandedChart} onOpenChange={() => setExpandedChart(null)}>
                <DialogContent showCloseButton={false} className="max-w-[90vw] w-[90vw] h-[90vh] flex flex-col">
                    <DialogHeader className="flex flex-row justify-between items-center border-b pb-4 mb-4">
                        <div>
                            <DialogTitle className="text-2xl font-black">{expandedChart?.title}</DialogTitle>
                            <CardDescription>{expandedChart?.description || 'Visualização detalhada da métrica'}</CardDescription>
                        </div>
                        <DialogClose render={<Button variant="ghost" size="icon" className="rounded-full" />}>
                            <X className="w-4 h-4" />
                            <span className="sr-only">Fechar</span>
                        </DialogClose>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 bg-slate-50 rounded-2xl p-6">
                        {expandedChart && (
                            <div className="h-full w-full">
                                {expandedChart.type === 'number' ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <div className="text-8xl font-black text-primary animate-in zoom-in duration-500">{expandedTotal}</div>
                                        <div className="text-xl text-slate-500 font-medium mt-4">{expandedChart.title}</div>
                                    </div>
                                ) : (
                                    <ChartRenderer type={expandedChart.type} data={Array.isArray(expandedChartData) ? expandedChartData : []} expanded />
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <Card className="bg-white border-slate-100 shadow-sm">
                            <CardHeader className="py-3 px-4">
                                <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Fonte</CardDescription>
                                <CardTitle className="text-sm font-bold capitalize">{expandedChart?.data_source}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card className="bg-white border-slate-100 shadow-sm">
                            <CardHeader className="py-3 px-4">
                                <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Total</CardDescription>
                                <CardTitle className="text-sm font-bold">
                                    {expandedTotal}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card className="bg-white border-slate-100 shadow-sm">
                            <CardHeader className="py-3 px-4">
                                <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Agrupado por</CardDescription>
                                <CardTitle className="text-sm font-bold capitalize">{expandedChart?.config?.groupBy || 'N/A'}</CardTitle>
                            </CardHeader>
                        </Card>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ChartRenderer({ type, data, expanded = false }: { type: string, data: any, expanded?: boolean }) {
    const minHeight = expanded ? 360 : 220
    const minWidth = 200

    if (type === 'bar') {
        return (
            <ResponsiveContainer width="100%" height="100%" minHeight={minHeight} minWidth={minWidth}>
                <BarChart data={data as any}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={expanded ? 14 : 12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={expanded ? 14 : 12} tickLine={false} axisLine={false} />
                    <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        )
    }

    if (type === 'pie') {
        return (
            <ResponsiveContainer width="100%" height="100%" minHeight={minHeight} minWidth={minWidth}>
                <PieChart>
                    <Pie
                        data={data as any}
                        cx="50%"
                        cy="50%"
                        innerRadius={expanded ? 100 : 50}
                        outerRadius={expanded ? 150 : 70}
                        paddingAngle={5}
                        dataKey="value"
                        label={expanded}
                    >
                        {(data as any).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                </PieChart>
            </ResponsiveContainer>
        )
    }

    return (
        <ResponsiveContainer width="100%" height="100%" minHeight={minHeight} minWidth={minWidth}>
            <LineChart data={data as any}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={expanded ? 14 : 12} tickLine={false} axisLine={false} />
                <YAxis fontSize={expanded ? 14 : 12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={expanded ? 4 : 3} dot={{ r: expanded ? 6 : 4 }} activeDot={{ r: expanded ? 8 : 6 }} />
            </LineChart>
        </ResponsiveContainer>
    )
}


