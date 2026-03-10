'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CMSSettings } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Home, Phone, Mail } from 'lucide-react'

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [settings, setSettings] = useState<CMSSettings[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        let isActive = true

        const fetchSettings = async () => {
            const { data } = await supabase.from('cms_settings').select('*')
            if (!isActive) return
            if (data) setSettings(data)
            setIsLoading(false)
        }

        fetchSettings()

        // Keep layout in sync with CMS updates without full reload
        const channel = supabase
            .channel('public-settings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_settings' }, fetchSettings)
            .subscribe()

        return () => {
            isActive = false
            supabase.removeChannel(channel)
        }
    }, [supabase])

    const companyInfo = settings.find(s => s.key === 'company_info')?.value || {}
    const appearance = settings.find(s => s.key === 'appearance')?.value || {}
    const footerInfo = settings.find(s => s.key === 'footer_info')?.value || {
        description: 'Especialistas em lançamentos e imóveis de alto padrão.',
        links_title: 'Links Rápidos',
        cities_title: 'Cidades',
        contact_title: 'Contato',
        phone: '(41) 99999-9999',
        email: 'contato@oliviaprado.com.br',
        hours: 'Segunda a Sábado, das 09h às 18h',
        cities: [
            { label: 'Ponta Grossa - PR' },
            { label: 'Curitiba - PR' },
            { label: 'Balneário Camboriú - SC' },
            { label: 'Itapema - SC' }
        ]
    }

    const primaryColor = appearance.primary_color || '#1e293b'
    const secondaryColor = appearance.secondary_color || '#475569'
    const accentColor = appearance.accent_color || '#4f46e5'

    return (
        <div
            className="flex flex-col min-h-screen"
            style={{
                '--primary': primaryColor,
                '--primary-foreground': '#ffffff',
                '--secondary': secondaryColor,
                '--secondary-foreground': '#ffffff',
                '--accent': accentColor,
                '--accent-foreground': '#ffffff',
                '--ring': primaryColor,
            } as any}
        >
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                <div className="container flex h-16 items-center justify-between px-4 md:px-8 max-w-7xl mx-auto">
                    <Link href="/" className="flex items-center gap-2">
                        {appearance.logo_url ? (
                            <img src={appearance.logo_url} alt={companyInfo.name || 'Logo'} className="h-8 w-auto" />
                        ) : (
                            <>
                                <div className="bg-primary p-1.5 rounded-lg text-primary-foreground" style={{ backgroundColor: primaryColor }}>
                                    <Home className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-bold tracking-tight">{companyInfo.name || 'Olivia Prado'}</span>
                            </>
                        )}
                    </Link>
                    <nav className="hidden md:flex items-center gap-6">
                        <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">Início</Link>
                        <Link href="/#imoveis" className="text-sm font-medium hover:text-primary transition-colors">Imóveis</Link>
                        <Link href="/#sobre" className="text-sm font-medium hover:text-primary transition-colors">Sobre Nós</Link>
                        <Link href="/#contato" className="text-sm font-medium hover:text-primary transition-colors">Contato</Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link href="/login">
                            <Button variant="ghost" size="sm">Entrar</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                {children}
            </main>

            <footer className="bg-slate-50 border-t py-12 md:py-20">
                <div className="container px-4 md:px-8 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            {appearance.logo_url ? (
                                <img src={appearance.logo_url} alt="Logo" className="h-8 w-auto" />
                            ) : (
                                <>
                                    <Home className="w-6 h-6 text-primary" style={{ color: primaryColor }} />
                                    <span className="text-2xl font-bold">{companyInfo.name || 'Olivia Prado'}</span>
                                </>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {footerInfo.description || footerInfo.about_text || 'Especialistas em lançamentos e imóveis de alto padrão.'}
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4">{footerInfo.links_title || 'Links Rápidos'}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/" className="hover:text-primary transition-colors">Início</Link></li>
                            <li><Link href="/#imoveis" className="hover:text-primary transition-colors">Nossos Imóveis</Link></li>
                            <li><Link href="/#sobre" className="hover:text-primary transition-colors">Sobre a Empresa</Link></li>
                            <li><Link href="/#contato" className="hover:text-primary transition-colors">Fale Conosco</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4">{footerInfo.cities_title || 'Cidades'}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            {footerInfo.cities?.map((city: any, i: number) => (
                                <li key={i}>{city.label}</li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4">{footerInfo.contact_title || 'Contato'}</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2 font-bold text-primary"><Phone className="w-4 h-4" /> {footerInfo.phone || companyInfo.whatsapp}</li>
                            <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> {footerInfo.email || companyInfo.email || 'contato@oliviaprado.com.br'}</li>
                            <li className="pt-2 italic text-xs">{footerInfo.hours}</li>
                        </ul>
                    </div>
                </div>
                <div className="container px-4 md:px-8 max-w-7xl mx-auto mt-12 pt-8 border-t text-center text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} {companyInfo.name || 'Olivia Prado'} - Todos os direitos reservados.
                </div>
            </footer>
        </div>
    )
}
