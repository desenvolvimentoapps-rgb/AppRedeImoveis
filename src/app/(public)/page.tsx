'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Property, PropertyType, CMSField, CMSSettings, Partnership } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, MapPin, Bed, Bath, Maximize, ArrowRight, Loader2, SlidersHorizontal, ChevronRight, ChevronLeft, Home } from 'lucide-react'
import Link from 'next/link'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const PLANTAS_FIELD_ID = '577205f5-8719-4b6b-abb5-5bb58dd20752'

export default function HomePage() {
    const [properties, setProperties] = useState<Property[]>([])
    const [types, setTypes] = useState<PropertyType[]>([])
    const [cmsFields, setCmsFields] = useState<CMSField[]>([])
    const [settings, setSettings] = useState<CMSSettings[]>([])
    const [partnerships, setPartnerships] = useState<Partnership[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    // Pagination
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(12)

    // Filters
    const [search, setSearch] = useState('')
    const [selectedType, setSelectedType] = useState('all')
    const [dynamicFilters, setDynamicFilters] = useState<Record<string, any>>({})
    const defaultLocationFilters = { country: 'all', state: 'all', city: 'all', uf: 'all', neighborhood: 'all' }
    const [locationFilters, setLocationFilters] = useState(defaultLocationFilters)

    // Contact form
    const [contactName, setContactName] = useState('')
    const [contactEmail, setContactEmail] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    const [contactMessage, setContactMessage] = useState('')
    const [isSendingContact, setIsSendingContact] = useState(false)

    const filterableFields = useMemo(() => cmsFields.filter(field => field.is_filterable), [cmsFields])
    const plantasFieldName = useMemo(() => {
        return cmsFields.find(f => f.id === PLANTAS_FIELD_ID)?.name
            || cmsFields.find(f => f.name?.toLowerCase() === 'plantas')?.name
    }, [cmsFields])

    const locationOptions = useMemo(() => {
        const states = new Set<string>()
        const cities = new Set<string>()
        const ufs = new Set<string>()
        const neighborhoods = new Set<string>()

        properties.forEach((p) => {
            if (p.address_state) states.add(p.address_state)
            if (p.address_city) cities.add(p.address_city)
            if (p.address_uf) ufs.add(p.address_uf)
            if (p.address_neighborhood) neighborhoods.add(p.address_neighborhood)
        })

        const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })
        const sortValues = (values: string[]) => values.sort((a, b) => collator.compare(a, b))

        return {
            states: sortValues([...states]),
            cities: sortValues([...cities]),
            ufs: sortValues([...ufs]),
            neighborhoods: sortValues([...neighborhoods]),
        }
    }, [properties])

    const fetchSettings = useCallback(async () => {
        const { data } = await supabase.from('cms_settings').select('*')
        if (data) setSettings(data)
    }, [supabase])

    const fetchData = useCallback(async (options?: { silent?: boolean }) => {
        if (!options?.silent) setIsLoading(true)
        try {
            const [propRes, typeRes, fieldRes, partnerRes] = await Promise.all([
                supabase.from('properties').select('*, type:property_types(name)').eq('is_active', true).eq('locale', 'pt-BR').eq('plan_index', 1).order('is_featured', { ascending: false }).order('created_at', { ascending: false }),
                supabase.from('property_types').select('*').eq('is_active', true).order('name'),
                supabase.from('cms_fields').select('*'),
                supabase.from('partnerships').select('*').order('sort_order', { ascending: true }),
            ])

            if (propRes.error) throw propRes.error
            if (typeRes.error) throw typeRes.error
            if (fieldRes.error) throw fieldRes.error

            if (propRes.data) setProperties(propRes.data)
            if (typeRes.data) setTypes(typeRes.data)
            if (fieldRes.data) setCmsFields(fieldRes.data)
            if (partnerRes.data) setPartnerships(partnerRes.data as Partnership[])
        } catch (error: any) {
            if (!options?.silent) {
                toast.error('Erro ao carregar imóveis', { description: error?.message })
            }
        } finally {
            if (!options?.silent) setIsLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchData()
        fetchSettings()

        const channel = supabase
            .channel('home-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => fetchData({ silent: true }))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_fields' }, () => fetchData({ silent: true }))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'partnerships' }, () => fetchData({ silent: true }))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_settings' }, fetchSettings)
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, fetchData, fetchSettings])

    const filteredProperties = useMemo(() => {
        return properties.filter(p => {
            const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
                p.address_city?.toLowerCase().includes(search.toLowerCase()) ||
                p.code?.toLowerCase().includes(search.toLowerCase())

            const matchesType = selectedType === 'all' || p.type_id === selectedType

            // Dynamic filters check
            const matchesDynamic = Object.entries(dynamicFilters).every(([key, val]) => {
                if (val === undefined || val === '' || val === null || val === false) return true

                // Find which section the field belongs to
                const field = filterableFields.find(f => f.name === key)
                if (!field) return true

                const section = field.section === 'ficha_tecnica' ? 'specs' : field.section === 'comodidades' ? 'amenities' : 'features'
                const propertyVal = p[section as keyof Property] as Record<string, any>

                if (field.type === 'boolean') return !!propertyVal?.[key] === !!val
                if (field.type === 'number') return Number(propertyVal?.[key]) >= Number(val)
                if (field.type === 'select' || field.type === 'text') return propertyVal?.[key] === val

                return true
            })

            const normalize = (value: string | null | undefined) => (value || '').toString().trim().toLowerCase()
            const matchesLocation = [
                locationFilters.country === 'all'
                    ? true
                    : locationFilters.country === 'brasil'
                        ? !p.is_exterior
                        : !!p.is_exterior,
                locationFilters.state === 'all' || normalize(p.address_state) === normalize(locationFilters.state),
                locationFilters.city === 'all' || normalize(p.address_city) === normalize(locationFilters.city),
                locationFilters.uf === 'all' || normalize(p.address_uf) === normalize(locationFilters.uf),
                locationFilters.neighborhood === 'all' || normalize(p.address_neighborhood) === normalize(locationFilters.neighborhood),
            ].every(Boolean)

            return matchesSearch && matchesType && matchesDynamic && matchesLocation
        })
    }, [properties, search, selectedType, dynamicFilters, filterableFields, locationFilters])

    // Pagination logic
    const totalPages = Math.ceil(filteredProperties.length / pageSize)
    const currentProperties = filteredProperties.slice((page - 1) * pageSize, page * pageSize)

    const handleDynamicFilterChange = (key: string, val: any) => {
        setDynamicFilters(prev => ({ ...prev, [key]: val }))
        setPage(1)
    }

    const handleLocationChange = (key: keyof typeof locationFilters, val: string) => {
        setLocationFilters(prev => ({ ...prev, [key]: val }))
        setPage(1)
    }

    const getLocationLabel = (key: keyof typeof locationFilters, value: string) => {
        if (key === 'country') {
            if (value === 'brasil') return 'Brasil'
            if (value === 'exterior') return 'Exterior'
            return 'Todos'
        }
        if (value === 'all') {
            return key === 'city' || key === 'uf' ? 'Todas' : 'Todos'
        }
        return value
    }

    const resetFilters = () => {
        setSearch('')
        setSelectedType('all')
        setDynamicFilters({})
        setLocationFilters(defaultLocationFilters)
        setPage(1)
    }

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSendingContact(true)

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: contactName,
                    email: contactEmail,
                    phone: contactPhone,
                    message: contactMessage,
                }),
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Falha ao enviar')
            }

            toast.success('Mensagem enviada com sucesso!')
            setContactName('')
            setContactEmail('')
            setContactPhone('')
            setContactMessage('')
        } catch (error: any) {
            toast.error('Erro ao enviar mensagem', { description: error.message })
        } finally {
            setIsSendingContact(false)
        }
    }

    const companyInfo = settings.find(s => s.key === 'company_info')?.value || {}
    const appearance = settings.find(s => s.key === 'appearance')?.value || {}
    const footerInfo = settings.find(s => s.key === 'footer_info')?.value || {}
    const homeContent = settings.find(s => s.key === 'home_content')?.value || {}

    const activePartnerships = useMemo(() => {
        return (partnerships || [])
            .filter(p => p.is_active !== false)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    }, [partnerships])

    const heroBadge = homeContent.hero_badge || 'Exclusividade e Sofisticação'
    const heroTitleLine1 = homeContent.hero_title_line1 || 'Encontre a sua Próxima'
    const heroTitleLine2 = homeContent.hero_title_line2 || 'Conquista Imobiliária.'
    const heroSubtitle = homeContent.hero_subtitle || 'Curadoria exclusiva dos melhores lançamentos e imóveis de alto padrão com atendimento premium.'

    const aboutTitle = homeContent.about_title || 'Excelência em Atendimento Imobiliário'
    const aboutText = homeContent.about_text || footerInfo.about_text || 'Especialistas em lançamentos e imóveis de alto padrão. Encontre o lar dos seus sonhos com quem entende do mercado.'
    const aboutSecondaryText = homeContent.about_secondary_text || 'Nossa missão é proporcionar um atendimento personalizado e exclusivo, garantindo que cada cliente encontre não apenas um imóvel, mas o seu próximo refúgio.'
    const aboutImageUrl = homeContent.about_image_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80'
    const aboutStat1Value = homeContent.about_stat_1_value || '10+'
    const aboutStat1Label = homeContent.about_stat_1_label || 'Anos de Mercado'
    const aboutStat2Value = homeContent.about_stat_2_value || '500+'
    const aboutStat2Label = homeContent.about_stat_2_label || 'Sonhos Realizados'

    const contactTitleLine1 = homeContent.contact_title_line1 || 'Vamos Encontrar seu'
    const contactTitleLine2 = homeContent.contact_title_line2 || 'Novo Lar?'
    const contactSubtitle = homeContent.contact_subtitle || 'Deixe sua mensagem e um de nossos especialistas entrará em contato em breve.'
    const contactAddress = homeContent.contact_address || 'Curitiba - PR | Ponta Grossa - PR'
    const contactPhoneText = homeContent.contact_phone || footerInfo.phone || companyInfo.whatsapp || '(41) 99999-9999'
    const contactAddressLabel = homeContent.contact_address_label || 'Endereço Principal'
    const contactPhoneLabel = homeContent.contact_phone_label || 'Fale Conosco'
    const contactSectionBg = homeContent.contact_section_bg || ''
    const contactSectionAccent = homeContent.contact_section_accent || ''

    const heroBg = appearance.hero_bg_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80'
    const selectedTypeLabel = selectedType === 'all'
        ? 'Todos os tipos'
        : (types.find(t => t.id === selectedType)?.name || 'Tipo de Imóvel')
    const getPriceInfo = (item: Property) => {
        const pricing = (item.features as any)?.pricing
        const isExact = !pricing || pricing.mode === 'exact'
        const label = isExact
            ? 'Valor de venda'
            : (pricing.label || (pricing.mode === 'special' ? 'Investimento Especial' : 'Preços a partir de'))
        const valueText = item.value
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)
            : 'Consulte'
        return { label, valueText, isExact }
    }

    return (
        <div className="flex flex-col gap-16 pb-20 bg-slate-50/30">
            {/* Hero Section */}
            <section className="relative h-[650px] flex items-center justify-center overflow-hidden bg-slate-900 text-white">
                <div className="absolute inset-0 z-0">
                    <img
                        src={heroBg}
                        alt={companyInfo.name || 'Hero Background'}
                        className="w-full h-full object-cover opacity-60 scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                </div>

                <div className="container relative z-10 text-center space-y-8 px-4">
                    <div className="space-y-4 max-w-3xl mx-auto">
    <Badge className="bg-primary/20 text-primary border-primary/30 py-1 px-4 text-xs font-bold uppercase tracking-widest mb-2">
        {heroBadge}
    </Badge>
    <h1 className="text-4xl md:text-7xl font-black tracking-tight leading-[1.1]">
        {heroTitleLine1} <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-accent">
            {heroTitleLine2}
        </span>
    </h1>
    <p className="text-lg md:text-xl text-slate-300 font-light max-w-2xl mx-auto leading-relaxed">
        {heroSubtitle}
    </p>
</div>

                    <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl p-3 md:p-4 flex flex-col md:flex-row items-stretch gap-3 border border-primary/10 group transition-all duration-500 hover:shadow-primary/10">
                        <div className="flex-1 relative flex items-center px-4 bg-slate-50 rounded-xl border border-transparent focus-within:border-primary/30 transition-all">
                            <Search className="w-5 h-5 text-slate-400" />
                            <Input
                                placeholder="Busque por título, cidade ou código..."
                                className="border-none bg-transparent h-14 text-slate-900 font-medium text-lg shadow-none focus-visible:ring-0 placeholder:text-slate-400"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1) }}
                            />
                        </div>
                        <div className="w-full md:w-56 bg-slate-50 rounded-xl border border-transparent flex items-center">
                            <Select value={selectedType} onValueChange={(v) => { setSelectedType(v ?? 'all'); setPage(1) }}>
                                <SelectTrigger className="border-none bg-transparent shadow-none h-14 text-slate-900 font-semibold px-6">
                                    <span className="flex-1 text-left">{selectedTypeLabel}</span>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">Todos os tipos</SelectItem>
                                    {types.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Sheet>
                            <SheetTrigger
                                render={(
                                    <Button variant="outline" className="h-14 px-6 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-bold gap-2">
                                        <MapPin className="w-4 h-4" />
                                        Localização
                                    </Button>
                                )}
                            />
                            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                                <SheetHeader className="border-b pb-6">
                                    <SheetTitle className="text-2xl font-bold">Localização</SheetTitle>
                                    <SheetDescription>Filtre por país, estado, cidade, UF e bairro.</SheetDescription>
                                </SheetHeader>
                                <div className="py-8 space-y-6">
                                    <div className="space-y-2">
                                        <Label>País</Label>
                                        <Select value={locationFilters.country} onValueChange={(v) => handleLocationChange('country', v ?? 'all')}>
                                            <SelectTrigger className="h-12 rounded-xl">
                                                <span className="flex-1 text-left">{getLocationLabel('country', locationFilters.country)}</span>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                <SelectItem value="brasil">Brasil</SelectItem>
                                                <SelectItem value="exterior">Exterior</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Estado</Label>
                                        <Select value={locationFilters.state} onValueChange={(v) => handleLocationChange('state', v ?? 'all')}>
                                            <SelectTrigger className="h-12 rounded-xl">
                                                <span className="flex-1 text-left">{getLocationLabel('state', locationFilters.state)}</span>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {locationOptions.states.length === 0 && (
                                                    <SelectItem value="__empty_state" disabled>Nenhum estado</SelectItem>
                                                )}
                                                {locationOptions.states.map((state) => (
                                                    <SelectItem key={state} value={state}>{state}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cidade</Label>
                                        <Select value={locationFilters.city} onValueChange={(v) => handleLocationChange('city', v ?? 'all')}>
                                            <SelectTrigger className="h-12 rounded-xl">
                                                <span className="flex-1 text-left">{getLocationLabel('city', locationFilters.city)}</span>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas</SelectItem>
                                                {locationOptions.cities.length === 0 && (
                                                    <SelectItem value="__empty_city" disabled>Nenhuma cidade</SelectItem>
                                                )}
                                                {locationOptions.cities.map((city) => (
                                                    <SelectItem key={city} value={city}>{city}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UF</Label>
                                        <Select value={locationFilters.uf} onValueChange={(v) => handleLocationChange('uf', v ?? 'all')}>
                                            <SelectTrigger className="h-12 rounded-xl">
                                                <span className="flex-1 text-left">{getLocationLabel('uf', locationFilters.uf)}</span>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas</SelectItem>
                                                {locationOptions.ufs.length === 0 && (
                                                    <SelectItem value="__empty_uf" disabled>Nenhuma UF</SelectItem>
                                                )}
                                                {locationOptions.ufs.map((uf) => (
                                                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bairro</Label>
                                        <Select value={locationFilters.neighborhood} onValueChange={(v) => handleLocationChange('neighborhood', v ?? 'all')}>
                                            <SelectTrigger className="h-12 rounded-xl">
                                                <span className="flex-1 text-left">{getLocationLabel('neighborhood', locationFilters.neighborhood)}</span>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {locationOptions.neighborhoods.length === 0 && (
                                                    <SelectItem value="__empty_neighborhood" disabled>Nenhum bairro</SelectItem>
                                                )}
                                                {locationOptions.neighborhoods.map((neighborhood) => (
                                                    <SelectItem key={neighborhood} value={neighborhood}>{neighborhood}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="pt-6 border-t flex gap-3 sticky bottom-0 bg-white pb-6">
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-12 rounded-xl"
                                        onClick={() => setLocationFilters(defaultLocationFilters)}
                                    >
                                        Limpar
                                    </Button>
                                    <Button className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20">Aplicar</Button>
                                </div>
                            </SheetContent>
                        </Sheet>
                        <Sheet>
                            <SheetTrigger
                                render={
                                    <Button variant="outline" className="h-14 px-6 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-bold gap-2">
                                        <SlidersHorizontal className="w-4 h-4" />
                                        Filtros
                                    </Button>
                                }
                            />
                            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                                <SheetHeader className="border-b pb-6">
                                    <SheetTitle className="text-2xl font-bold">Filtros Avançados</SheetTitle>
                                    <SheetDescription>Refine sua busca com detalhes específicos do imóvel.</SheetDescription>
                                </SheetHeader>
                                <div className="py-8 space-y-8">
                                    {filterableFields.map(field => (
                                        <div key={field.id} className="space-y-4">
                                            <Label className="text-sm font-bold uppercase tracking-wider text-slate-900">{field.label}</Label>

                                            {field.type === 'boolean' && (
                                                <div className="flex items-center space-x-3 p-4 border rounded-xl hover:border-primary/30 transition-colors bg-slate-50/50">
                                                    <Checkbox
                                                        id={`filter-${field.name}`}
                                                        checked={!!dynamicFilters[field.name]}
                                                        onCheckedChange={(v) => handleDynamicFilterChange(field.name, v)}
                                                    />
                                                    <label htmlFor={`filter-${field.name}`} className="text-sm font-medium leading-none cursor-pointer">
                                                        Possui {field.label.toLowerCase()}
                                                    </label>
                                                </div>
                                            )}

                                            {field.type === 'number' && (
                                                <div className="flex flex-col gap-2">
                                                    <Input
                                                        type="number"
                                                        placeholder={`Mínimo de ${field.label.toLowerCase()}`}
                                                        value={dynamicFilters[field.name] || ''}
                                                        onChange={e => handleDynamicFilterChange(field.name, e.target.value)}
                                                        className="h-12 rounded-xl"
                                                    />
                                                </div>
                                            )}

                                            {field.type === 'select' && (
                                                <Select value={dynamicFilters[field.name] || 'any'} onValueChange={v => handleDynamicFilterChange(field.name, (v ?? 'any') === 'any' ? undefined : v)}>
                                                    <SelectTrigger className="h-12 rounded-xl">
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="any">Qualquer</SelectItem>
                                                        {Array.isArray(field.options) && field.options.map((opt: string) => (
                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-6 border-t flex gap-3 sticky bottom-0 bg-white pb-6">
                                    <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={resetFilters}>Limpar Tudo</Button>
                                    <Button className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20">Aplicar Filtros</Button>
                                </div>
                            </SheetContent>
                        </Sheet>
                        <Button size="lg" className="h-14 px-10 rounded-xl bg-primary hover:opacity-90 shadow-xl shadow-primary/20 text-white font-black transition-all">
                            Buscar Agora
                        </Button>
                    </div>
                </div>
            </section>

            {/* Results Section */}
            <section id="imoveis" className="container max-w-7xl mx-auto px-4 py-20 space-y-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-1 w-10 bg-primary rounded-full" />
                            <span className="text-primary font-black text-xs uppercase tracking-[0.2em]">Oportunidades</span>
                        </div>
                        <h2 className="text-4xl font-extrabold text-slate-900 leading-tight">Lançamentos em Destaque</h2>
                        <p className="text-slate-500 mt-2 text-lg">As melhores opções de investimento e moradia selecionadas por especialistas.</p>
                    </div>

                    <div className="flex items-center gap-4 bg-white p-2 border rounded-xl shadow-sm">
                        <span className="text-xs font-bold text-slate-400 pl-4">Exibir</span>
                        <Select value={pageSize.toString()} onValueChange={v => { if (v) { setPageSize(Number(v)); setPage(1) } }}>
                            <SelectTrigger className="w-24 border-none font-bold text-primary focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="12">12</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-6 bg-white border rounded-3xl animate-pulse">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        <p className="text-slate-400 font-medium tracking-wide">Buscando melhores disponibilidades...</p>
                    </div>
                ) : filteredProperties.length === 0 ? (
                    <div className="text-center py-32 bg-white border rounded-3xl shadow-sm space-y-6">
                        <div className="mx-auto w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                            <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-2xl font-bold text-slate-900">Nenhum resultado encontrado</p>
                            <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">Não encontramos imóveis com esses critérios. Tente limpar os filtros ou mudar sua busca.</p>
                        </div>
                        <Button variant="outline" onClick={resetFilters} className="rounded-xl px-8 h-12 border-slate-200">Limpar todos os filtros</Button>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {currentProperties.map(p => {
                                const priceInfo = getPriceInfo(p)
                                const rawPlantCount = plantasFieldName
                                    ? (p.specs as any)?.[plantasFieldName]
                                    : (p.specs as any)?.plantas ?? (p.specs as any)?.Plantas
                                const parsedPlantCount = Number(rawPlantCount)
                                const plantCount = Number.isFinite(parsedPlantCount) && parsedPlantCount > 1 ? parsedPlantCount : 1
                                return (
                                <Link key={p.id} href={`/imoveis/${p.slug}`} className="group">
                                    <Card className="h-full overflow-hidden border-none shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 rounded-3xl bg-white border border-slate-100 flex flex-col">
                                        <div className="relative h-72 overflow-hidden">
                                            <img
                                                src={p.images?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80'}
                                                alt={p.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

                                            <div className="absolute top-5 left-5 flex flex-col gap-2">
                                                {p.is_featured && <Badge className="bg-accent text-accent-foreground border-none shadow-xl py-1 px-3 text-[10px] font-black uppercase backdrop-blur-sm">Destaque</Badge>}
                                                <Badge className="bg-white/95 text-slate-900 border-none shadow-xl py-1 px-3 text-[10px] font-black uppercase backdrop-blur-sm">Lançamento</Badge>
                                                <Badge className="bg-primary/95 text-primary-foreground border-none shadow-xl py-1 px-3 text-[10px] font-black uppercase backdrop-blur-sm">{p.type?.name}</Badge>
                                            </div>

                                            <div className="absolute bottom-5 left-5 right-5 text-white">
                                                <div className="flex items-center gap-1.5 opacity-90 text-[10px] uppercase font-black tracking-widest mb-1">
                                                    <MapPin className="w-3 h-3 text-primary" />
                                                    {p.address_city} - {p.address_uf}
                                                </div>
                                                <h3 className="text-xl font-bold line-clamp-1 leading-tight">{p.title}</h3>
                                            </div>
                                        </div>

                                        <CardContent className="p-6 pt-8 flex-1 flex flex-col justify-between">
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between gap-2 p-1 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                    <div className="flex flex-col items-center flex-1 py-1 px-2 border-r border-slate-200/50">
                                                        <Home className="w-4 h-4 text-primary mb-1" />
                                                        <span className="text-xs font-black text-slate-800">{p.specs?.Plantas || 1}</span>
                                                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Opções</span>
                                                    </div>
                                                    <div className="flex flex-col items-center flex-1 py-1 px-2 border-r border-slate-200/50">
                                                        <Bed className="w-4 h-4 text-primary mb-1" />
                                                        <span className="text-xs font-black text-slate-800">{p.specs?.quartos || 0}</span>
                                                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Quartos</span>
                                                    </div>
                                                    <div className="flex flex-col items-center flex-1 py-1 px-2 border-r border-slate-200/50">
                                                        <Bath className="w-4 h-4 text-primary mb-1" />
                                                        <span className="text-xs font-black text-slate-800">{p.specs?.banheiros || 0}</span>
                                                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Suítes</span>
                                                    </div>
                                                    <div className="flex flex-col items-center flex-1 py-1 px-2">
                                                        <Maximize className="w-4 h-4 text-primary mb-1" />
                                                        <span className="text-xs font-black text-slate-800">{p.specs?.area_total || 0}</span>
                                                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">m² Área</span>
                                                    </div>
                                                    {plantCount > 1 && (
                                                        <div className="flex flex-col items-center flex-1 py-1 px-2 border-l border-slate-200/50">
                                                            <Home className="w-4 h-4 text-primary mb-1" />
                                                            <span className="text-xs font-black text-slate-800">{plantCount}</span>
                                                            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Plantas</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed h-10">{p.description}</p>
                                            </div>

                                            <div className="mt-8 pt-6 border-t flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{priceInfo.label}</span>
                                                    <span className="text-2xl font-black text-primary tracking-tighter leading-none">
                                                        {priceInfo.valueText}
                                                    </span>
                                                </div>
                                                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                                    <ArrowRight className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                                )
                            })}
                        </div>

                        {/* Pagination UI */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-10">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-xl h-12 w-12"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </Button>

                                <div className="flex items-center gap-1 mx-2">
                                    {Array.from({ length: totalPages }).map((_, i) => (
                                        <Button
                                            key={i + 1}
                                            variant={page === i + 1 ? "default" : "ghost"}
                                            className={`h-12 w-12 rounded-xl text-sm font-bold ${page === i + 1 ? 'shadow-lg shadow-primary/20' : 'text-slate-500'}`}
                                            onClick={() => setPage(i + 1)}
                                        >
                                            {i + 1}
                                        </Button>
                                    ))}
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-xl h-12 w-12"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </Button>
                            </div>
                        )}

                        <div className="text-center text-slate-400 text-xs font-medium">
                            Mostrando {currentProperties.length} de {filteredProperties.length} imóveis disponíveis
                        </div>
                    </>
                )}
            </section>

            {/* About Us Section */}
<section id="sobre" className="container max-w-7xl mx-auto px-4 py-24 border-t">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-1 w-12 bg-primary rounded-full" />
                <span className="text-primary font-black text-xs uppercase tracking-[0.3em]">Nossa História</span>
            </div>
            <h2 className="text-5xl font-black text-slate-900 leading-tight">{aboutTitle}</h2>
            <div className="space-y-4 text-slate-600 text-lg leading-relaxed">
                <p>{aboutText}</p>
                <p className="text-sm">{aboutSecondaryText}</p>
            </div>
            <div className="grid grid-cols-2 gap-8 pt-4">
                <div>
                    <h4 className="text-3xl font-black text-primary">{aboutStat1Value}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{aboutStat1Label}</p>
                </div>
                <div>
                    <h4 className="text-3xl font-black text-primary">{aboutStat2Value}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{aboutStat2Label}</p>
                </div>
            </div>
        </div>
        <div className="relative group">
            <div className="absolute -inset-4 bg-primary/10 rounded-[3rem] blur-2xl group-hover:bg-primary/20 transition-all duration-700" />
            <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl">
                <img
                    src={aboutImageUrl}
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
                    alt="Equipe"
                />
            </div>
        </div>
    </div>
</section>

            {/* Partnerships Section */}
            <section id="parcerias" className="container max-w-7xl mx-auto px-4 py-20 border-t">
                <div className="text-center space-y-4">
                    <span className="text-xs uppercase tracking-[0.3em] text-primary font-bold">Parcerias</span>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900">Empresas que caminham conosco</h2>
                    <p className="text-slate-500 max-w-2xl mx-auto">
                        Conheça algumas marcas que confiam no nosso trabalho.
                    </p>
                </div>

                <div className="mt-12 overflow-hidden">
                    {activePartnerships.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground border rounded-2xl py-10 bg-white">
                            Nenhuma parceria cadastrada ainda.
                        </div>
                    ) : (
                        <div className="partners-marquee flex gap-12 items-center w-max">
                            {[...activePartnerships, ...activePartnerships].map((partner, idx) => (
                                <div key={`${partner.id}-${idx}`} className="h-16 w-40 flex items-center justify-center">
                                    {partner.link_url ? (
                                        <a href={partner.link_url} target="_blank" rel="noreferrer" className="flex items-center justify-center">
                                            <img src={partner.logo_url} alt={partner.name || 'Parceria'} className="h-12 max-w-full object-contain grayscale hover:grayscale-0 transition-all" />
                                        </a>
                                    ) : (
                                        <img src={partner.logo_url} alt={partner.name || 'Parceria'} className="h-12 max-w-full object-contain grayscale hover:grayscale-0 transition-all" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Contact Section */}
<section id="contato" className="bg-slate-900 py-24 relative overflow-hidden" style={contactSectionBg ? { backgroundColor: contactSectionBg } : undefined}>
    <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/5 -skew-x-12 translate-x-1/2" style={contactSectionAccent ? { backgroundColor: contactSectionAccent } : undefined} />
    <div className="container max-w-7xl mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div className="space-y-8">
                <div className="space-y-4">
                    <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                        {contactTitleLine1} <br />
                        <span className="text-primary italic">{contactTitleLine2}</span>
                    </h2>
                    <p className="text-slate-400 text-lg">{contactSubtitle}</p>
                </div>

                <div className="space-y-6 pt-4">
                    <div className="flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                            <MapPin className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{contactAddressLabel}</p>
                            <p className="text-white font-medium">{contactAddress}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                            <ArrowRight className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{contactPhoneLabel}</p>
                            <p className="text-white font-medium">{contactPhoneText}</p>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="bg-white/5 border-white/10 backdrop-blur-sm p-4 md:p-8 rounded-[2.5rem]">
                <form className="space-y-5" onSubmit={handleContactSubmit}>
                    <div className="space-y-2">
                        <Label className="text-white/70 ml-1">Nome Completo</Label>
                        <Input
                            className="h-14 bg-white/5 border-white/10 text-white rounded-2xl focus:bg-white focus:text-slate-900 transition-all"
                            placeholder="Seu nome..."
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            disabled={isSendingContact}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="text-white/70 ml-1">E-mail</Label>
                            <Input
                                className="h-14 bg-white/5 border-white/10 text-white rounded-2xl focus:bg-white focus:text-slate-900 transition-all"
                                placeholder="seu@email.com"
                                type="email"
                                value={contactEmail}
                                onChange={(e) => setContactEmail(e.target.value)}
                                disabled={isSendingContact}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white/70 ml-1">WhatsApp</Label>
                            <Input
                                className="h-14 bg-white/5 border-white/10 text-white rounded-2xl focus:bg-white focus:text-slate-900 transition-all"
                                placeholder="(00) 00000-0000"
                                value={contactPhone}
                                onChange={(e) => setContactPhone(e.target.value)}
                                disabled={isSendingContact}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-white/70 ml-1">Mensagem</Label>
                        <Textarea
                            className="bg-white/5 border-white/10 text-white rounded-2xl focus:bg-white focus:text-slate-900 transition-all min-h-[120px]"
                            placeholder="Como podemos ajudar?"
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                            disabled={isSendingContact}
                            required
                        />
                    </div>
                    <Button
                        className="w-full h-16 bg-primary hover:bg-primary/90 text-white text-lg font-black rounded-2xl shadow-2xl shadow-primary/20 transition-all active:scale-[0.98] pt-1"
                        disabled={isSendingContact}
                        type="submit"
                    >
                        {isSendingContact ? 'Enviando...' : 'Enviar Solicitação'}
                    </Button>
                </form>
            </Card>
        </div>
    </div>
</section>

            
        </div>
    )
}



