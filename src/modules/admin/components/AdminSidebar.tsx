'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCMSStore } from '@/hooks/useCMS'
import { useAuthStore } from '@/hooks/useAuth'
import * as LucideIcons from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, isMenuAllowed } from '@/lib/permissions'

export function AdminSidebar() {
    const { menus } = useCMSStore()
    const { profile, setProfile } = useAuthStore()
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [avatarCacheKey, setAvatarCacheKey] = useState(() => Date.now())
    const [isCollapsed, setIsCollapsed] = useState(false)

    useEffect(() => {
        // Refresh avatar every 15 minutes
        const intervalId = setInterval(() => setAvatarCacheKey(Date.now()), 15 * 60 * 1000)
        return () => clearInterval(intervalId)
    }, [])

    useEffect(() => {
        const stored = window.localStorage.getItem('admin_sidebar_collapsed')
        if (stored !== null) setIsCollapsed(stored === 'true')
    }, [])

    const avatarUrl = useMemo(() => {
        if (!profile?.avatar_url) return null
        const separator = profile.avatar_url.includes('?') ? '&' : '?'
        return `${profile.avatar_url}${separator}t=${avatarCacheKey}`
    }, [profile?.avatar_url, avatarCacheKey])

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut()
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            setProfile(null)
            router.replace('/login')
            router.refresh()
            setTimeout(() => {
                if (window.location.pathname.startsWith('/admin')) {
                    window.location.href = '/login'
                }
            }, 300)
        }
    }

    const toggleSidebar = () => {
        setIsCollapsed(prev => {
            const next = !prev
            window.localStorage.setItem('admin_sidebar_collapsed', String(next))
            return next
        })
    }

    const categoryForPath = (path: string) => {
        if (path.startsWith('/admin/leads')) return 'Leads'
        if (path.startsWith('/admin/cms/fields') || path.startsWith('/admin/cms/menus')) return 'CMS/Campos'
        if (path.startsWith('/admin/cms/types')) return 'Tipo de imóvel'
        if (path.startsWith('/admin/cms/status')) return 'Tipo de imóvel'
        if (path.startsWith('/admin/properties')) return 'Tipo de imóvel'
        if (path.startsWith('/admin/settings/users')) return 'Usuários'
        if (path.startsWith('/admin/settings')) return 'Configurações'
        if (path.startsWith('/admin')) return 'Geral'
        return 'Outros'
    }

    const hasCustomRole = !!profile?.role_id
    const baseMenus = menus
        .filter(menu => profile && (hasCustomRole ? true : menu.required_roles.includes(profile.role)))
        .filter(menu => isMenuAllowed(profile, menu.path))
        .map(menu => ({ ...menu, category: categoryForPath(menu.path) }))

    const staticMenus = [
        {
            id: 'charts-management',
            label: 'Gestão de Gráficos',
            path: '/admin/cms/charts',
            icon: 'BarChart3',
            required_roles: ['hakunaadm', 'gestaoimoveis', 'corretor'],
            category: 'Gestão de gráficos',
        },
        {
            id: 'my-charts',
            label: 'Meus Gráficos',
            path: '/admin/dashboard/my-charts',
            icon: 'PieChart',
            required_roles: ['hakunaadm', 'gestaoimoveis', 'corretor'],
            category: 'Meus gráficos',
        },
        {
            id: 'management',
            label: 'Gestão e Controle',
            path: '/admin/management',
            icon: 'Shield',
            required_roles: ['hakunaadm', 'gestaoimoveis'],
            category: 'Configurações',
        },
        {
            id: 'property-status',
            label: 'Status do Imóvel',
            path: '/admin/cms/status',
            icon: 'CheckCircle2',
            required_roles: ['hakunaadm', 'gestaoimoveis'],
            category: 'Tipo de imóvel',
        },
        {
            id: 'construction-partners',
            label: 'Construtoras',
            path: '/admin/cms/construtoras',
            icon: 'Building2',
            required_roles: ['hakunaadm', 'gestaoimoveis'],
            category: 'Tipo de imóvel',
        },
        {
            id: 'faq-settings',
            label: 'FAQ',
            path: '/admin/settings/faq',
            icon: 'HelpCircle',
            required_roles: ['hakunaadm', 'gestaoimoveis'],
            category: 'Configurações',
        },
        {
            id: 'roles-settings',
            label: 'Perfis de Acesso',
            path: '/admin/settings/roles',
            icon: 'ShieldCheck',
            required_roles: ['hakunaadm'],
            category: 'Configurações',
        },
        {
            id: 'partnerships-settings',
            label: 'Parcerias',
            path: '/admin/settings/parcerias',
            icon: 'Handshake',
            required_roles: ['hakunaadm', 'gestaoimoveis'],
            category: 'Configurações',
        },
    ]

    const visibleStaticMenus = staticMenus
        .filter(menu => profile && (menu.required_roles as any).includes(profile.role))
        .filter(menu => isMenuAllowed(profile, menu.path))
        .filter(menu => menu.path !== '/admin/management' || hasPermission(profile, 'management', 'view'))
        .filter(menu => menu.path !== '/admin/cms/status' || hasPermission(profile, 'property_statuses', 'view'))
        .filter(menu => menu.path !== '/admin/cms/construtoras' || hasPermission(profile, 'cms_types', 'view'))
        .filter(menu => !menu.path.startsWith('/admin/settings') || hasPermission(profile, 'settings', 'view'))

    const allMenus = [...baseMenus, ...visibleStaticMenus]

    const categoryOrder = [
        'Geral',
        'Leads',
        'Tipo de imóvel',
        'CMS/Campos',
        'Configurações',
        'Usuários',
        'Gestão de gráficos',
        'Meus gráficos',
        'Outros',
    ]

    const groupedMenus = categoryOrder
        .map(category => ({
            category,
            items: allMenus.filter(menu => menu.category === category),
        }))
        .filter(group => group.items.length > 0)

    return (
        <div className={cn("flex flex-col border-r bg-card h-screen sticky top-0 transition-all duration-300", isCollapsed ? "w-20" : "w-64")}>
            <div className={cn("p-6 flex items-start justify-between gap-2", isCollapsed && "justify-center")}>
                {!isCollapsed && (
                    <div>
                        <h1 className="text-xl font-bold text-primary">Olivia Prado</h1>
                        <p className="text-xs text-muted-foreground mt-1">Gestão Imobiliária</p>
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleSidebar}
                    aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                >
                    {isCollapsed ? <LucideIcons.ChevronRight className="w-4 h-4" /> : <LucideIcons.ChevronLeft className="w-4 h-4" />}
                </Button>
            </div>

            <div className={cn("flex-1 overflow-y-auto", isCollapsed ? "px-2" : "px-4")}>
                <nav className="space-y-4">
                    {groupedMenus.map((group) => (
                        <div key={group.category} className="space-y-1">
                            {!isCollapsed && (
                                <div className="pt-2 pb-1 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                    {group.category}
                                </div>
                            )}
                            {group.items.map((item: any) => {
                                const IconComponent = (LucideIcons as any)[item.icon || 'LayoutDashboard'] || LucideIcons.LayoutDashboard
                                const isActive = pathname === item.path
                                const linkContent = (
                                    <span className={cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors", isCollapsed && "justify-center px-0")}>
                                        <IconComponent className="w-4 h-4" />
                                        {!isCollapsed && item.label}
                                    </span>
                                )

                                const linkClass = cn(
                                    "block rounded-md transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )

                                if (isCollapsed) {
                                    return (
                                        <Link key={item.id} href={item.path} className={linkClass} title={item.label}>
                                            {linkContent}
                                        </Link>
                                    )
                                }

                                return (
                                    <Link key={item.id} href={item.path} className={linkClass}>
                                        {linkContent}
                                    </Link>
                                )
                            })}
                        </div>
                    ))}
                </nav>
            </div>

            <div className={cn("p-4 border-t space-y-4", isCollapsed && "space-y-3")}>
                {profile && (
                    <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                        {avatarUrl && (
                            <img
                                src={avatarUrl}
                                alt="Perfil"
                                className="w-9 h-9 rounded-full object-cover border"
                            />
                        )}
                        {!isCollapsed && (
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold truncate">{profile.full_name}</span>
                                <span className="text-xs text-muted-foreground capitalize">{profile.role}</span>
                            </div>
                        )}
                    </div>
                )}
                <Button
                    variant="outline"
                    className={cn("w-full justify-start text-destructive", isCollapsed && "justify-center")}
                    onClick={handleLogout}
                >
                    <LucideIcons.LogOut className={cn("w-4 h-4", !isCollapsed && "mr-2")} />
                    {!isCollapsed && 'Sair'}
                </Button>
            </div>
        </div>
    )
}


