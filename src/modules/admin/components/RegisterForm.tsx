'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function RegisterForm() {
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            // First, create the user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            })

            if (authError) throw authError

            if (authData.user) {
                // The trigger handle_new_user should create the profile with 'corretor' role
                // For 'hakunaadm', we might need to update it if it's the first user or something.
                // But the user requested a professional system.
                // Let's assume the first registration is the admin for testing, 
                // OR I can use an SQL command to set a specific user as admin.

                toast.success('Conta criada! Verifique seu e-mail (se habilitado) ou tente logar.')
                router.push('/login')
            }
        } catch (error: any) {
            toast.error('Erro ao registrar', {
                description: error.message,
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold text-center">Criar Conta Mestra</CardTitle>
                <CardDescription className="text-center">
                    Registre-se para começar a usar o sistema
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Nome Completo</Label>
                        <Input
                            id="fullName"
                            placeholder="Seu Nome"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="seu@email.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full" type="submit" disabled={isLoading}>
                        {isLoading ? 'Registrando...' : 'Registrar'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
