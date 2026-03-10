'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCMSStore } from '@/hooks/useCMS'
import { Property, PropertyType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DynamicFieldRenderer } from '@/modules/cms/components/DynamicFieldRenderer'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Save, MapPin, Info, Home, List, ShieldCheck, Image as ImageIcon, Loader2, Search, MessageSquare } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import axios from 'axios'

import { ImageUpload } from './ImageUpload'

interface PropertyFormProps {
    initialData?: Property
    isEditing?: boolean
}

export function PropertyForm({ initialData, isEditing = false }: PropertyFormProps) {
    const { fields } = useCMSStore()
    const [types, setTypes] = useState<PropertyType[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSearchingCep, setIsSearchingCep] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const [formData, setFormData] = useState<Partial<Property>>(
        initialData || {
            title: '',
            value: undefined,
            description: '',
            status: 'available',
            type_id: '',
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
            is_featured: false,
            is_active: true,
            specs: {},
            amenities: {},
            features: {},
            images: [],
            main_image_index: 0,
        }
    )

    // Filter fields based on selected property type
    const filteredFields = useMemo(() => {
        return fields.filter(f =>
            !f.property_type_id || f.property_type_id === formData.type_id
        )
    }, [fields, formData.type_id])

    useEffect(() => {
        const fetchTypes = async () => {
            const { data } = await supabase.from('property_types').select('*').eq('is_active', true).order('name')
            if (data) setTypes(data)
        }
        fetchTypes()
    }, [supabase])

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
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...(prev[section] as object || {}),
                [name]: value
            }
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            // Generate slug if new or title changed
            const slug = formData.slug || formData.title?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')

            const payload = {
                ...formData,
                slug,
                updated_at: new Date().toISOString()
            }

            if (isEditing && initialData) {
                const { error } = await supabase.from('properties').update(payload).eq('id', initialData.id)
                if (error) throw error
                toast.success('Imóvel atualizado com sucesso!')
            } else {
                const { error } = await supabase.from('properties').insert([payload])
                if (error) throw error
                toast.success('Imóvel cadastrado com sucesso!')
            }
            router.push('/admin/properties')
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
                                    <Select value={formData.status || 'available'} onValueChange={v => v && setFormData({ ...formData, status: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="available">Disponível</SelectItem>
                                            <SelectItem value="reserved">Reservado</SelectItem>
                                            <SelectItem value="sold">Vendido</SelectItem>
                                            <SelectItem value="draft">Rascunho / Inativo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Tipo de Imóvel</Label>
                                <Select value={formData.type_id || ''} onValueChange={v => setFormData({ ...formData, type_id: v })}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione o tipo para carregar os campos específicos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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
                                    <Label htmlFor="is_exterior" className="font-semibold cursor-pointer text-slate-900">Imóvel no Exterior</Label>
                                    <p className="text-[10px] text-muted-foreground">Selecione para preenchimento manual de endereço internacional</p>
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
                                <Label>Código Imobiliária (OLI#)</Label>
                                <Input
                                    value={formData.real_estate_code || ''}
                                    readOnly
                                    className="bg-slate-100 font-mono font-bold text-slate-500 cursor-not-allowed"
                                    placeholder="Gerado automaticamente"
                                />
                            </div>
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
                                <Label>Código Construtora</Label>
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
                                <Label>Título SEO (meta title)</Label>
                                <Input value={formData.seo_title || ''} onChange={e => setFormData({ ...formData, seo_title: e.target.value })} placeholder="Título para o Google" />
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
