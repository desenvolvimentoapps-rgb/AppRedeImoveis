'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, Eye, TrendingUp, Clock, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, differenceInHours, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalProperties: 0,
        totalLeads: 0,
        recentLeads: [] as any[],
        chartData: [] as any[],
        conversionRate: 0,
        avgResponseHours: null as number | null,
    })
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true)

            const [propCount, leadCount, recentLeadsData, propertiesData, viewsData, leadsTimeData] = await Promise.all([
                supabase.from('properties').select('*', { count: 'exact', head: true }),
                supabase.from('leads').select('*', { count: 'exact', head: true }),
                supabase.from('leads').select('*, property:properties(title, code, slug)').order('created_at', { ascending: false }).limit(5),
                supabase.from('properties').select('created_at').order('created_at', { ascending: true }),
                supabase.from('properties').select('view_count'),
                supabase.from('leads').select('created_at, date_contato'),
            ])

            // Process chart data (count by month) last 6 months
            const months: Record<string, number> = {}
            const now = new Date()
            for (let i = 5; i >= 0; i--) {
                const monthName = format(subDays(now, i * 30), 'MMM', { locale: ptBR })
                months[monthName] = 0
            }

            propertiesData.data?.forEach((p: { created_at: string }) => {
                const monthName = format(new Date(p.created_at), 'MMM', { locale: ptBR })
                if (months[monthName] !== undefined) {
                    months[monthName]++
                }
            })

            const chartData = Object.entries(months).map(([name, total]) => ({ name, total }))

            const totalViews = (viewsData.data || []).reduce((acc: number, item: any) => acc + Number(item.view_count || 0), 0)
            const conversionRate = totalViews > 0
                ? ((leadCount.count || 0) / totalViews) * 100
                : 0

            const responseDiffs = (leadsTimeData.data || [])
                .filter((lead: any) => lead.date_contato)
                .map((lead: any) => {
                    const createdAt = new Date(lead.created_at)
                    const contatoDate = startOfDay(new Date(lead.date_contato))
                    return Math.max(0, differenceInHours(contatoDate, createdAt))
                })

            const avgResponseHours = responseDiffs.length
                ? responseDiffs.reduce((sum: number, val: number) => sum + val, 0) / responseDiffs.length
                : null

            setStats({
                totalProperties: propCount.count || 0,
                totalLeads: leadCount.count || 0,
                recentLeads: recentLeadsData.data || [],
                chartData,
                conversionRate,
                avgResponseHours,
            })
            setIsLoading(false)
        }

        fetchDashboardData()
    }, [supabase])

    const formatResponseTime = (hours: number | null) => {
        if (hours === null) return '--'
        if (hours < 24) return `${hours.toFixed(1)}h`
        const days = Math.floor(hours / 24)
        const remHours = Math.round(hours % 24)
        return `${days}d ${remHours}h`
    }

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando dados do painel...</div>

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground mt-2">Bem-vindo ao centro de controle Olivia Prado</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total de Imóveis</CardTitle>
                        <Building2 className="h-5 w-5 text-primary opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">{stats.totalProperties}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-emerald-500" /> +2 novos nos últimos 30 dias
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Leads Totais</CardTitle>
                        <Users className="h-5 w-5 text-indigo-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">{stats.totalLeads}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Acúmulo total desde o início</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Conversão</CardTitle>
                        <TrendingUp className="h-5 w-5 text-emerald-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">{stats.conversionRate.toFixed(1)}%</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Leads por visualização</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Tempo Médio</CardTitle>
                        <Clock className="h-5 w-5 text-amber-500 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">{formatResponseTime(stats.avgResponseHours)}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Resposta ao primeiro contato</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4 border-none shadow-xl rounded-2xl overflow-hidden bg-card">
                    <CardHeader className="p-6 border-b bg-slate-50/50">
                        <CardTitle className="text-lg font-bold">Crescimento do Catálogo</CardTitle>
                        <p className="text-xs text-muted-foreground">Imóveis cadastrados nos últimos 6 meses</p>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minHeight={240} minWidth={200}>
                                <BarChart data={stats.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar
                                        dataKey="total"
                                        fill="#0f172a"
                                        radius={[4, 4, 0, 0]}
                                        barSize={40}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 border-none shadow-xl rounded-2xl overflow-hidden bg-card">
                    <CardHeader className="p-6 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Leads Recentes</CardTitle>
                        </div>
                        <Link href="/admin/leads">
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary">
                                Ver Todos <ArrowRight className="ml-1 w-3 h-3" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-6">
                            {stats.recentLeads.length === 0 ? (
                                <p className="text-center py-10 text-xs text-muted-foreground">Nenhum lead recebido ainda.</p>
                            ) : stats.recentLeads.map((lead: any) => (
                                <div key={lead.id} className="flex items-center gap-4 group">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                                        {lead.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-bold leading-none truncate">{lead.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                            Interesse: <span className="text-primary font-medium">{lead.property?.title || 'Geral'}</span>
                                        </p>
                                    </div>
                                    <div className="text-[10px] font-medium text-slate-400">
                                        {format(new Date(lead.created_at), 'HH:mm', { locale: ptBR })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
