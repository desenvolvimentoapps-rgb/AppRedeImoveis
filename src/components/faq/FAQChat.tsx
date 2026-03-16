'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FAQItem } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, MessageCircle, Send } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'

const DEFAULT_FAQ_SETTINGS = {
    default_message_pt: 'Desculpe, não achei uma resposta para essa pergunta. Gostaria de falar com um de nossos consultores?',
    default_message_en: 'Sorry, I could not find an answer to that question. Would you like to speak with one of our consultants?',
}

export function FAQChat() {
    const [isOpen, setIsOpen] = useState(false)
    const [items, setItems] = useState<FAQItem[]>([])
    const [faqSettings, setFaqSettings] = useState(DEFAULT_FAQ_SETTINGS)
    const [search, setSearch] = useState('')
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
    const [showDefault, setShowDefault] = useState(false)
    const [showContactForm, setShowContactForm] = useState(false)
    const [showThanks, setShowThanks] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [contactName, setContactName] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    const [contactDescription, setContactDescription] = useState('')
    const [lastQuestion, setLastQuestion] = useState('')

    const supabase = createClient()
    const pathname = usePathname()
    const isEnglish = pathname?.includes('/imoveis/en/')
    const shouldRender = useMemo(() => {
        if (!pathname) return false
        if (pathname === '/') return true
        const parts = pathname.split('/').filter(Boolean)
        if (parts[0] !== 'imoveis') return false
        if (parts[1] === 'en') return parts.length === 3
        return parts.length === 2
    }, [pathname])

    useEffect(() => {
        if (!shouldRender) return
        const fetchFaq = async () => {
            const [itemsRes, settingsRes] = await Promise.all([
                supabase.from('faq_items').select('*').eq('is_active', true).order('display_order', { ascending: true }),
                supabase.from('cms_settings').select('*').eq('key', 'faq_settings').maybeSingle(),
            ])
            if (itemsRes.data) setItems(itemsRes.data as FAQItem[])
            if (settingsRes.data?.value) {
                setFaqSettings({ ...DEFAULT_FAQ_SETTINGS, ...settingsRes.data.value })
            }
        }
        fetchFaq()
    }, [supabase, shouldRender])

    const normalizedItems = useMemo(() => {
        return items.map(item => ({
            id: item.id,
            question: isEnglish ? (item.question_en || item.question_pt) : item.question_pt,
            answer: isEnglish ? (item.answer_en || item.answer_pt) : item.answer_pt,
        }))
    }, [items, isEnglish])

    const filteredItems = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return normalizedItems
        return normalizedItems.filter(item => item.question.toLowerCase().includes(term))
    }, [normalizedItems, search])

    const defaultMessage = isEnglish ? faqSettings.default_message_en : faqSettings.default_message_pt
    const yesLabel = isEnglish ? 'Yes' : 'Sim'
    const noLabel = isEnglish ? 'No' : 'Não'
    const thanksMessage = isEnglish ? 'Thanks! We are here if you need anything.' : 'Obrigado! Ficamos à disposição.'
    const askPlaceholder = isEnglish ? 'Type your question...' : 'Digite sua pergunta...'
    const contactTitle = isEnglish ? 'Talk to a consultant' : 'Falar com consultor'
    const sendLabel = isEnglish ? 'Send' : 'Enviar'

    const resetFlow = () => {
        setSelectedAnswer(null)
        setShowDefault(false)
        setShowContactForm(false)
        setShowThanks(false)
        setContactName('')
        setContactPhone('')
        setContactDescription('')
        setLastQuestion('')
    }

    const handleSelectQuestion = (question: string, answer: string) => {
        setSelectedAnswer(answer)
        setShowDefault(false)
        setShowContactForm(false)
        setShowThanks(false)
        setLastQuestion(question)
    }

    const handleSearchQuestion = () => {
        const term = search.trim()
        if (!term) return
        const match = normalizedItems.find(item => item.question.toLowerCase().includes(term.toLowerCase()))
        if (match) {
            handleSelectQuestion(match.question, match.answer)
            return
        }
        setSelectedAnswer(null)
        setShowDefault(true)
        setShowContactForm(false)
        setShowThanks(false)
        setLastQuestion(term)
    }

    const handleSendContact = async () => {
        if (!contactName.trim() || !contactPhone.trim() || !contactDescription.trim()) {
            toast.error(isEnglish ? 'Please fill in all fields.' : 'Preencha todos os campos.')
            return
        }
        setIsSending(true)
        try {
            const response = await fetch('/api/faq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: contactName,
                    phone: contactPhone,
                    description: contactDescription,
                    question: lastQuestion,
                    page_url: typeof window !== 'undefined' ? window.location.href : '',
                }),
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to send')
            }
            toast.success(isEnglish ? 'Request sent!' : 'Solicitação enviada!')
            setShowThanks(true)
            setShowContactForm(false)
        } catch (error: any) {
            toast.error(isEnglish ? 'Error sending request' : 'Erro ao enviar', { description: error.message })
        } finally {
            setIsSending(false)
        }
    }

    if (!shouldRender) return null

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {isOpen && (
                <div className="w-[320px] sm:w-[360px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden mb-4">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <MessageCircle className="w-4 h-4" />
                            {isEnglish ? 'FAQ Chat' : 'FAQ Chat'}
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-white/10">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={askPlaceholder}
                                />
                                <Button variant="outline" size="icon" onClick={handleSearchQuestion}>
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {filteredItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelectQuestion(item.question, item.answer)}
                                        className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
                                    >
                                        {item.question}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedAnswer && (
                            <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
                                <p className="font-bold mb-1">{lastQuestion}</p>
                                <p>{selectedAnswer}</p>
                            </div>
                        )}

                        {showDefault && (
                            <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700 space-y-3">
                                <p>{defaultMessage}</p>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => { setShowContactForm(true); setShowDefault(false) }}>{yesLabel}</Button>
                                    <Button size="sm" variant="outline" onClick={() => { setShowThanks(true); setShowDefault(false) }}>{noLabel}</Button>
                                </div>
                            </div>
                        )}

                        {showContactForm && (
                            <div className="rounded-xl border bg-white p-3 text-sm text-slate-700 space-y-3">
                                <p className="font-bold">{contactTitle}</p>
                                <Input placeholder={isEnglish ? 'Name' : 'Nome'} value={contactName} onChange={e => setContactName(e.target.value)} />
                                <Input placeholder={isEnglish ? 'Phone / WhatsApp' : 'Telefone / WhatsApp'} value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                                <Textarea
                                    placeholder={isEnglish ? 'Brief description' : 'Breve descrição'}
                                    value={contactDescription}
                                    onChange={e => setContactDescription(e.target.value)}
                                />
                                <Button onClick={handleSendContact} disabled={isSending}>
                                    {isSending ? (isEnglish ? 'Sending...' : 'Enviando...') : sendLabel}
                                </Button>
                            </div>
                        )}

                        {showThanks && (
                            <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
                                {thanksMessage}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Button
                className="rounded-full h-14 w-14 shadow-2xl shadow-primary/30 flex items-center justify-center"
                onClick={() => {
                    if (!isOpen) resetFlow()
                    setIsOpen(prev => !prev)
                }}
            >
                <MessageCircle className="w-6 h-6" />
            </Button>
        </div>
    )
}
