'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCMSStore } from '@/hooks/useCMS'
import { useAuthStore } from '@/hooks/useAuth'
import * as LucideIcons from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'

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

    const filteredMenus = menus.filter(menu =>
        profile && menu.required_roles.includes(profile.role)
    )

    return (
        <div className="flex flex-col w-64 border-r bg-card h-screen sticky top-0">
            <div className="p-6">
                <h1 className="text-xl font-bold text-primary">Olivia Prado</h1>
                <p className="text-xs text-muted-foreground mt-1">Gestão Imobiliária</p>
            </div>

            <ScrollArea className="flex-1 px-4">
                <nav className="space-y-1">
                    {filteredMenus.map((item) => {
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

                    <div className="pt-4 pb-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Análises & Dashboards</div>
                    <Link
                        href="/admin/cms/charts"
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            pathname === "/admin/cms/charts"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        <LucideIcons.BarChart3 className="w-4 h-4" />
                        Gestão de Gráficos
                    </Link>
                    <Link
                        href="/admin/dashboard/my-charts"
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            pathname === "/admin/dashboard/my-charts"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        <LucideIcons.PieChart className="w-4 h-4" />
                        Meus Gráficos
                    </Link>
                </nav>
            </ScrollArea>

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
