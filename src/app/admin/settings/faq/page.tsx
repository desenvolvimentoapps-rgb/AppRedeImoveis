'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { FAQItem } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Settings2, Trash2, Search, MessageSquare, Save } from 'lucide-react'

const DEFAULT_FAQ_SETTINGS = {
    default_message_pt: 'Desculpe, não achei uma resposta para essa pergunta. Gostaria de falar com um de nossos consultores?',
    default_message_en: 'Sorry, I could not find an answer to that question. Would you like to speak with one of our consultants?',
}

export default function FAQSettingsPage() {
    const [items, setItems] = useState<FAQItem[]>([])
    const [faqSettings, setFaqSettings] = useState(DEFAULT_FAQ_SETTINGS)
    const [settingsId, setSettingsId] = useState<string | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingItem, setEditingItem] = useState<FAQItem | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    const [questionPt, setQuestionPt] = useState('')
    const [questionEn, setQuestionEn] = useState('')
    const [answerPt, setAnswerPt] = useState('')
    const [answerEn, setAnswerEn] = useState('')
    const [displayOrder, setDisplayOrder] = useState('0')
    const [isActive, setIsActive] = useState(true)

    const supabase = createClient()
    const { profile } = useAuthStore()
    const canEdit = hasPermission(profile, 'settings', 'edit')
    const canCreate = hasPermission(profile, 'settings', 'create')
    const canDelete = hasPermission(profile, 'settings', 'delete')

    const fetchData = async () => {
        const [itemsRes, settingsRes] = await Promise.all([
            supabase.from('faq_items').select('*').order('display_order', { ascending: true }),
            supabase.from('cms_settings').select('*').eq('key', 'faq_settings').maybeSingle(),
        ])

        if (itemsRes.data) setItems(itemsRes.data as FAQItem[])
        if (settingsRes.data) {
            setSettingsId(settingsRes.data.id)
            setFaqSettings({ ...DEFAULT_FAQ_SETTINGS, ...(settingsRes.data.value || {}) })
        } else {
            setFaqSettings(DEFAULT_FAQ_SETTINGS)
        }
    }

    useEffect(() => {
        fetchData()
    }, [supabase])

    const filteredItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return items
        return items.filter(item => {
            const haystack = [
                item.question_pt,
                item.question_en || '',
                item.answer_pt,
                item.answer_en || '',
            ].join(' ').toLowerCase()
            return haystack.includes(term)
        })
    }, [items, searchTerm])

    const handleOpenDialog = (item?: FAQItem) => {
        if (item && !canEdit) {
            toast.error('Sem permissão para editar FAQ')
            return
        }
        if (!item && !canCreate) {
            toast.error('Sem permissão para criar FAQ')
            return
        }

        if (item) {
            setEditingItem(item)
            setQuestionPt(item.question_pt || '')
            setQuestionEn(item.question_en || '')
            setAnswerPt(item.answer_pt || '')
            setAnswerEn(item.answer_en || '')
            setDisplayOrder(String(item.display_order ?? 0))
            setIsActive(item.is_active)
        } else {
            setEditingItem(null)
            setQuestionPt('')
            setQuestionEn('')
            setAnswerPt('')
            setAnswerEn('')
            setDisplayOrder('0')
            setIsActive(true)
        }
        setIsOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (editingItem && !canEdit) {
            toast.error('Sem permissão para editar FAQ')
            return
        }
        if (!editingItem && !canCreate) {
            toast.error('Sem permissão para criar FAQ')
            return
        }

        if (!questionPt.trim() || !answerPt.trim()) {
            toast.error('Pergunta e resposta em PT são obrigatórias')
            return
        }

        setIsLoading(true)
        try {
            const payload = {
                question_pt: questionPt.trim(),
                question_en: questionEn.trim() || null,
                answer_pt: answerPt.trim(),
                answer_en: answerEn.trim() || null,
                display_order: Number(displayOrder || 0),
                is_active: isActive,
                updated_at: new Date().toISOString(),
            }

            if (editingItem) {
                const { error } = await supabase.from('faq_items').update(payload).eq('id', editingItem.id)
                if (error) throw error
                toast.success('FAQ atualizado!')
            } else {
                const { error } = await supabase.from('faq_items').insert([payload])
                if (error) throw error
                toast.success('FAQ criado!')
            }

            setIsOpen(false)
            fetchData()
        } catch (error: any) {
            toast.error('Erro ao salvar', { description: error.message })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!canDelete) {
            toast.error('Sem permissão para excluir FAQ')
            return
        }
        if (!confirm('Tem certeza que deseja excluir esta pergunta?')) return
        try {
            const { error } = await supabase.from('faq_items').delete().eq('id', id)
            if (error) throw error
            toast.success('FAQ excluído!')
            fetchData()
        } catch (error: any) {
            toast.error('Erro ao excluir', { description: error.message })
        }
    }

    const handleSaveSettings = async () => {
        if (!canEdit) {
            toast.error('Sem permissão para salvar configurações')
            return
        }
        try {
            const payload = {
                id: settingsId || undefined,
                key: 'faq_settings',
                value: faqSettings,
                label: 'FAQ',
                description: 'Mensagens padrão do FAQ',
                updated_at: new Date().toISOString(),
            }

            const { error } = await supabase
                .from('cms_settings')
                .upsert(payload, { onConflict: 'key' })

            if (error) throw error
            toast.success('Configurações do FAQ salvas!')
        } catch (error: any) {
            toast.error('Erro ao salvar configurações', { description: error.message })
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">FAQ</h1>
                    <p className="text-muted-foreground mt-1">Gerencie perguntas e respostas do mini chat</p>
                </div>
                <Button onClick={() => handleOpenDialog()} disabled={!canCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Pergunta
                </Button>
            </div>

            <div className="border rounded-xl bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-lg font-bold">
                        <MessageSquare className="w-5 h-5 text-primary" /> Mensagens Padrão
                    </div>
                    <Button size="sm" onClick={handleSaveSettings} disabled={!canEdit}>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Padrão BR</Label>
                        <Textarea
                            className="min-h-[120px]"
                            value={faqSettings.default_message_pt}
                            onChange={e => setFaqSettings(prev => ({ ...prev, default_message_pt: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Padrão EN</Label>
                        <Textarea
                            className="min-h-[120px]"
                            value={faqSettings.default_message_en}
                            onChange={e => setFaqSettings(prev => ({ ...prev, default_message_en: e.target.value }))}
                        />
                    </div>
                </div>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingItem ? 'Editar Pergunta' : 'Adicionar Pergunta'}</DialogTitle>
                            <DialogDescription>Cadastre perguntas e respostas do FAQ.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label>Pergunta (PT)</Label>
                                <Input value={questionPt} onChange={e => setQuestionPt(e.target.value)} required />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Pergunta (EN)</Label>
                                <Input value={questionEn} onChange={e => setQuestionEn(e.target.value)} />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Resposta (PT)</Label>
                                <Textarea value={answerPt} onChange={e => setAnswerPt(e.target.value)} className="min-h-[120px]" required />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Resposta (EN)</Label>
                                <Textarea value={answerEn} onChange={e => setAnswerEn(e.target.value)} className="min-h-[120px]" />
                            </div>
                            <div className="space-y-2">
                                <Label>Ordem</Label>
                                <Input type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>Ativo</Label>
                                    <p className="text-[10px] text-muted-foreground">Exibir no chat</p>
                                </div>
                                <Switch checked={isActive} onCheckedChange={setIsActive} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando...' : editingItem ? 'Atualizar' : 'Criar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        placeholder="Pesquisar FAQ..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Pergunta (PT)</TableHead>
                            <TableHead>Pergunta (EN)</TableHead>
                            <TableHead>Ordem</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma pergunta encontrada.</TableCell>
                            </TableRow>
                        ) : filteredItems.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.question_pt}</TableCell>
                                <TableCell className="text-muted-foreground">{item.question_en || '-'}</TableCell>
                                <TableCell>{item.display_order}</TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {item.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)} disabled={!canEdit} title={!canEdit ? 'Sem permissão' : 'Editar'}>
                                            <Settings2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(item.id)} disabled={!canDelete} title={!canDelete ? 'Sem permissão' : 'Excluir'}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
