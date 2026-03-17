'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, KeyRound, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuth'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { profile, refreshProfile, setProfile } = useAuthStore()
    const router = useRouter()
    const supabase = createClient()

    const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 8000) => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
            return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' })
        } finally {
            clearTimeout(timer)
        }
    }

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password.length < 6) {
            toast.error('A senha deve ter pelo menos 6 caracteres')
            return
        }

        if (password !== confirmPassword) {
            toast.error('As senhas não coincidem')
            return
        }

        setIsLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const userId = profile?.id || user?.id

            if (!userId) {
                throw new Error('Usuario nao autenticado')
            }

            let profileUpdated = false
            let apiError: string | null = null

            try {
                const response = await fetchWithTimeout('/api/auth/complete-password-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        newPassword: password,
                        forceReset: false,
                    }),
                })

                const result = await response.json().catch(() => ({}))
                if (response.ok) {
                    profileUpdated = true
                } else {
                    apiError = result?.error || 'Falha ao atualizar perfil'
                }
            } catch (error: any) {
                apiError = error?.message || 'Falha ao atualizar perfil'
            }

            if (!profileUpdated) {
                const { error: authError } = await supabase.auth.updateUser({
                    password: password
                })

                if (authError) {
                    throw new Error(apiError || authError.message || 'Falha ao atualizar senha')
                }

                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ force_password_reset: false })
                    .eq('id', userId)

                if (profileError) {
                    throw new Error(apiError || profileError.message || 'Falha ao atualizar perfil')
                }
                profileUpdated = true
            }

            if (profileUpdated && profile) {
                setProfile({ ...profile, force_password_reset: false })
            }

            toast.success('Senha atualizada com sucesso!')
            void refreshProfile()
            router.push('/admin')
            router.refresh()
        } catch (error: any) {
            toast.error('Erro ao atualizar senha', { description: error.message })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
                <div className="h-2 bg-primary"></div>
                <CardHeader className="space-y-4 pt-8 pb-4 text-center">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                        <KeyRound className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-black">Alteração Obrigatória</CardTitle>
                        <CardDescription className="text-slate-500 font-medium pb-2">
                            Por motivos de segurança, você precisa definir uma nova senha para continuar acessando o sistema.
                        </CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleReset}>
                    <CardContent className="space-y-6 px-8">
                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                                Sua senha atual expira agora. Escolha uma senha forte que você não tenha usado anteriormente neste sistema.
                            </p>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="password">Nova Senha</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-12 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="h-12 rounded-xl"
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="px-8 pb-8 pt-4">
                        <Button
                            className="w-full h-12 rounded-xl font-bold text-lg shadow-lg shadow-primary/20"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Atualizando...</>
                            ) : (
                                'Redefinir Senha'
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}

