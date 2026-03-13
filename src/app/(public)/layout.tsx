'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
    const pathname = usePathname()
    const isEnglish = pathname?.startsWith('/imoveis/en')

    const navLabels = {
        home: isEnglish ? 'Home' : 'Início',
        properties: isEnglish ? 'Properties' : 'Imóveis',
        about: isEnglish ? 'About Us' : 'Sobre Nós',
        contact: isEnglish ? 'Contact' : 'Contato',
    }

    const footerLabels = {
        quickLinks: isEnglish ? 'Quick Links' : 'Links Rápidos',
        ourProperties: isEnglish ? 'Our Properties' : 'Nossos Imóveis',
        aboutCompany: isEnglish ? 'About the Company' : 'Sobre a Empresa',
        contactUs: isEnglish ? 'Contact Us' : 'Fale Conosco',
        cities: isEnglish ? 'Cities' : 'Cidades',
        contact: isEnglish ? 'Contact' : 'Contato',
        rights: isEnglish ? 'All rights reserved.' : 'Todos os direitos reservados.',
    }

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
        description: '',
        links_title: '',
        cities_title: '',
        contact_title: '',
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

    const footerDescriptionFallback = isEnglish
        ? 'Specialists in new developments and high-end properties.'
        : 'Especialistas em lançamentos e imóveis de alto padrão.'
    const footerDescription = footerInfo.description || footerInfo.about_text || footerDescriptionFallback
    const linksTitle = footerInfo.links_title || footerLabels.quickLinks
    const citiesTitle = footerInfo.cities_title || footerLabels.cities
    const contactTitle = footerInfo.contact_title || footerLabels.contact

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
                        <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">{navLabels.home}</Link>
                        <Link href="/#imoveis" className="text-sm font-medium hover:text-primary transition-colors">{navLabels.properties}</Link>
                        <Link href="/#sobre" className="text-sm font-medium hover:text-primary transition-colors">{navLabels.about}</Link>
                        <Link href="/#contato" className="text-sm font-medium hover:text-primary transition-colors">{navLabels.contact}</Link>
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
                            {footerDescription}
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4">{linksTitle}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/" className="hover:text-primary transition-colors">{navLabels.home}</Link></li>
                            <li><Link href="/#imoveis" className="hover:text-primary transition-colors">{footerLabels.ourProperties}</Link></li>
                            <li><Link href="/#sobre" className="hover:text-primary transition-colors">{footerLabels.aboutCompany}</Link></li>
                            <li><Link href="/#contato" className="hover:text-primary transition-colors">{footerLabels.contactUs}</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4">{citiesTitle}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            {footerInfo.cities?.map((city: any, i: number) => (
                                <li key={i}>{city.label}</li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-4">{contactTitle}</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2 font-bold text-primary"><Phone className="w-4 h-4" /> {footerInfo.phone || companyInfo.whatsapp}</li>
                            <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> {footerInfo.email || companyInfo.email || 'contato@oliviaprado.com.br'}</li>
                            <li className="pt-2 italic text-xs">{footerInfo.hours}</li>
                        </ul>
                    </div>
                </div>
                <div className="container px-4 md:px-8 max-w-7xl mx-auto mt-12 pt-8 border-t text-center text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} {companyInfo.name || 'Olivia Prado'} - {footerLabels.rights}
                </div>
            </footer>
        </div>
    )
}
