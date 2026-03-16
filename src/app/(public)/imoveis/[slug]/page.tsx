'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, usePathname } from 'next/navigation'
import { Property, CMSField, CMSSettings } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
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

export default function PropertyDetailsPage() {
    const params = useParams<{ slug: string }>()
    const rawSlug = params?.slug
    const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug
    const pathname = usePathname()
    const locale = pathname?.includes('/imoveis/en/') ? 'en' : 'pt-BR'
    const [property, setProperty] = useState<Property | null>(null)
    const [groupProperties, setGroupProperties] = useState<Property[]>([])
    const [activePlantId, setActivePlantId] = useState<string | null>(null)
    const [cmsFields, setCmsFields] = useState<CMSField[]>([])
    const [settings, setSettings] = useState<CMSSettings[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSendingLead, setIsSendingLead] = useState(false)
    const supabase = createClient()

    const resolveCounterField = (item: Record<string, any>, candidates: string[]) => {
        for (const field of candidates) {
            if (Object.prototype.hasOwnProperty.call(item, field)) return field
        }
        return undefined
    }

    const incrementPropertyCounter = async (propertyId: string, field: string, currentValue: number) => {
        if (!field) return
        const nextValue = Number(currentValue || 0) + 1
        try {
            const { error } = await supabase
                .from('properties')
                .update({ [field]: nextValue })
                .eq('id', propertyId)
            if (!error) {
                setProperty(prev => prev ? ({ ...prev, [field]: nextValue } as any) : prev)
            }
        } catch {
            // Ignore tracking errors
        }
    }

    // Gallery state
    const [activeImage, setActiveImage] = useState(0)
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)
    const [thumbnailStart, setThumbnailStart] = useState(0)
    const THUMBNAILS_PER_PAGE = 4

    // Form lead
    const [leadName, setLeadName] = useState('')
    const [leadEmail, setLeadEmail] = useState('')
    const [leadPhone, setLeadPhone] = useState('')
    const [leadMsg, setLeadMsg] = useState('')
    //const [leadMsg, setLeadMsg] = useState('Olá, gostaria de mais informações sobre este imóvel {property_url} | Código: {property_code}.')

    const [similarProperties, setSimilarProperties] = useState<Property[]>([])
    const [isTourOpen, setIsTourOpen] = useState(false)

    useEffect(() => {
        let isActive = true
        const fetchData = async () => {
            if (!slug) {
                if (isActive) setIsLoading(false)
                return
            }
            setIsLoading(true)
            try {
                // Fetch property, fields, and settings
                const [propRes, fieldRes, settRes] = await Promise.all([
                    supabase.from('properties').select('*, type:property_types(name, types_label_eng), construction_partner:construction_partners(name, trade_name)').eq('slug', slug).eq('locale', locale).single(),
                    supabase.from('cms_fields').select('*'),
                    supabase.from('cms_settings').select('*')
                ])

                if (propRes.error) throw propRes.error
                if (fieldRes.error) throw fieldRes.error
                if (settRes.error) throw settRes.error

                if (propRes.data && isActive) {
                    const propertyData = propRes.data
                    setProperty(propertyData)
                    setActivePlantId(propertyData.id)

                    // Track View (Increment view_count)
                    const viewField = resolveCounterField(propertyData as any, ['view_count'])
                    if (viewField) {
                        await incrementPropertyCounter(propertyData.id, viewField, (propertyData as any)?.[viewField] || 0)
                    }

                    // Fetch Similar Properties (Same type, excluding current)
                    const { data: similar } = await supabase
                        .from('properties')
                        .select('*, type:property_types(name, types_label_eng), construction_partner:construction_partners(name, trade_name)')
                        .eq('type_id', propertyData.type_id)
                        .neq('id', propertyData.id)
                        .eq('is_active', true)
                        .eq('locale', locale)
                        .eq('plan_index', 1)
                        .limit(4)

                    if (isActive) setSimilarProperties(similar || [])

                    if (propertyData.property_group_id) {
                        const { data: groupData } = await supabase
                            .from('properties')
                            .select('*, type:property_types(name, types_label_eng), construction_partner:construction_partners(name, trade_name)')
                            .eq('property_group_id', propertyData.property_group_id)
                            .eq('locale', locale)
                            .order('plan_index', { ascending: true })

                        if (isActive) {
                            const groupList = (groupData || []) as Property[]
                            setGroupProperties(groupList)
                            const current = groupList.find((item) => item.id === propertyData.id) || propertyData
                            setProperty(current)
                            setActivePlantId(current.id)
                        }
                    } else {
                        if (isActive) setGroupProperties([])
                    }
                }

                if (fieldRes.data && isActive) setCmsFields(fieldRes.data)
                if (settRes.data && isActive) setSettings(settRes.data)
            } catch (error: any) {
                if (isActive) {
                    toast.error(copy.loadError, { description: error?.message })
                }
            } finally {
                if (isActive) setIsLoading(false)
            }
        }
        fetchData()

        return () => {
            isActive = false
        }
    }, [slug, supabase, locale])

    const companyInfo = useMemo(() => {
        const info = settings.find(s => s.key === 'company_info')?.value
        return info || { whatsapp: '5541999999999' }
    }, [settings])

    const propertyDetails = useMemo(() => {
        return settings.find(s => s.key === 'property_details')?.value || {}
    }, [settings])

    const isExterior = !!property?.is_exterior
    const useEnglish = locale === 'en' || isExterior
    const propertyBasePath = locale === 'en' ? '/imoveis/en' : '/imoveis'

    const copy = useMemo(() => ({
        otherPlantsTitle: useEnglish ? 'Other floor plans available' : 'Outras plantas disponíveis',
        otherPlantsSubtitle: useEnglish ? 'Select to see specific prices and details.' : 'Selecione para ver valores e detalhes específicos.',
        photosLabel: useEnglish ? 'Photos' : 'Fotos',
        salePrice: useEnglish ? 'Sale price' : 'Valor de venda',
        startingAt: useEnglish ? 'Starting at' : 'Preços a partir de',
        specialInvestment: useEnglish ? 'Special investment' : 'Investimento Especial',
        consult: useEnglish ? 'Inquire' : 'Consulte',
        leadTitle: useEnglish ? 'Schedule a Visit' : 'Agende uma Visita',
        leadSubtitle: useEnglish ? 'Leave your details and our specialist will contact you within 15 minutes.' : 'Deixe seus dados e nosso especialista entrará em contato em menos de 15 minutos.',
        leadSuccess: useEnglish ? 'Contact sent successfully! We will be in touch shortly.' : 'Contato enviado com sucesso! Retornaremos em breve.',
        leadError: useEnglish ? 'Error sending contact' : 'Erro ao enviar contato',
        loadError: useEnglish ? 'Error loading property' : 'Erro ao carregar imóvel',
        sendErrorFallback: useEnglish ? 'Failed to send' : 'Falha ao enviar',
        linkCopied: useEnglish ? 'Link copied!' : 'Link copiado!',
        descriptionTitle: useEnglish ? 'Property Description' : 'Descrição do Imóvel',
        primeLocation: useEnglish ? 'Prime Location' : 'Localização Privilegiada',
        similarTitle: useEnglish ? 'Similar Properties' : 'Imóveis Similares',
        similarSubtitle: useEnglish ? 'Other options that may interest you in this profile' : 'Outras opções que podem lhe interessar neste perfil',
        service: useEnglish ? 'Support' : 'Atendimento',
        callNow: useEnglish ? 'Call now' : 'Ligar agora',
        sendEmail: useEnglish ? 'Send email' : 'Enviar e-mail',
        partnerBuilderLabel: useEnglish ? 'Partner builder' : 'Construtora Parceira',
        backToSearch: useEnglish ? 'Back to search' : 'Voltar para busca',
        notFound: useEnglish ? 'Property not found' : 'Imóvel não encontrado',
        backToHome: useEnglish ? 'Back to home' : 'Voltar para o início',
        sectionLabels: {
            ficha_tecnica: useEnglish ? 'Specifications' : 'Ficha técnica',
            comodidades: useEnglish ? 'Amenities' : 'Comodidades',
            caracteristicas: useEnglish ? 'Features' : 'Características',
        },
    }), [useEnglish])

    const messageTemplate = useMemo(() => {
        return useEnglish
            ? 'Hello, I would like more information about this property {property_url} | Code: {property_code}.'
            : 'Olá, gostaria de mais informações sobre este imóvel {property_url} | Código: {property_code}.'
    }, [useEnglish])

    // Atualiza mensagem automaticamente quando o imóvel carregar
    useEffect(() => {
        if (!property) return

        const parsedMessage = messageTemplate
            .replace(/{property_url}/g, typeof window !== 'undefined' ? window.location.href : '')
            .replace(/{property_code}/g, property.code || '')
            .replace(/{internal_code}/g, property.internal_code || '')

        setLeadMsg(parsedMessage)
    }, [property, messageTemplate])

    const resolveTypeLabel = (item: Property | null) => {
        if (!item?.type) return ''
        if (useEnglish) return (item.type as any).types_label_eng || item.type.name || ''
        return item.type.name || ''
    }

    const resolveFieldLabel = (field: CMSField) => {
        if (useEnglish) return field.fields_label_eng || field.label
        return field.label
    }

    const handleSendLead = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!property) return
        setIsSendingLead(true)

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    propertyId: property.id,
                    propertyTitle: property.title,
                    propertyCode: property.code,
                    propertyInternalCode: property.internal_code,
                    propertyUrl: typeof window !== 'undefined' ? window.location.href : '',
                    name: leadName,
                    email: leadEmail,
                    phone: leadPhone,
                    message: leadMsg,
                }),
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || copy.sendErrorFallback)
            }

            await trackPropertyClick('email')
            toast.success(copy.leadSuccess)
            setLeadName('')
            setLeadEmail('')
            setLeadPhone('')
        } catch (error: any) {
            toast.error(copy.leadError, { description: error.message })
        } finally {
            setIsSendingLead(false)
        }
    }

    const trackPropertyClick = async (channel: 'whatsapp_br' | 'whatsapp_intl' | 'email') => {
        if (!property) return

        const clickField = resolveCounterField(property as any, ['click_count'])
        if (clickField) {
            await incrementPropertyCounter(property.id, clickField, (property as any)?.[clickField] || 0)
        }

        const channelFieldMap: Record<string, string[]> = {
            whatsapp_br: ['whastbr_count', 'WhastBR_count', 'whatsapp_clicks_br'],
            whatsapp_intl: ['whastusa_count', 'WhastUSA_count', 'whatsapp_clicks_intl'],
            email: ['email_count', 'email_clicks'],
        }

        const field = resolveCounterField(property as any, channelFieldMap[channel] || [])
        if (!field) return
        await incrementPropertyCounter(property.id, field, (property as any)?.[field] || 0)
    }

    const handleWhatsApp = async (isInternational: boolean = false) => {
        if (!property) return

        // Track Click (Increment click_count + channel)
        await trackPropertyClick(isInternational ? 'whatsapp_intl' : 'whatsapp_br')

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

    const availablePlants = groupProperties.length ? groupProperties : (property ? [property] : [])
    const hasMultiplePlants = availablePlants.length > 1

    const handleSelectPlant = (plant: Property) => {
        setProperty(plant)
        setActivePlantId(plant.id)
        setActiveImage(0)
    }

    const nextImage = () => {
        if (!property?.images?.length) return
        setActiveImage((prev) => (prev + 1) % property.images.length)
    }

    const prevImage = () => {
        if (!property?.images?.length) return
        setActiveImage((prev) => (prev - 1 + property.images.length) % property.images.length)
    }

    const images = property?.images?.length
        ? property.images
        : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=100']

    const visibleThumbnails = images.slice(thumbnailStart, thumbnailStart + THUMBNAILS_PER_PAGE)
    const canPrevThumbs = thumbnailStart > 0
    const canNextThumbs = thumbnailStart + THUMBNAILS_PER_PAGE < images.length

    useEffect(() => {
        setThumbnailStart((prev) => {
            if (activeImage < prev) return activeImage
            if (activeImage >= prev + THUMBNAILS_PER_PAGE) {
                return Math.max(0, activeImage - THUMBNAILS_PER_PAGE + 1)
            }
            return prev
        })
    }, [activeImage, images.length, THUMBNAILS_PER_PAGE])

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Preparando detalhes exclusivos...</p>
        </div>
    )

    if (!property) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <h1 className="text-2xl font-bold">{copy.notFound}</h1>
            <Link href="/"><Button>{copy.backToHome}</Button></Link>
        </div>
    )
    const getPriceInfo = (item: Property) => {
        const pricing = (item.features as any)?.pricing
        const isExact = !pricing || pricing.mode === 'exact'
        const label = isExact
            ? copy.salePrice
            : (pricing.label || (pricing.mode === 'special' ? copy.specialInvestment : copy.startingAt))
        const valueText = item.value
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)
            : copy.consult
        return { label, valueText, isExact }
    }

    const priceInfo = getPriceInfo(property)

    const leadTitle = propertyDetails.lead_title || copy.leadTitle
    const leadSubtitle = propertyDetails.lead_subtitle || copy.leadSubtitle
    const leadNoteTemplate = propertyDetails.lead_note || 'Link: {property_url} | Código: {property_code} | Interno: {internal_code}'
    const leadNote = leadNoteTemplate
        .replace(/{property_url}/g, typeof window !== 'undefined' ? window.location.href : '')
        .replace(/{property_code}/g, property.code || '')
        .replace(/{internal_code}/g, property.internal_code || '')
        

    const leadFormBg = propertyDetails.lead_form_bg || ''
    const leadFormText = propertyDetails.lead_form_text || ''
    const leadFormButtonBg = propertyDetails.lead_form_button_bg || ''
    const leadFormButtonText = propertyDetails.lead_form_button_text || ''

    const securityTitle = propertyDetails.security_title || 'Compra Segura'
    const securitySubtitle = propertyDetails.security_subtitle || 'Certificação Olivia Prado'
    const securityDescription = propertyDetails.security_description || 'Garantimos transparência total e assessoria jurídica completa para sua tranquilidade e segurança financeira.'
    const securityBg = propertyDetails.security_bg || ''
    const securityText = propertyDetails.security_text || ''
    const securityAccent = propertyDetails.security_accent || ''
    const tourUrl = property.tour_360_url || ''
    const hasTour = !!tourUrl

    return (
        <div className="bg-slate-50/50 min-h-screen pb-24">
            {/* Premium Header / Gallery Navigation */}
            <div className="bg-white border-b sticky top-0 z-40 px-4 py-3 shadow-sm flex items-center justify-between backdrop-blur-md bg-white/90">
                <Link href="/">
                    <Button variant="ghost" size="sm" className="font-bold flex items-center gap-2">
                        <ChevronLeft className="w-4 h-4" /> {copy.backToSearch}
                    </Button>
                </Link>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => {
                        navigator.clipboard.writeText(window.location.href)
                        toast.success(copy.linkCopied)
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
                        loading="eager"
                        decoding="async"
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
                            {resolveTypeLabel(property)}
                        </Badge>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-full"
                            onClick={() => setThumbnailStart((prev) => Math.max(0, prev - THUMBNAILS_PER_PAGE))}
                            disabled={!canPrevThumbs}
                            title="Anteriores"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{copy.photosLabel}</span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-full"
                            onClick={() => setThumbnailStart((prev) => Math.min(prev + THUMBNAILS_PER_PAGE, Math.max(0, images.length - THUMBNAILS_PER_PAGE)))}
                            disabled={!canNextThumbs}
                            title="Próximas"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-3 lg:h-[600px] overflow-hidden">
                        {visibleThumbnails.map((img, index) => {
                            const actualIndex = thumbnailStart + index
                            const isActive = actualIndex === activeImage

                            return (
                                <button
                                    key={`${img}-${actualIndex}`}
                                    type="button"
                                    className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all duration-300 ${isActive ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                    onClick={() => {
                                        setActiveImage(actualIndex)
                                        setIsLightboxOpen(true)
                                    }}
                                    title="Abrir imagem"
                                >
                                    <img
                                        src={img}
                                        className="w-full h-full object-cover"
                                        alt=""
                                        loading={isActive ? 'eager' : 'lazy'}
                                    />
                                    {isActive && <div className="absolute inset-0 bg-primary/10" />}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </section>

            {hasMultiplePlants && (
                <section className="container max-w-7xl mx-auto px-4 pb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-900">{copy.otherPlantsTitle}</h3>
                            <p className="text-xs text-muted-foreground">{copy.otherPlantsSubtitle}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availablePlants.map((plant, idx) => {
                            const priceInfo = getPriceInfo(plant)
                            const isActive = plant.id === activePlantId
                            const plantLabel = plant.plan_index || (idx + 1)
                            return (
                                <button
                                    key={plant.id}
                                    type="button"
                                    onClick={() => handleSelectPlant(plant)}
                                    className={`text-left border rounded-2xl p-5 transition-all ${isActive ? 'border-primary bg-primary/5 shadow-lg' : 'border-slate-200 bg-white hover:border-primary/40'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Planta {plantLabel}</span>
                                        {isActive && <Badge className="bg-primary text-white border-none text-[10px]">Selecionada</Badge>}
                                    </div>
                                    <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-500">
                                        <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {plant.specs?.quartos || 0}</span>
                                        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {plant.specs?.banheiros || 0}</span>
                                        <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {plant.specs?.area_total || 0}m²</span>
                                    </div>
                                    <div className="mt-4 text-sm font-black text-primary">
                                        {priceInfo.valueText}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* Lightbox Modal */}
            <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
                <DialogContent showCloseButton={false} className="max-w-[95vw] h-[90vh] p-0 border-none bg-black/95 transition-all">
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

            {/* Tour 360 Modal */}
            {hasTour && (
                <Dialog open={isTourOpen} onOpenChange={setIsTourOpen}>
                    <DialogContent showCloseButton={false} className="max-w-[90vw] w-[90vw] h-[90vh] p-0 border-none bg-black/90">
                        <div className="relative w-full h-full">
                            <iframe
                                src={tourUrl}
                                title="Tour 360"
                                className="w-full h-full"
                                allowFullScreen
                                loading="lazy"
                            />
                            <button
                                onClick={() => setIsTourOpen(false)}
                                className="absolute top-4 right-4 bg-white/90 hover:bg-white text-slate-900 text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-full shadow"
                            >
                                Fechar
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

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
                            <div className="flex flex-col items-end gap-1">
                                <p className="text-4xl font-black text-primary tracking-tighter">
                                    {priceInfo.valueText}
                                </p>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{priceInfo.label}</span>
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
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{resolveFieldLabel(field)}</span>
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
                            {!!property.show_construction_partner && property.construction_partner && (
                                <Badge variant="outline" className="px-3 py-1 border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {copy.partnerBuilderLabel}: <span className="ml-1 text-slate-900">{property.construction_partner.trade_name || property.construction_partner.name}</span>
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50/50 pt-8 px-8">
                            <CardTitle className="text-xl font-black flex items-center gap-2">
                                <div className="h-6 w-1.5 bg-primary rounded-full" />
                                {copy.descriptionTitle}
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
                                            {copy.sectionLabels[sect as keyof typeof copy.sectionLabels] || sect.replace('_', ' ')}
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
                                                            <span className="text-sm font-semibold text-slate-600">{resolveFieldLabel(field)}</span>
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

                    {hasTour && (
                        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                            <CardHeader className="bg-slate-50/50 pt-8 px-8">
                                <CardTitle className="text-xl font-black flex items-center gap-2">
                                    <div className="h-6 w-1.5 bg-primary rounded-full" />
                                    Tour 360°
                                </CardTitle>
                                <CardDescription>Explore cada detalhe com visão panorâmica.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 space-y-4">
                                <div className="aspect-video w-full overflow-hidden rounded-2xl border bg-slate-100">
                                    <iframe
                                        src={tourUrl}
                                        title="Tour 360"
                                        className="w-full h-full"
                                        allowFullScreen
                                        loading="lazy"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button variant="outline" className="rounded-full" onClick={() => setIsTourOpen(true)}>
                                        Expandir
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Map Section */}
                    <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50/50 pt-8 px-8">
                            <CardTitle className="text-xl font-black flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-primary" /> {copy.primeLocation}
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
                        <Card
                            className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-primary text-white"
                            style={leadFormBg || leadFormText ? { backgroundColor: leadFormBg || undefined, color: leadFormText || undefined } : undefined}
                        >
                            <CardHeader className="p-10 pb-6 text-center">
                                <h3 className="text-3xl font-black mb-2 tracking-tighter" style={leadFormText ? { color: leadFormText } : undefined}>
                                    {leadTitle}
                                </h3>
                                <p className="text-white/80 text-sm font-medium leading-relaxed" style={leadFormText ? { color: leadFormText } : undefined}>
                                    {leadSubtitle}
                                </p>
                                {leadNote && (
                                    <p className="text-[11px] text-white/70 mt-3" style={leadFormText ? { color: leadFormText } : undefined}>
                                        {leadNote}
                                    </p>
                                )}
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
                                    <Button
                                        size="lg"
                                        type="submit"
                                        className="w-full h-16 text-xl font-black bg-white text-primary hover:bg-slate-50 shadow-2xl rounded-2xl transition-all active:scale-95"
                                        disabled={isSendingLead}
                                        style={leadFormButtonBg || leadFormButtonText ? { backgroundColor: leadFormButtonBg || undefined, color: leadFormButtonText || undefined } : undefined}
                                    >
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
                                                    <span className="font-bold text-xs">{copy.service}</span>
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
                                                <span className="font-bold">{copy.callNow}</span>
                                            </Button>
                                        </a>
                                        {companyInfo.email && (
                                            <a
                                                href={`mailto:${companyInfo.email}?subject=${encodeURIComponent(`Interesse no imovel ${property.code}`)}`}
                                                className="block"
                                                onClick={() => trackPropertyClick('email')}
                                            >
                                                <Button variant="outline" className="w-full h-14 rounded-2xl border-white/20 bg-white/5 hover:bg-white hover:text-primary transition-all group">
                                                    <Mail className="w-5 h-5 mr-3 text-white/60 group-hover:text-primary" />
                                                    <span className="font-bold">{copy.sendEmail}</span>
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Additional Info / Security */}
                        <div
                            className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl space-y-4"
                            style={securityBg || securityText ? { backgroundColor: securityBg || undefined, color: securityText || undefined } : undefined}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="p-2 rounded-full bg-emerald-500/20 text-emerald-400"
                                    style={securityAccent ? { backgroundColor: securityAccent, color: securityText || undefined } : undefined}
                                >
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold">{securityTitle}</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-black" style={securityText ? { color: securityText } : undefined}>
                                        {securitySubtitle}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed italic" style={securityText ? { color: securityText } : undefined}>
                                {securityDescription}
                            </p>
                        </div>
                                
                    </div>
                </div>
            </div>
            {/* Similar Properties Section */}
            {similarProperties.length > 0 && (
                <section className="container max-w-7xl mx-auto px-4 mt-20">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{copy.similarTitle}</h2>
                            <p className="text-muted-foreground font-medium">{copy.similarSubtitle}</p>
                        </div>
                        <Link href="/#imoveis">
                            <Button variant="ghost" className="font-bold text-primary hover:text-primary/80 hover:bg-primary/5">
                                Ver todos <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {similarProperties.map((p: any) => {
                            const priceInfo = getPriceInfo(p as Property)
                            return (
                            <Link key={p.id} href={`${propertyBasePath}/${p.slug}`} className="group">
                                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                                    <div className="relative aspect-video overflow-hidden">
                                        <img
                                            src={p.images?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            alt={p.title}
                                        />
                                        <div className="absolute top-3 left-3">
                                            <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none font-bold text-[10px] uppercase">
                                                {resolveTypeLabel(p as Property)}
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
                                                {priceInfo.valueText}
                                            </span>
                                            <div className="flex gap-3 text-[10px] font-bold text-slate-400">
                                                <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {p.specs?.quartos || 0}</span>
                                                <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" /> {p.specs?.area_total || 0}m²</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        )
                        })}
                    </div>
                </section>
            )}
        </div>
    )
}






