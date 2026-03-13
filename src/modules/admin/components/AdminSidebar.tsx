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
    const { profile } = useAuthStore()
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [avatarCacheKey, setAvatarCacheKey] = useState(() => Date.now())

    useEffect(() => {
        // Refresh avatar every 15 minutes
        const intervalId = setInterval(() => setAvatarCacheKey(Date.now()), 15 * 60 * 1000)
        return () => clearInterval(intervalId)
    }, [])

    const avatarUrl = useMemo(() => {
        if (!profile?.avatar_url) return null
        const separator = profile.avatar_url.includes('?') ? '&' : '?'
        return `${profile.avatar_url}${separator}t=${avatarCacheKey}`
    }, [profile?.avatar_url, avatarCacheKey])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
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

    const baseMenus = menus
        .filter(menu => profile && menu.required_roles.includes(profile.role))
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
    ]

    const visibleStaticMenus = staticMenus
        .filter(menu => profile && (menu.required_roles as any).includes(profile.role))
        .filter(menu => isMenuAllowed(profile, menu.path))
        .filter(menu => menu.path !== '/admin/management' || hasPermission(profile, 'management', 'view'))
        .filter(menu => menu.path !== '/admin/cms/status' || hasPermission(profile, 'property_statuses', 'view'))

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
        <div className="flex flex-col w-64 border-r bg-card h-screen sticky top-0">
            <div className="p-6">
                <h1 className="text-xl font-bold text-primary">Olivia Prado</h1>
                <p className="text-xs text-muted-foreground mt-1">Gestão Imobiliária</p>
            </div>

            <div className="flex-1 px-4 overflow-y-auto">
                <nav className="space-y-4">
                    {groupedMenus.map((group) => (
                        <div key={group.category} className="space-y-1">
                            <div className="pt-2 pb-1 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                {group.category}
                            </div>
                            {group.items.map((item: any) => {
                                const IconComponent = (LucideIcons as any)[item.icon || 'LayoutDashboard'] || LucideIcons.LayoutDashboard
                                const isActive = pathname === item.path

                                return (
                                    <Link
                                        key={item.id}
                                        href={item.path}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                        )}
                                    >
                                        <IconComponent className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </div>
                    ))}
                </nav>
            </div>

            <div className="p-4 border-t space-y-4">
                {profile && (
                    <div className="flex items-center gap-3">
                        {avatarUrl && (
                            <img
                                src={avatarUrl}
                                alt="Perfil"
                                className="w-9 h-9 rounded-full object-cover border"
                            />
                        )}
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold truncate">{profile.full_name}</span>
                            <span className="text-xs text-muted-foreground capitalize">{profile.role}</span>
                        </div>
                    </div>
                )}
                <Button
                    variant="outline"
                    className="w-full justify-start text-destructive"
                    onClick={handleLogout}
                >
                    <LucideIcons.LogOut className="w-4 h-4 mr-2" />
                    Sair
                </Button>
            </div>
        </div>
    )
}


