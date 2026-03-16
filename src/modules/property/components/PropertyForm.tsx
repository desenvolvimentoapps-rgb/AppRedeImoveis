'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCMSStore } from '@/hooks/useCMS'
import { ConstructionPartner, Property, PropertyType, PropertyStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DynamicFieldRenderer } from '@/modules/cms/components/DynamicFieldRenderer'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DEFAULT_PROPERTY_STATUSES, normalizePropertyStatus, resolveStatusLabel } from '@/lib/property-status'
import { toast } from 'sonner'
import { Save, MapPin, Info, Home, List, ShieldCheck, Image as ImageIcon, Loader2, Search, MessageSquare, HelpCircle } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import axios from 'axios'

import { ImageUpload } from './ImageUpload'

interface PropertyFormProps {
    initialData?: Property
    isEditing?: boolean
}

const PLANTAS_FIELD_ID = '577205f5-8719-4b6b-abb5-5bb58dd20752'

const formatCodePrefix = (raw: string) => {
    const trimmed = (raw || '').toString().trim()
    if (!trimmed) return ''
    return trimmed.endsWith('-') ? trimmed : `${trimmed}-`
}

const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

const sanitizeSeoInput = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')

const stripCodeSuffix = (value: string) =>
    value.replace(/-(?:oli|imo)-\d{4,}$/i, '')

const buildSeoTitle = (params: {
    title?: string | null
    typeName?: string | null
    neighborhood?: string | null
    city?: string | null
    uf?: string | null
}) => {
    const parts = [
        (params.title || '').trim(),
        (params.typeName || '').trim(),
        (params.neighborhood || '').trim(),
        (params.city || '').trim(),
        (params.uf || '').trim(),
    ].filter(Boolean)

    return sanitizeSeoInput(parts.join(' '))
}

const sanitizeSlugBase = (value: string) => {
    const base = slugify(value || '')
    return base.replace(/-+$/g, '')
}

