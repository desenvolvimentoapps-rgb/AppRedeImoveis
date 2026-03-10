'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CMSSettings } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Save, Building2, Palette, Loader2, Globe, MessageSquare } from 'lucide-react'

export default function SettingsPage() {
    const [settings, setSettings] = useState<CMSSettings[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const supabase = createClient()

    const fetchSettings = async () => {
        const { data } = await supabase.from('cms_settings').select('*').order('key')
        if (data) setSettings(data)
        setIsLoading(false)
    }

    useEffect(() => {
        fetchSettings()
    }, [supabase])

    const handleValueChange = (key: string, field: string, value: any) => {
        setSettings(prev => prev.map(s => {
            if (s.key === key) {
                return { ...s, value: { ...s.value, [field]: value } }
            }
            return s
        }))
    }

    const handleSave = async (s: CMSSettings) => {
        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('cms_settings')
                .update({ value: s.value, updated_at: new Date().toISOString() })
                .eq('id', s.id)

            if (error) throw error
            toast.success(`Configurações de "${s.label}" salvas!`)
        } catch (error: any) {
            toast.error('Erro ao salvar', { description: error.message })
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    const companyInfo = settings.find(s => s.key === 'company_info')
    const appearance = settings.find(s => s.key === 'appearance')
    const footerInfo = settings.find(s => s.key === 'footer_info')
    const whatsappConfig = settings.find(s => s.key === 'whatsapp_config')

    return (
        <div className="space-y-8 max-w-4xl pb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Configurações Gerais</h1>
                    <p className="text-muted-foreground mt-1">Gerencie a identidade visual e funcional do sistema</p>
                </div>
            </div>

            <div className="grid gap-8">
                {/* Company Info */}
                {companyInfo && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-indigo-600" /> Informações da Empresa
                            </CardTitle>
                            <Button onClick={() => handleSave(companyInfo)} disabled={isSaving} size="sm">
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Salvar
                            </Button>
                        </CardHeader>
                        <CardContent className="grid gap-6 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nome Fantasia</Label>
                                    <Input value={companyInfo.value.name || ''} onChange={e => handleValueChange('company_info', 'name', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>E-mail Principal</Label>
                                    <Input type="email" value={companyInfo.value.email || ''} onChange={e => handleValueChange('company_info', 'email', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Propriedade Prefixo de Código (ex: OLI-)</Label>
                                    <Input value={companyInfo.value.code_prefix || 'OLI-'} onChange={e => handleValueChange('company_info', 'code_prefix', e.target.value)} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* WhatsApp Config */}
                {whatsappConfig && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-emerald-600" /> WhatsApp & Mensagens
                            </CardTitle>
                            <Button onClick={() => handleSave(whatsappConfig)} disabled={isSaving} size="sm">
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Salvar
                            </Button>
                        </CardHeader>
                        <CardContent className="grid gap-6 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>WhatsApp Padrão Brasil</Label>
                                    <Input placeholder="5541999999999" value={whatsappConfig.value.default_br || ''} onChange={e => handleValueChange('whatsapp_config', 'default_br', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>WhatsApp Padrão Exterior</Label>
                                    <Input placeholder="5541999999999" value={whatsappConfig.value.default_intl || ''} onChange={e => handleValueChange('whatsapp_config', 'default_intl', e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Template BR (Tags: {'{property_title}'}, {'{property_code}'})</Label>
                                    <Textarea
                                        className="min-h-[100px]"
                                        value={whatsappConfig.value.message_template_br || whatsappConfig.value.message_template || ''}
                                        onChange={e => handleValueChange('whatsapp_config', 'message_template_br', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Template International (English)</Label>
                                    <Textarea
                                        className="min-h-[100px]"
                                        value={whatsappConfig.value.message_template_intl || ''}
                                        onChange={e => handleValueChange('whatsapp_config', 'message_template_intl', e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Appearance - Palettes & Logo */}
                {appearance && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Palette className="w-5 h-5 text-indigo-600" /> Identidade Visual & Cores
                            </CardTitle>
                            <Button onClick={() => handleSave(appearance)} disabled={isSaving} size="sm">
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Salvar
                            </Button>
                        </CardHeader>
                        <CardContent className="grid gap-6 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>URL da Logomarca</Label>
                                    <Input value={appearance.value.logo_url || ''} onChange={e => handleValueChange('appearance', 'logo_url', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Imagem de Fundo (Hero Home)</Label>
                                    <Input value={appearance.value.hero_bg_url || ''} onChange={e => handleValueChange('appearance', 'hero_bg_url', e.target.value)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                                <div className="space-y-2">
                                    <Label>Cor Primária</Label>
                                    <div className="flex gap-2">
                                        <div className="w-10 h-10 rounded border" style={{ backgroundColor: appearance.value.primary_color || '#0f172a' }} />
                                        <Input value={appearance.value.primary_color || '#0f172a'} onChange={e => handleValueChange('appearance', 'primary_color', e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Cor Secundária</Label>
                                    <div className="flex gap-2">
                                        <div className="w-10 h-10 rounded border" style={{ backgroundColor: appearance.value.secondary_color || '#475569' }} />
                                        <Input value={appearance.value.secondary_color || '#475569'} onChange={e => handleValueChange('appearance', 'secondary_color', e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Cor de Destaque (Accent)</Label>
                                    <div className="flex gap-2">
                                        <div className="w-10 h-10 rounded border" style={{ backgroundColor: appearance.value.accent_color || '#4f46e5' }} />
                                        <Input value={appearance.value.accent_color || '#4f46e5'} onChange={e => handleValueChange('appearance', 'accent_color', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Footer Config */}
                {footerInfo && (
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="w-5 h-5 text-sky-600" /> Conteúdo do Rodapé
                            </CardTitle>
                            <Button onClick={() => handleSave(footerInfo)} disabled={isSaving} size="sm">
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Salvar
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-2">
                                <Label>Descrição Institucional</Label>
                                <Textarea value={footerInfo.value.description || ''} onChange={e => handleValueChange('footer_info', 'description', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Título Cidades</Label>
                                    <Input value={footerInfo.value.cities_title || ''} onChange={e => handleValueChange('footer_info', 'cities_title', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cidades (uma por linha)</Label>
                                    <Textarea
                                        value={footerInfo.value.cities?.map((c: any) => c.label).join('\n') || ''}
                                        onChange={e => handleValueChange('footer_info', 'cities', e.target.value.split('\n').map((l: string) => ({ label: l.trim() })))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Telefone Rodapé</Label>
                                    <Input value={footerInfo.value.phone || ''} onChange={e => handleValueChange('footer_info', 'phone', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Horário de Atendimento</Label>
                                    <Input value={footerInfo.value.hours || ''} onChange={e => handleValueChange('footer_info', 'hours', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>E-mail Rodapé</Label>
                                    <Input type="email" value={footerInfo.value.email || ''} onChange={e => handleValueChange('footer_info', 'email', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Sobre Nós / Texto Rodapé</Label>
                                <Textarea
                                    className="min-h-[120px]"
                                    placeholder="Conte um pouco sobre a empresa..."
                                    value={footerInfo.value.about_text || ''}
                                    onChange={e => handleValueChange('footer_info', 'about_text', e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
