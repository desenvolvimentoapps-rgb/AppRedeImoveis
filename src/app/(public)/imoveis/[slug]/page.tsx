'use client'

import { useState, useEffect, use, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Property, CMSField, CMSSettings } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import {
    MapPin, Bed, Bath, Maximize, CheckCircle2, MessageSquare,
    Phone, Mail, ChevronLeft, Calendar, Building, Ruler,
    Waves, ShieldCheck, Share2, ChevronRight, X, ZoomIn,
    Download, Info, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import * as LucideIcons from 'lucide-react'

// Helper to resolve icon name (kebab-case or camelCase) to Lucide Component
const resolveIcon = (iconName: string) => {
    if (!iconName) return LucideIcons.CheckCircle2

    // Normalize to PascalCase (e.g. "bus-front" -> "BusFront")
    const pascalName = iconName
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('')

    return (LucideIcons as any)[pascalName] || (LucideIcons as any)[iconName] || LucideIcons.CheckCircle2
}

export default function PropertyDetailsPage({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
    const params = use(paramsPromise)
    const [property, setProperty] = useState<Property | null>(null)
    const [cmsFields, setCmsFields] = useState<CMSField[]>([])
    const [settings, setSettings] = useState<CMSSettings[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSendingLead, setIsSendingLead] = useState(false)
    const supabase = createClient()

    // Gallery state
    const [activeImage, setActiveImage] = useState(0)
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)

    // Form lead
    const [leadName, setLeadName] = useState('')
    const [leadEmail, setLeadEmail] = useState('')
    const [leadPhone, setLeadPhone] = useState('')
    const [leadMsg, setLeadMsg] = useState('Olá, gostaria de mais informações sobre este imóvel.')

    const [similarProperties, setSimilarProperties] = useState<Property[]>([])

    useEffect(() => {
        const fetchData = async () => {
            if (!params?.slug) return
            setIsLoading(true)

            // Fetch property, fields, and settings
            const [propRes, fieldRes, settRes] = await Promise.all([
                supabase.from('properties').select('*, type:property_types(name)').eq('slug', params.slug).single(),
                supabase.from('cms_fields').select('*'),
                supabase.from('cms_settings').select('*')
            ])

            if (propRes.data) {
                const propertyData = propRes.data
                setProperty(propertyData)

                // Track View (Increment view_count)
                await supabase.rpc('increment_property_view', { property_id: propertyData.id })

                // Fetch Similar Properties (Same type, excluding current)
                const { data: similar } = await supabase
                    .from('properties')
                    .select('*, type:property_types(name)')
                    .eq('type_id', propertyData.type_id)
                    .neq('id', propertyData.id)
                    .eq('is_active', true)
                    .limit(4)

                setSimilarProperties(similar || [])
            }

            if (fieldRes.data) setCmsFields(fieldRes.data)
            if (settRes.data) setSettings(settRes.data)

            setIsLoading(false)
        }
        fetchData()
    }, [params?.slug, supabase])

    const companyInfo = useMemo(() => {
        const info = settings.find(s => s.key === 'company_info')?.value
        return info || { whatsapp: '5541999999999' }
    }, [settings])

    const handleSendLead = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!property) return
        setIsSendingLead(true)

        try {
            const { error } = await supabase.from('leads').insert([{
                property_id: property.id,
                name: leadName,
                email: leadEmail,
                phone: leadPhone,
                message: leadMsg
            }])

            if (error) throw error

            toast.success('Contato enviado com sucesso! Retornaremos em breve.')
            setLeadName('')
            setLeadEmail('')
            setLeadPhone('')
        } catch (error: any) {
            toast.error('Erro ao enviar contato', { description: error.message })
        } finally {
            setIsSendingLead(false)
        }
    }

    const handleWhatsApp = async (isInternational: boolean = false) => {
        if (!property) return

        // Track Click (Increment click_count)
        await supabase.rpc('increment_property_click', { property_id: property.id })

        const whatsappConfig = settings.find(s => s.key === 'whatsapp_config')?.value || {}

        let targetNumber = isInternational
            ? (property.whatsapp_intl || whatsappConfig.default_intl || companyInfo.whatsapp || '5541999999999')
            : (property.whatsapp_br || whatsappConfig.default_br || companyInfo.whatsapp || '5541999999999')

        const template = isInternational
            ? (whatsappConfig.message_template_intl || "Hello! I'm interested in the property: {property_title}. (Ref: {property_code}). Link: {property_url}")
            : (whatsappConfig.message_template_br || whatsappConfig.message_template || "Olá! Gostaria de mais informações sobre o imóvel: {property_title}. (Código: {property_code}). Link: {property_url}")

        const propertyUrl = typeof window !== 'undefined' ? window.location.href : ''
        const message = template
            .replace(/{property_title}/g, property.title)
            .replace(/{property_code}/g, property.code)
            .replace(/{property_url}/g, propertyUrl)

        const encodedMsg = encodeURIComponent(message)
        window.open(`https://wa.me/${targetNumber.replace(/\D/g, '')}?text=${encodedMsg}`, '_blank')
    }

    const summaryFields = useMemo(() => {
        return cmsFields
            .filter(f => f.show_in_summary)
            .sort((a, b) => (a.summary_order || 0) - (b.summary_order || 0))
    }, [cmsFields])

    const nextImage = () => {
        if (!property?.images?.length) return
        setActiveImage((prev) => (prev + 1) % property.images.length)
    }

    const prevImage = () => {
        if (!property?.images?.length) return
        setActiveImage((prev) => (prev - 1 + property.images.length) % property.images.length)
    }

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Preparando detalhes exclusivos...</p>
        </div>
    )

    if (!property) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <h1 className="text-2xl font-bold">Imóvel não encontrado</h1>
            <Link href="/"><Button>Voltar para o início</Button></Link>
        </div>
    )

    const images = property.images && property.images.length > 0
        ? property.images
        : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=100']

    return (
        <div className="bg-slate-50/50 min-h-screen pb-24">
            {/* Premium Header / Gallery Navigation */}
            <div className="bg-white border-b sticky top-0 z-40 px-4 py-3 shadow-sm flex items-center justify-between backdrop-blur-md bg-white/90">
                <Link href="/">
                    <Button variant="ghost" size="sm" className="font-bold flex items-center gap-2">
                        <ChevronLeft className="w-4 h-4" /> Voltar para busca
                    </Button>
                </Link>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => {
                        navigator.clipboard.writeText(window.location.href)
                        toast.success('Link copiado!')
                    }}>
                        <Share2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Professional Gallery Section */}
            <section className="container max-w-7xl mx-auto px-0 sm:px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 relative group rounded-2xl overflow-hidden shadow-2xl bg-black aspect-[16/10]">
                    <img
                        src={images[activeImage]}
                        className="w-full h-full object-cover transition-opacity duration-500 cursor-zoom-in"
                        alt={property.title}
                        onClick={() => setIsLightboxOpen(true)}
                    />

                    {/* Navigation Arrows */}
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 rounded-full bg-black/40 text-white hover:bg-black/60 pointer-events-auto backdrop-blur-sm border-none opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={prevImage}
                        >
                            <ChevronLeft className="w-8 h-8" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 rounded-full bg-black/40 text-white hover:bg-black/60 pointer-events-auto backdrop-blur-sm border-none opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={nextImage}
                        >
                            <ChevronRight className="w-8 h-8" />
                        </Button>
                    </div>

                    {/* Image Counter */}
                    <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border border-white/20">
                        {activeImage + 1} / {images.length}
                    </div>

                    <div className="absolute top-6 left-6">
                        <Badge className="bg-primary text-white border-none shadow-xl py-1.5 px-4 font-black uppercase text-[10px] tracking-widest">
                            {(property as any).type?.name}
                        </Badge>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                    {images.map((img, i) => (
                        <div
                            key={i}
                            className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-300 ${activeImage === i ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-70 hover:opacity-100'}`}
                            onClick={() => setActiveImage(i)}
                        >
                            <img src={img} className="w-full h-full object-cover" alt="" />
                            {activeImage === i && <div className="absolute inset-0 bg-primary/10" />}
                        </div>
                    ))}
                </div>
            </section>

            {/* Lightbox Modal */}
            <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
                <DialogContent className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 transition-all">
                    <div className="relative w-full h-full flex items-center justify-center">
                        <img src={images[activeImage]} className="max-w-full max-h-full object-contain" alt="" />
                        <button
                            onClick={() => setIsLightboxOpen(false)}
                            className="absolute top-4 right-4 text-white hover:text-primary transition-colors"
                        >
                            <X className="w-8 h-8" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="container max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Main Content Area */}
                <div className="lg:col-span-8 space-y-10">
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 opacity-60 text-xs font-black uppercase tracking-[0.2em] text-primary">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {property.address_city} - {property.address_uf}
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">{property.title}</h1>
                                {property.address_street && (
                                    <p className="text-slate-500 font-medium">{property.address_street}, {property.address_neighborhood}</p>
                                )}
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Investimento Especial</span>
                                <p className="text-4xl font-black text-primary tracking-tighter">
                                    {property.value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.value) : 'Consulte'}
                                </p>
                            </div>
                        </div>

                        {/* Quick Features Row - Dynamic */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {summaryFields.length > 0 ? (
                                summaryFields.map(field => {
                                    const Icon = resolveIcon(field.icon || 'Info')
                                    const val = (property.specs as any)?.[field.name] || (property.amenities as any)?.[field.name] || (property.features as any)?.[field.name] || 0

                                    return (
                                        <div key={field.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 group hover:border-primary/30 transition-all">
                                            <Icon className="w-6 h-6 text-primary mb-1" style={{ color: 'var(--primary)' }} />
                                            <span className="text-xl font-black text-slate-900">{typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : val}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{field.label}</span>
                                        </div>
                                    )
                                })
                            ) : (
                                <>
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 group hover:border-primary/30 transition-all">
                                        <Bed className="w-6 h-6 text-primary mb-1" style={{ color: 'var(--primary)' }} />
                                        <span className="text-xl font-black text-slate-900">{property.specs?.quartos || 0}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dormitórios</span>
                                    </div>
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 group hover:border-primary/30 transition-all">
                                        <Bath className="w-6 h-6 text-primary mb-1" style={{ color: 'var(--primary)' }} />
                                        <span className="text-xl font-black text-slate-900">{property.specs?.banheiros || 0}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Banheiros</span>
                                    </div>
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 group hover:border-primary/30 transition-all">
                                        <Maximize className="w-6 h-6 text-primary mb-1" style={{ color: 'var(--primary)' }} />
                                        <span className="text-xl font-black text-slate-900">{property.specs?.area_total || 0}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">m² Área Total</span>
                                    </div>
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 group hover:border-primary/30 transition-all">
                                        <Building className="w-6 h-6 text-primary mb-1" style={{ color: 'var(--primary)' }} />
                                        <span className="text-xl font-black text-slate-900">{property.code}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Referência</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Additional Codes Section */}
                        <div className="flex flex-wrap gap-4 pt-2">
                            <Badge variant="outline" className="px-3 py-1 border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Ref: <span className="ml-1 text-slate-900">{property.code}</span>
                            </Badge>
                            {property.real_estate_code && (
                                <Badge variant="outline" className="px-3 py-1 border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Cód. OLI: <span className="ml-1 text-slate-900">{property.real_estate_code}</span>
                                </Badge>
                            )}
                            {(property.show_internal_code !== false) && property.internal_code && (
                                <Badge variant="outline" className="px-3 py-1 border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Cód. Interno: <span className="ml-1 text-slate-900">{property.internal_code}</span>
                                </Badge>
                            )}
                            {(property.show_owner_code !== false) && property.owner_code && (
                                <Badge variant="outline" className="px-3 py-1 border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Cód. Proprietário: <span className="ml-1 text-slate-900">{property.owner_code}</span>
                                </Badge>
                            )}
                            {(property.show_construction_code !== false) && property.construction_code && (
                                <Badge variant="outline" className="px-3 py-1 border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Cód. Construtora: <span className="ml-1 text-slate-900">{property.construction_code}</span>
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50/50 pt-8 px-8">
                            <CardTitle className="text-xl font-black flex items-center gap-2">
                                <div className="h-6 w-1.5 bg-primary rounded-full" />
                                Descrição do Imóvel
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="prose prose-slate max-w-none">
                                <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-wrap">{property.description}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dynamic Specifications Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {['ficha_tecnica', 'comodidades', 'caracteristicas'].map((sect) => {
                            const sectionFields = cmsFields.filter(f => f.section === sect)
                            const sectionData = property[sect === 'ficha_tecnica' ? 'specs' : sect === 'comodidades' ? 'amenities' : 'features' as 'specs' | 'amenities' | 'features'] || {}

                            // Only show section if it has data
                            if (Object.keys(sectionData).length === 0) return null

                            return (
                                <Card key={sect} className="border-none shadow-sm rounded-3xl overflow-hidden bg-white h-full">
                                    <CardHeader className="bg-slate-50/50 pt-6 px-8">
                                        <CardTitle className="text-lg font-black capitalize flex items-center gap-2">
                                            <div className="h-4 w-1 bg-primary rounded-full" />
                                            {sect.replace('_', ' ')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-8">
                                        <ul className="space-y-4">
                                            {Object.entries(sectionData).map(([key, val]) => {
                                                const field = cmsFields.find(f => f.name === key)
                                                if (!field) return null
                                                const Icon = resolveIcon(field.icon || 'CheckCircle2')

                                                return (
                                                    <li key={key} className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                                                <Icon className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-sm font-semibold text-slate-600">{field.label}</span>
                                                        </div>
                                                        <div className="text-sm font-black text-slate-900">
                                                            {typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : val}
                                                        </div>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>

                    {/* Map Section */}
                    <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50/50 pt-8 px-8">
                            <CardTitle className="text-xl font-black flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-primary" /> Localização Privilegiada
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="h-[400px] w-full bg-slate-100 flex items-center justify-center relative grayscale hover:grayscale-0 transition-all duration-700">
                                <iframe
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    allowFullScreen
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(`${property.address_street}${property.address_number ? ', ' + property.address_number : ''}, ${property.address_city}, ${property.address_uf}`)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                ></iframe>
                                <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 max-w-xs">
                                    <p className="text-xs font-black uppercase text-primary mb-1">Endereço</p>
                                    <p className="text-sm font-bold text-slate-800 leading-tight">
                                        {property.address_street}{property.address_number ? ', ' + property.address_number : ''}, {property.address_neighborhood} <br />
                                        {property.address_city} - {property.address_uf}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar - Conversion Area */}
                <div className="lg:col-span-4">
                    <div className="sticky top-32 space-y-6">
                        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-primary text-white">
                            <CardHeader className="p-10 pb-6 text-center">
                                <h3 className="text-3xl font-black mb-2 tracking-tighter">Agende uma Visita</h3>
                                <p className="text-white/80 text-sm font-medium leading-relaxed">Deixe seus dados e nosso especialista entrará em contato em menos de 15 minutos.</p>
                            </CardHeader>
                            <CardContent className="p-10 pt-0">
                                <form onSubmit={handleSendLead} className="space-y-5">
                                    <div className="space-y-1">
                                        <Input
                                            placeholder="Nome Completo"
                                            value={leadName}
                                            onChange={e => setLeadName(e.target.value)}
                                            required
                                            className="h-14 bg-white/10 border-white/20 text-white placeholder:text-white/60 rounded-2xl focus:bg-white focus:text-slate-900 transition-all ring-offset-primary"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Input
                                            type="email"
                                            placeholder="Seu melhor e-mail"
                                            value={leadEmail}
                                            onChange={e => setLeadEmail(e.target.value)}
                                            required
                                            className="h-14 bg-white/10 border-white/20 text-white placeholder:text-white/60 rounded-2xl focus:bg-white focus:text-slate-900 transition-all ring-offset-primary"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Input
                                            placeholder="Telefone (WhatsApp)"
                                            value={leadPhone}
                                            onChange={e => setLeadPhone(e.target.value)}
                                            required
                                            className="h-14 bg-white/10 border-white/20 text-white placeholder:text-white/60 rounded-2xl focus:bg-white focus:text-slate-900 transition-all ring-offset-primary"
                                        />
                                    </div>
                                    <Textarea
                                        placeholder="Sua mensagem..."
                                        value={leadMsg}
                                        onChange={e => setLeadMsg(e.target.value)}
                                        rows={3}
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60 rounded-2xl focus:bg-white focus:text-slate-900 transition-all ring-offset-primary"
                                    />
                                    <Button size="lg" className="w-full h-16 text-xl font-black bg-white text-primary hover:bg-slate-50 shadow-2xl rounded-2xl transition-all active:scale-95" disabled={isSendingLead}>
                                        {isSendingLead ? 'Enviando...' : 'Falar com Consultor'}
                                    </Button>
                                </form>

                                <div className="mt-8 pt-8 border-t border-white/10 flex flex-col gap-4">
                                    <p className="text-center text-[10px] uppercase font-black tracking-widest text-white/60">Conversar com Especialista</p>
                                    <div className="grid grid-cols-1 gap-3">
                                        {(property.show_whatsapp_br !== false) && (
                                            <Button
                                                onClick={() => handleWhatsApp(false)}
                                                variant="outline"
                                                className="w-full h-14 rounded-2xl border-white/20 bg-white/5 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all group"
                                            >
                                                <MessageSquare className="w-5 h-5 mr-3 text-emerald-400 group-hover:text-white" />
                                                <div className="flex flex-col items-start">
                                                    <span className="font-bold text-xs">Atendimento</span>
                                                    <span className="text-[10px] opacity-70">Brasil (WhatsApp)</span>
                                                </div>
                                            </Button>
                                        )}
                                        {property.show_whatsapp_intl && (
                                            <Button
                                                onClick={() => handleWhatsApp(true)}
                                                variant="outline"
                                                className="w-full h-14 rounded-2xl border-white/20 bg-white/5 hover:bg-blue-500 hover:border-blue-500 hover:text-white transition-all group"
                                            >
                                                <MessageSquare className="w-5 h-5 mr-3 text-blue-300 group-hover:text-white" />
                                                <div className="flex flex-col items-start">
                                                    <span className="font-bold text-xs">International</span>
                                                    <span className="text-[10px] opacity-70">Support (WhatsApp)</span>
                                                </div>
                                            </Button>
                                        )}
                                        <a href={`tel:${companyInfo.whatsapp}`} className="block">
                                            <Button variant="outline" className="w-full h-14 rounded-2xl border-white/20 bg-white/5 hover:bg-white hover:text-primary transition-all group">
                                                <Phone className="w-5 h-5 mr-3 text-white/60 group-hover:text-primary" />
                                                <span className="font-bold">Ligar agora</span>
                                            </Button>
                                        </a>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Additional Info / Security */}
                        <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold">Compra Segura</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-black">Certificação Olivia Prado</span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed italic">"Garantimos transparência total e assessoria jurídica completa para sua tranquilidade e segurança financeira."</p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Similar Properties Section */}
            {similarProperties.length > 0 && (
                <section className="container max-w-7xl mx-auto px-4 mt-20">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Imóveis Similares</h2>
                            <p className="text-muted-foreground font-medium">Outras opções que podem lhe interessar neste perfil</p>
                        </div>
                        <Link href="/imoveis">
                            <Button variant="ghost" className="font-bold text-primary hover:text-primary/80 hover:bg-primary/5">
                                Ver todos <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {similarProperties.map((p: any) => (
                            <Link key={p.id} href={`/imoveis/${p.slug}`} className="group">
                                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                                    <div className="relative aspect-video overflow-hidden">
                                        <img
                                            src={p.images?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            alt={p.title}
                                        />
                                        <div className="absolute top-3 left-3">
                                            <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none font-bold text-[10px] uppercase">
                                                {p.type?.name}
                                            </Badge>
                                        </div>
                                    </div>
                                    <CardContent className="p-5">
                                        <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1">{p.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" /> {p.address_city} - {p.address_uf}
                                        </p>
                                        <div className="flex items-center justify-between mt-4">
                                            <span className="text-sm font-black text-primary">
                                                {p.value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value) : 'Consulte'}
                                            </span>
                                            <div className="flex gap-3 text-[10px] font-bold text-slate-400">
                                                <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {p.specs?.quartos || 0}</span>
                                                <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {p.specs?.area_total || 0}m²</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}