const sanitizeCodeForSlug = (value: string) => {
    return (value || '')
        .toString()
        .trim()
        .replace(/[^a-zA-Z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

const extractCodeNumber = (code: string | null | undefined) => {
    if (!code) return 0
    const match = code.toString().match(/(\d+)\s*$/)
    return match ? Number.parseInt(match[1], 10) : 0
}

export function PropertyForm({ initialData, isEditing = false }: PropertyFormProps) {
    const { fields } = useCMSStore()
    const [types, setTypes] = useState<PropertyType[]>([])
    const [statuses, setStatuses] = useState<PropertyStatus[]>([])
    const [constructionPartners, setConstructionPartners] = useState<ConstructionPartner[]>([])
    const [companyInfo, setCompanyInfo] = useState<any>({})
    const [isLoading, setIsLoading] = useState(false)
    const [isSearchingCep, setIsSearchingCep] = useState(false)
    const router = useRouter()
    const supabase = createClient()
    const [customPrefix, setCustomPrefix] = useState('')
    const [isSeoTitleDirty, setIsSeoTitleDirty] = useState(!!initialData?.seo_title)

    const [formData, setFormData] = useState<Partial<Property>>(
        initialData || {
            title: '',
            value: undefined,
            description: '',
            status: 'available',
            type_id: '',
            locale: 'pt-BR',
            plan_index: 1,
            address_cep: '',
            address_street: '',
            address_neighborhood: '',
            address_city: '',
            address_state: '',
            address_uf: '',
            address_number: '',
            is_exterior: false,
            whatsapp_br: '',
            whatsapp_intl: '',
            show_whatsapp_br: true,
            show_whatsapp_intl: false,
            construction_code: '',
            internal_code: '',
            owner_code: '',
            show_internal_code: false,
            show_owner_code: false,
            show_construction_code: false,
            show_construction_partner: false,
            construction_partner_id: null,
            is_featured: false,
            is_active: true,
            specs: {},
            amenities: {},
            features: {},
            images: [],
            main_image_index: 0,
            tour_360_url: '',
        }
    )
    const [groupPlants, setGroupPlants] = useState<Property[]>([])
    const [activePlantId, setActivePlantId] = useState<string | null>(initialData?.id ?? null)

    const plantasField = useMemo(() => {
        return fields.find(f => f.id === PLANTAS_FIELD_ID) || fields.find(f => f.name?.toLowerCase() === 'plantas')
    }, [fields])
    const plantasFieldName = plantasField?.name

    const plantCount = useMemo(() => {
        if (!plantasFieldName) return 1
        const raw = (formData.specs as any)?.[plantasFieldName]
        const parsed = Number(raw)
        if (!Number.isFinite(parsed) || parsed <= 0) return 1
        return parsed
    }, [formData.specs, plantasFieldName])
    useEffect(() => {
        if (!plantasFieldName) return
        const current = (formData.specs as any)?.[plantasFieldName]
        if (current === undefined || current === null || current === '') {
            setFormData(prev => ({
                ...prev,
                specs: {
                    ...(prev.specs as object || {}),
                    [plantasFieldName]: 1,
                },
            }))
        }
    }, [plantasFieldName])

    // Filter fields based on selected property type
    const filteredFields = useMemo(() => {
        return fields.filter(f =>
            (!f.property_type_id || f.property_type_id === formData.type_id)
            && f.id !== PLANTAS_FIELD_ID
            && (!plantasFieldName || f.name !== plantasFieldName)
        )
    }, [fields, formData.type_id, plantasFieldName])

    const statusOptions = statuses.length ? statuses : DEFAULT_PROPERTY_STATUSES
    const activeStatusOptions = statusOptions.filter(s => s.is_active)
    const isEnglishLocale = formData.locale === 'en'
    const selectedStatusLabel = resolveStatusLabel(formData.status, statusOptions, isEnglishLocale ? 'en' : 'pt-BR') || 'Disponível'
    const selectedType = types.find(t => t.id === formData.type_id)
    const selectedTypeLabel = isEnglishLocale
        ? (selectedType?.types_label_eng || selectedType?.name || 'Selecione o tipo')
        : (selectedType?.name || 'Selecione o tipo')
    const useDynamicPrefix = !!companyInfo?.use_dynamic_prefix
    const basePrefix = formatCodePrefix(companyInfo?.code_prefix || 'OLI-')

    useEffect(() => {
        const fetchLookups = async () => {
            const [typesRes, statusRes, settingsRes, partnersRes] = await Promise.all([
                supabase.from('property_types').select('*').eq('is_active', true).order('name'),
                supabase.from('property_statuses').select('*').order('label', { ascending: true }),
                supabase.from('cms_settings').select('value').eq('key', 'company_info').maybeSingle(),
                supabase.from('construction_partners').select('*').order('name'),
            ])

            if (typesRes.data) setTypes(typesRes.data)

            if (statusRes.data && statusRes.data.length > 0) {
                const normalized = statusRes.data.map(normalizePropertyStatus)
                setStatuses(normalized.length > 0 ? normalized : DEFAULT_PROPERTY_STATUSES)
            } else {
                setStatuses(DEFAULT_PROPERTY_STATUSES)
            }

            if (settingsRes.data?.value) setCompanyInfo(settingsRes.data.value)
            if (partnersRes.data) setConstructionPartners(partnersRes.data as ConstructionPartner[])
        }

        fetchLookups()
    }, [supabase])

    useEffect(() => {
        if (!isEditing || !initialData?.property_group_id) {
            setGroupPlants([])
            return
        }

        const fetchGroupPlants = async () => {
            const locale = initialData.locale || 'pt-BR'
            const { data, error } = await supabase
                .from('properties')
                .select('*')
                .eq('property_group_id', initialData.property_group_id)
                .eq('locale', locale)
                .order('plan_index', { ascending: true })

            if (error || !data || data.length === 0) return
            const groupList = data as Property[]
            const current = groupList.find((item) => item.id === initialData.id) || groupList[0]
            setGroupPlants(groupList)
            setFormData(current)
            setActivePlantId(current.id)
            setIsSeoTitleDirty(!!current.seo_title)
        }

        fetchGroupPlants()
    }, [isEditing, initialData?.property_group_id, initialData?.locale, initialData?.id, supabase])

useEffect(() => {
    if (isSeoTitleDirty) return

    const typeName = types.find(t => t.id === formData.type_id)?.name || ''

    // Pegar o valor do campo dinâmicos
    const quartos = formData.specs?.quartos
  ? `${formData.specs.quartos} ${formData.specs.quartos === 1 ? 'quarto' : 'quartos'}`
  : ''
    const banheiros = formData.specs?.banheiros
  ? `${formData.specs.banheiros} ${formData.specs.banheiros === 1 ? 'banheiro' : 'banheiros'}`
  : ''
    const area_construida = formData.specs?.area_construida ? `${formData.specs.area_construida} metros de area construida` : ''
    const piscina = formData.specs?.piscina === true ? 'piscina' : ''
    

    const nextSeo = buildSeoTitle({
        title: formData.title,
        typeName,
        neighborhood: formData.address_neighborhood,
        city: formData.address_city,
        uf: formData.address_uf,
    })

    // Concatenar o campo dinâmico no SEO title
    const seoWithDynamic = [nextSeo, quartos, banheiros, area_construida,piscina].filter(Boolean).join(' - ')

    setFormData(prev =>
        prev.seo_title === seoWithDynamic ? prev : { ...prev, seo_title: seoWithDynamic }
    )
}, [
    formData.title,
    formData.address_neighborhood,
    formData.address_city,
    formData.address_uf,
    formData.specs?.quartos, // Dependência do campo dinâmico
    formData.specs?.banheiros, // Dependência do campo dinâmico
    formData.specs?.area_construida, // Dependência do campo dinâmio
    formData.specs?.piscina, // Dependência do campo dinâmio 
    isSeoTitleDirty,
    types
])

    useEffect(() => {
        if (!isEditing || groupPlants.length === 0 || !formData.id) return
        setGroupPlants(prev =>
            prev.map((plant) => plant.id === formData.id ? ({ ...plant, ...formData } as Property) : plant)
        )
    }, [formData, isEditing, groupPlants.length])

    const handleCepSearch = async () => {
        const cep = formData.address_cep?.replace(/\D/g, '')
        if (cep?.length !== 8) {
            toast.error('CEP inválido')
            return
        }
        setIsSearchingCep(true)
        try {
            const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`)
            const data = response.data
            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    address_street: data.logradouro,
                    address_neighborhood: data.bairro,
                    address_city: data.localidade,
                    address_uf: data.uf,
                    address_state: data.estado || data.uf,
                }))
                toast.info('Endereço localizado!')
            } else {
                toast.error('CEP não encontrado')
            }
        } catch (error) {
            toast.error('Erro ao buscar CEP')
        } finally {
            setIsSearchingCep(false)
        }
    }

    const handleDynamicChange = (section: 'specs' | 'amenities' | 'features', name: string, value: any) => {
        let nextValue = value
        if (section === 'specs' && plantasFieldName && name === plantasFieldName) {
            const parsed = Number(value)
            nextValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
        }
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...(prev[section] as object || {}),
                [name]: nextValue
            }
        }))
    }

    const handlePlantCountChange = (value: number) => {
        if (!plantasFieldName) return
        const parsed = Number(value)
        const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
        setFormData(prev => ({
            ...prev,
            specs: {
                ...(prev.specs as object || {}),
                [plantasFieldName]: safeValue,
            },
        }))
    }

    const handleSelectPlant = (plant: Property) => {
        setFormData(plant)
        setActivePlantId(plant.id)
        setIsSeoTitleDirty(!!plant.seo_title)
    }

    const pricing = (formData.features as any)?.pricing || { mode: 'exact', label: 'Preços a partir de' }
    const isExactPrice = pricing.mode === 'exact' || !pricing.mode
    const pricingLabel = pricing.label || (pricing.mode === 'special' ? 'Investimento Especial' : 'Preços a partir de')

    const updatePricing = (next: { mode?: string; label?: string }) => {
        setFormData(prev => ({
            ...prev,
            features: {
                ...(prev.features as object || {}),
                pricing: {
                    ...(prev.features as any)?.pricing,
                    ...next,
                },
            },
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            if (!formData.title?.trim() || !formData.type_id || !formData.description?.trim()) {
                toast.error('Preencha título, tipo e descrição do imóvel')
                return
            }
            const typeName = types.find(t => t.id === formData.type_id)?.name || ''

            const rawSeoTitle = (formData.seo_title || buildSeoTitle({
                title: formData.seo_title,
                typeName,
                neighborhood: formData.address_neighborhood,
                city: formData.address_city,
                uf: formData.address_uf,
            }) || formData.title || formData.slug || '').trim()
            const seoTitleSanitized = sanitizeSeoInput(rawSeoTitle || '')
            const fallbackBase = sanitizeSlugBase(formData.title || formData.code || 'imovel')
            const slugBase = seoTitleSanitized || fallbackBase
            const slugBaseSafe = (slugBase || '').replace(/-+$/g, '')
            const updatedAt = new Date().toISOString()
            const normalizedPlantCount = Math.max(1, Math.floor(plantCount || 1))

            const payload: Partial<Property> = {
                ...formData,
                seo_title: seoTitleSanitized || formData.seo_title,
                updated_at: updatedAt,
            }

            if (isEditing && (formData.id || initialData)) {
                if (formData.locale !== 'en') {
                    const codeForSlug = payload.real_estate_code || payload.code || initialData?.real_estate_code || initialData?.code || ''
                    const slugSuffix = sanitizeCodeForSlug(codeForSlug).replace(/^-+/g, '')
                    const finalSlug = [slugBaseSafe, slugSuffix].filter(Boolean).join('-')
                    payload.slug = finalSlug
                } else {
                    payload.slug = formData.slug || initialData?.slug || payload.slug
                }
                const targetId = (formData.id || initialData?.id) as string
                const { error } = await supabase.from('properties').update(payload).eq('id', targetId)
                if (error) throw error
                toast.success('Imóvel atualizado com sucesso!')
                router.refresh()
                return
            }

            const isExterior = !!formData.is_exterior
            const totalPlants = normalizedPlantCount
            const totalLocales = isExterior ? 2 : 1
            const totalRecords = totalPlants * totalLocales
            const groupId = (isExterior || totalPlants > 1) ? crypto.randomUUID() : null

            const defaultPrefix = basePrefix || 'OLI-'
            const rawPrefix = useDynamicPrefix && customPrefix.trim() ? customPrefix : defaultPrefix
            const finalPrefix = formatCodePrefix(rawPrefix || 'OLI-')

            const { data: codeRows } = await supabase
                .from('properties')
                .select('code')
                .order('created_at', { ascending: false })
                .limit(100)

            const maxNumber = Math.max(0, ...(codeRows || []).map((row: any) => extractCodeNumber(row.code)))
            const codes = Array.from({ length: totalRecords }, (_, idx) =>
                `${finalPrefix}${String(maxNumber + idx + 1).padStart(6, '0')}`
            )

            const baseSpecs = {
                ...(formData.specs as object || {}),
                ...(plantasFieldName ? { [plantasFieldName]: totalPlants } : {}),
            }
            const baseAmenities = { ...(formData.amenities as object || {}) }
            const baseFeatures = { ...(formData.features as object || {}) }
            const baseImages = [...(formData.images || [])]

            let codeCursor = 0
            const records: Partial<Property>[] = []

            for (let index = 0; index < totalPlants; index++) {
                const planIndex = index + 1
                const brCode = codes[codeCursor++]
                const brPayload: Partial<Property> = {
                    ...formData,
                    locale: 'pt-BR',
                    plan_index: planIndex,
                    property_group_id: groupId,
                    code: brCode,
                    real_estate_code: brCode,
                    specs: { ...baseSpecs },
                    amenities: { ...baseAmenities },
                    features: { ...baseFeatures },
                    images: [...baseImages],
                    seo_title: seoTitleSanitized || formData.seo_title,
                    updated_at: updatedAt,
                }

                const brSlugSuffix = sanitizeCodeForSlug(brPayload.real_estate_code || brPayload.code || '').replace(/^-+/g, '')
                const brSlug = [slugBaseSafe, brSlugSuffix].filter(Boolean).join('-')
                brPayload.slug = brSlug
                records.push(brPayload)

                if (isExterior) {
                    const enCode = codes[codeCursor++]
                    const enPayload: Partial<Property> = {
                        ...brPayload,
                        locale: 'en',
                        code: enCode,
                        real_estate_code: enCode,
                        slug: brSlug,
                    }
                    records.push(enPayload)
                }
            }

            const primarySlug = records.find(r => r.locale === 'pt-BR' && r.plan_index === 1)?.slug || records[0]?.slug || ''
            const confirmMessage = `🔗 Link final para cadastro do imóvel:

imoveis/${primarySlug}
${isExterior ? `\nVersão EN:\nimoveis/en/${primarySlug}` : ''}

Plantas: ${totalPlants}

⚠️ Não é recomendado alterar após a criação do imóvel, pois pode gerar erros e impactar buscas futuras.

Deseja continuar mesmo assim?`

            if (!confirm(confirmMessage)) {
                setIsLoading(false)
                return
            }

            const { data: inserted, error } = await supabase
                .from('properties')
                .insert(records)
                .select('id, locale, plan_index')
            if (error) throw error

            const primary = inserted?.find((item: any) => item.locale === 'pt-BR' && item.plan_index === 1) || inserted?.[0]
            toast.success('Imóvel cadastrado com sucesso!')
            if (primary?.id) {
                router.push(`/admin/properties/${primary.id}`)
            } else {
                router.push('/admin/properties')
            }
            router.refresh()
        } catch (error: any) {
            toast.error('Erro ao salvar', { description: error.message })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-6xl mx-auto pb-20 mt-4 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 py-4 bg-background/90 backdrop-blur-md z-20 border-b mb-6 transition-all duration-300">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{isEditing ? 'Editar Imóvel' : 'Novo Imóvel'}</h1>
                    <p className="text-sm text-muted-foreground">{formData.code || 'O sistema gerará um código automático'}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" type="button" onClick={() => router.back()} disabled={isLoading}>Cancelar</Button>
                    <Button type="submit" disabled={isLoading} className="shadow-lg shadow-primary/20">
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {isEditing ? 'Salvar Alterações' : 'Cadastrar Imóvel'}
                    </Button>
                </div>
            </div>

            {isEditing && groupPlants.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 pb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Plantas</span>
                    {groupPlants.map((plant, idx) => {
                        const labelIndex = plant.plan_index || (idx + 1)
                        const isActive = plant.id === activePlantId
                        return (
                            <Button
                                key={plant.id}
                                type="button"
                                size="sm"
                                variant={isActive ? 'default' : 'outline'}
                                onClick={() => handleSelectPlant(plant)}
                            >
                                Planta {labelIndex}
                            </Button>
                        )
                    })}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Basic Info */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Info className="w-5 h-5 text-primary" /> Informações Básicas
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-2">
                                <Label htmlFor="title">Título do Anúncio</Label>
                                <Input
                                    id="title"
                                    placeholder="Ex: Apartamento de Luxo com Vista para o Mar em Balneário Camboriú"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                    className="text-lg font-medium"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="value">Valor de Venda (R$)</Label>
                                    <Input
                                        id="value"
                                        type="number"
                                        placeholder="0.00"
                                        value={formData.value || ''}
                                        onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status do Imóvel</Label>
                                    <Select value={formData.status || activeStatusOptions[0]?.value || 'available'} onValueChange={v => v && setFormData({ ...formData, status: v })}>
                                        <SelectTrigger>
                                            <span className="flex-1 text-left">{selectedStatusLabel}</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                        {activeStatusOptions.map((status) => (
                                            <SelectItem key={status.id} value={status.value}>
                                                    {isEnglishLocale ? (status.status_label_eng || status.label) : status.label}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {plantasFieldName && (
                                <div className="space-y-2">
                                    <Label htmlFor="plant_count">Número de plantas</Label>
                                    <Input
                                        id="plant_count"
                                        type="number"
                                        min={1}
                                        value={plantCount}
                                        onChange={e => handlePlantCountChange(Number(e.target.value))}
                                        disabled={isEditing}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        Sincronizado com o campo CMS &quot;{plantasFieldName}&quot;.
                                    </p>
                                </div>
                            )}
                            <div className="flex flex-col gap-4 rounded-xl border p-4 bg-slate-50">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-bold">Valor exato</Label>
                                        <p className="text-[10px] text-muted-foreground">Exibe o valor real no site</p>
                                    </div>
                                    <Switch checked={isExactPrice} onCheckedChange={(v) => updatePricing({ mode: v ? 'exact' : (pricing.mode === 'special' ? 'special' : 'from') })} />
                                </div>
                                {!isExactPrice && (
                                    <div className="space-y-2">
                                        <Label>Texto exibido no valor</Label>
                                        <Select
                                            value={pricing.mode || 'from'}
                                            onValueChange={(v) => {
                                                const labelMap: Record<string, string> = {
                                                    from: 'Preços a partir de',
                                                    special: 'Investimento Especial',
                                                    exact: '',
                                                }
                                                updatePricing({ mode: v ?? 'from', label: labelMap[v ?? 'from'] || 'Preços a partir de' })
                                            }}
                                        >
                                            <SelectTrigger className="w-[90%]">
                                                <span className="flex-1 text-left">{pricingLabel}</span>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="from">Preços a partir de</SelectItem>
                                                <SelectItem value="special">Investimento Especial</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Tipo de Imóvel</Label>
                                <Select value={formData.type_id || ''} onValueChange={v => setFormData({ ...formData, type_id: v })}>
                                    <SelectTrigger className="w-full">
                                        <span className={`flex-1 text-left ${formData.type_id ? '' : 'text-muted-foreground'}`}>
                                            {formData.type_id ? selectedTypeLabel : 'Selecione o tipo para carregar os campos específicos'}
                                        </span>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map(t => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {isEnglishLocale ? (t.types_label_eng || t.name) : t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Descrição Completa</Label>
                                <Textarea
                                    id="description"
                                    rows={6}
                                    placeholder="Detalhe as características, benefícios e diferenciais deste imóvel..."
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    required
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Localization */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <MapPin className="w-5 h-5 text-primary" /> Localização
                            </CardTitle>
                            <CardDescription>O endereço pode ser preenchido automaticamente via CEP.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="flex items-center gap-4 mb-2 p-4 bg-primary/5 rounded-xl border border-primary/10">
                                <Switch
                                    id="is_exterior"
                                    checked={formData.is_exterior}
                                    onCheckedChange={v => setFormData({ ...formData, is_exterior: v })}
                                />
                                <div className="space-y-0.5">
                                    <Label htmlFor="is_exterior" className="font-semibold cursor-pointer text-slate-900">Cadastro imóvel exterior</Label>
                                    <p className="text-[10px] text-muted-foreground">Ativa endereço internacional e cria versão EN automaticamente</p>
                                </div>
                            </div>

                            {!formData.is_exterior ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="cep">CEP</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="cep"
                                                maxLength={8}
                                                placeholder="00000000"
                                                value={formData.address_cep || ''}
                                                onChange={e => setFormData({ ...formData, address_cep: e.target.value })}
                                            />
                                            <Button type="button" variant="secondary" size="icon" onClick={handleCepSearch} disabled={isSearchingCep} title="Buscar CEP">
                                                {isSearchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 flex gap-4">
                                        <div className="flex-1 space-y-2">
                                            <Label htmlFor="street">Rua / Logradouro</Label>
                                            <Input id="street" value={formData.address_street || ''} readOnly className="bg-muted/50" />
                                        </div>
                                        <div className="w-24 space-y-2">
                                            <Label htmlFor="number">Número</Label>
                                            <Input id="number" value={formData.address_number || ''} onChange={e => setFormData({ ...formData, address_number: e.target.value })} placeholder="123" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="neighborhood">Bairro</Label>
                                        <Input id="neighborhood" value={formData.address_neighborhood || ''} readOnly className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="city">Cidade</Label>
                                        <Input id="city" value={formData.address_city || ''} readOnly className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="uf">UF</Label>
                                        <Input id="uf" value={formData.address_uf || ''} readOnly className="bg-muted/50" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Street / Address</Label><Input value={formData.address_street || ''} onChange={e => setFormData({ ...formData, address_street: e.target.value })} /></div>
                                        <div className="space-y-2"><Label>City</Label><Input value={formData.address_city || ''} onChange={e => setFormData({ ...formData, address_city: e.target.value })} /></div>
                                        <div className="space-y-2"><Label>State / Province</Label><Input value={formData.address_state || ''} onChange={e => setFormData({ ...formData, address_state: e.target.value })} /></div>
                                        <div className="space-y-2"><Label>Zip / Postal Code</Label><Input value={formData.address_cep || ''} onChange={e => setFormData({ ...formData, address_cep: e.target.value })} /></div>
                                    </div>
                                    <div className="space-y-2"><Label>Country</Label><Input value={formData.address_country || 'Brasil'} onChange={e => setFormData({ ...formData, address_country: e.target.value })} /></div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Dynamic Sections */}
                    {['ficha_tecnica', 'comodidades', 'caracteristicas'].map((sect) => (
                        <Card key={sect} className="shadow-sm border-slate-200">
                            <CardHeader className="bg-slate-50/50">
                                <CardTitle className="capitalize text-lg">{sect.replace('_', ' ')}</CardTitle>
                                <CardDescription>Campos dinâmicos do CMS para este tipo de imóvel.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {filteredFields.filter(f => f.section === sect).map(field => (
                                        <DynamicFieldRenderer
                                            key={field.name}
                                            field={field}
                                            value={formData[sect === 'ficha_tecnica' ? 'specs' : sect === 'comodidades' ? 'amenities' : 'features' as 'specs' | 'amenities' | 'features']?.[field.name]}
                                            onChange={(v) => handleDynamicChange(sect === 'ficha_tecnica' ? 'specs' : sect === 'comodidades' ? 'amenities' : 'features' as 'specs' | 'amenities' | 'features', field.name, v)}
                                            useEnglish={formData.locale === 'en'}
                                        />
                                    ))}
                                    {filteredFields.filter(f => f.section === sect).length === 0 && (
                                        <p className="col-span-full text-center py-4 text-xs text-muted-foreground italic">Nenhum campo configurado para esta seção.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="space-y-8">
                    {/* Photos */}
                    <Card className="shadow-sm border-slate-200 overflow-hidden">
                        <CardHeader className="bg-slate-50/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <ImageIcon className="w-5 h-5 text-primary" /> Galeria de Fotos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <ImageUpload
                                images={formData.images || []}
                                onChange={(imgs) => setFormData({ ...formData, images: imgs })}
                                mainImageIndex={formData.main_image_index || 0}
                                onMainImageChange={(idx) => setFormData({ ...formData, main_image_index: idx })}
                            />

                            <div className="mt-6 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label>Tour 360°</Label>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger
                                                render={
                                                    <button
                                                        type="button"
                                                        aria-label="Ajuda sobre tour 360"
                                                        className="inline-flex items-center justify-center w-6 h-6 rounded-full border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                                                    />
                                                }
                                            >
                                                <HelpCircle className="w-3.5 h-3.5" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Aceita links de tours como Matterport, Kuula ou similares. Ex:
                                                https://my.matterport.com/show/?m=XXXX ou https://kuula.co/share/XXXXX
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Input
                                    placeholder="Cole o link do tour 360°"
                                    value={formData.tour_360_url || ''}
                                    onChange={e => setFormData({ ...formData, tour_360_url: e.target.value })}
                                />
                                {formData.tour_360_url && (
                                    <div className="aspect-video w-full overflow-hidden rounded-xl border bg-slate-50">
                                        <iframe
                                            src={formData.tour_360_url}
                                            title="Preview Tour 360"
                                            className="w-full h-full"
                                            allowFullScreen
                                            loading="lazy"
                                        />
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Codes & Visibility */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <ShieldCheck className="w-5 h-5 text-primary" /> Códigos e Controle
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-2">
                                <Label>Código Imobiliária ({basePrefix})</Label>
                                <Input
                                    value={formData.real_estate_code || formData.code || ''}
                                    readOnly
                                    className="bg-slate-100 font-mono font-bold text-slate-500 cursor-not-allowed"
                                    placeholder="Gerado automaticamente"
                                />
                            </div>
                            {useDynamicPrefix && !isEditing && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label>Prefixo do Código (dinâmico)</Label>
                                        <span className="text-[10px] text-muted-foreground">Padrão: {basePrefix || 'OLI-'}</span>
                                    </div>
                                    <Input
                                        value={customPrefix}
                                        onChange={e => setCustomPrefix(e.target.value)}
                                        placeholder={basePrefix || 'OLI-'}
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Código Interno</Label>
                                    <Input value={formData.internal_code || ''} onChange={e => setFormData({ ...formData, internal_code: e.target.value })} placeholder="ex: CX-45" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Código Proprietário</Label>
                                    <Input value={formData.owner_code || ''} onChange={e => setFormData({ ...formData, owner_code: e.target.value })} placeholder="ex: PR-99" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Construtora Parceira</Label>
                                <Select
                                    value={formData.construction_partner_id || 'none'}
                                    onValueChange={(value) => {
                                        if (value === 'none') {
                                            setFormData(prev => ({ ...prev, construction_partner_id: null }))
                                            return
                                        }
                                        const selected = constructionPartners.find(p => p.id === value)
                                        setFormData(prev => ({
                                            ...prev,
                                            construction_partner_id: value,
                                            construction_code: selected?.code ? selected.code : prev.construction_code,
                                        }))
                                    }}
                                >
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Selecione a construtora" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Nenhuma</SelectItem>
                                        {constructionPartners.length === 0 && (
                                            <SelectItem value="empty" disabled>Nenhuma construtora cadastrada</SelectItem>
                                        )}
                                        {constructionPartners.map((partner) => (
                                            <SelectItem key={partner.id} value={partner.id}>
                                                {partner.trade_name || partner.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Código Construtora (editável)</Label>
                                <Input value={formData.construction_code || ''} onChange={e => setFormData({ ...formData, construction_code: e.target.value })} placeholder="ex: ED-GOLD-402" />
                            </div>
                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 border-orange-100">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold text-orange-900 flex items-center gap-1.5">
                                            <LucideIcons.Star className="w-3.5 h-3.5 fill-orange-500 text-orange-500" /> Imóvel em Destaque
                                        </Label>
                                        <p className="text-[10px] text-orange-700">Aparecerá na home e em seções de destaque</p>
                                    </div>
                                    <Switch checked={formData.is_featured} onCheckedChange={v => setFormData({ ...formData, is_featured: v })} />
                                </div>

                                <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                            <LucideIcons.Activity className="w-3.5 h-3.5 text-emerald-500" /> Anúncio Ativo no Site
                                        </Label>
                                        <p className="text-[10px] text-slate-600">Se desativado, o imóvel não aparecerá publicamente</p>
                                    </div>
                                    <Switch checked={formData.is_active !== false} onCheckedChange={v => setFormData({ ...formData, is_active: v })} />
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Visibilidade de Códigos</Label>

                                <div className="flex items-center justify-between p-2 border rounded-md bg-white">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-medium">Exibir Código Interno?</Label>
                                    </div>
                                    <Switch size="sm" checked={formData.show_internal_code} onCheckedChange={v => setFormData({ ...formData, show_internal_code: v })} />
                                </div>

                                <div className="flex items-center justify-between p-2 border rounded-md bg-white">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-medium">Exibir Código Proprietário?</Label>
                                    </div>
                                    <Switch size="sm" checked={formData.show_owner_code} onCheckedChange={v => setFormData({ ...formData, show_owner_code: v })} />
                                </div>

                                <div className="flex items-center justify-between p-2 border rounded-md bg-white">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-medium">Exibir Código Construtora?</Label>
                                    </div>
                                    <Switch size="sm" checked={formData.show_construction_code} onCheckedChange={v => setFormData({ ...formData, show_construction_code: v })} />
                                </div>

                                <div className="flex items-center justify-between p-2 border rounded-md bg-white">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-medium">Exibir construtora parceira?</Label>
                                    </div>
                                    <Switch size="sm" checked={!!formData.show_construction_partner} onCheckedChange={v => setFormData({ ...formData, show_construction_partner: v })} />
                                </div>
                            </div>

                            <div className="space-y-6 pt-4 border-t">
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 text-primary"><LucideIcons.MessageSquare className="w-4 h-4" /> Configuração de WhatsApp</Label>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">WhatsApp Brasil</Label>
                                            <Switch checked={formData.show_whatsapp_br} onCheckedChange={v => setFormData({ ...formData, show_whatsapp_br: v })} />
                                        </div>
                                        <Input
                                            placeholder="5541999999999"
                                            value={formData.whatsapp_br || ''}
                                            onChange={e => setFormData({ ...formData, whatsapp_br: e.target.value })}
                                            disabled={!formData.show_whatsapp_br}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">WhatsApp Exterior</Label>
                                            <Switch checked={formData.show_whatsapp_intl} onCheckedChange={v => setFormData({ ...formData, show_whatsapp_intl: v })} />
                                        </div>
                                        <Input
                                            placeholder="Ex: 5541999999999"
                                            value={formData.whatsapp_intl || ''}
                                            onChange={e => setFormData({ ...formData, whatsapp_intl: e.target.value })}
                                            disabled={!formData.show_whatsapp_intl}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground italic">Se desabilitado ou vazio, usará as configurações padrão do sistema.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* SEO Options */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Search className="w-5 h-5 text-primary" /> SEO & Indexação
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label>Título SEO (meta title)</Label>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger
                                                render={
                                                    <button
                                                        type="button"
                                                        aria-label="Ajuda SEO"
                                                        className="inline-flex items-center justify-center w-6 h-6 rounded-full border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                                                    />
                                                }
                                            >
                                                <HelpCircle className="w-3.5 h-3.5" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Use palavras-chave locais. A maioria das pessoas pesquisa imóvel + cidade.
                                                Ex: "apartamento à venda em Curitiba".
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                  <Input
                                      value={formData.seo_title || ''}
                                      onChange={e => {
                                          setIsSeoTitleDirty(true)
                                          setFormData({ ...formData, seo_title: sanitizeSeoInput(e.target.value) })
                                      }}
                                      placeholder="Título para o Google"
                                  />
                            </div>
                            <div className="space-y-2">
                                <Label>Descrição SEO (meta description)</Label>
                                <Textarea value={formData.seo_description || ''} onChange={e => setFormData({ ...formData, seo_description: e.target.value })} placeholder="Resumo para o Google" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    )
}
