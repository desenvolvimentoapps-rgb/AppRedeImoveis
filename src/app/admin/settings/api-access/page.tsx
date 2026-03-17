'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { KeyRound, Plus, Trash2, Copy, Loader2 } from 'lucide-react'

interface ApiTokenItem {
    id: string
    name: string
    token_prefix: string
    created_at: string
    last_used_at?: string | null
    is_active: boolean
}

export default function ApiAccessPage() {
    const { profile } = useAuthStore()
    const isAdmin = profile?.role === 'hakunaadm'
    const canView = isAdmin && hasPermission(profile, 'settings', 'view')
    const canEdit = isAdmin && hasPermission(profile, 'settings', 'edit')

    const [tokens, setTokens] = useState<ApiTokenItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [tokenName, setTokenName] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [generatedToken, setGeneratedToken] = useState<string | null>(null)

    useEffect(() => {
        if (profile) fetchTokens()
    }, [profile])

    const fetchTokens = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/admin/api-tokens', { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.error || 'Falha ao carregar tokens')
            setTokens(data?.tokens || [])
        } catch (error: any) {
            toast.error('Erro ao carregar tokens', { description: error.message })
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreate = async () => {
        if (!canEdit) {
            toast.error('Sem permiss?o para criar tokens')
            return
        }
        if (!tokenName.trim()) {
            toast.error('Informe um nome para o token')
            return
        }

        setIsCreating(true)
        try {
            const response = await fetch('/api/admin/api-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: tokenName.trim() })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.error || 'Falha ao criar token')
            setGeneratedToken(data?.token || null)
            setTokenName('')
            toast.success('Token criado com sucesso')
            await fetchTokens()
        } catch (error: any) {
            toast.error('Erro ao criar token', { description: error.message })
        } finally {
            setIsCreating(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!canEdit) return
        if (!confirm('Deseja excluir este token?')) return
        try {
            const response = await fetch(`/api/admin/api-tokens/${id}`, { method: 'DELETE' })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.error || 'Falha ao excluir token')
            toast.success('Token removido')
            setTokens(prev => prev.filter(item => item.id !== id))
        } catch (error: any) {
            toast.error('Erro ao excluir token', { description: error.message })
        }
    }

    const copyToken = async () => {
        if (!generatedToken) return
        try {
            await navigator.clipboard.writeText(generatedToken)
            toast.success('Token copiado!')
        } catch {
            toast.error('N?o foi poss?vel copiar o token')
        }
    }

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
                <h2 className="text-xl font-bold">Acesso restrito</h2>
                <p className="text-muted-foreground">Apenas administradores podem gerenciar tokens de API.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Acessos API</h1>
                    <p className="text-muted-foreground mt-1">Crie e revogue tokens Bearer para integrações externas.</p>
                </div>
                <Button onClick={() => { setGeneratedToken(null); setIsCreateOpen(true) }} disabled={!canEdit}>
                    <Plus className="w-4 h-4 mr-2" /> Novo Token
                </Button>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50">
                    <CardTitle>Tokens ativos</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : tokens.length == 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-10">Nenhum token criado.</div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Prefixo</TableHead>
                                        <TableHead>Criado em</TableHead>
                                        <TableHead>último uso</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tokens.map(token => (
                                        <TableRow key={token.id}>
                                            <TableCell className="font-medium">{token.name}</TableCell>
                                            <TableCell>{token.token_prefix}</TableCell>
                                            <TableCell>{new Date(token.created_at).toLocaleString()}</TableCell>
                                            <TableCell>{token.last_used_at ? new Date(token.last_used_at).toLocaleString() : '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant={token.is_active ? 'default' : 'secondary'}>
                                                    {token.is_active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive"
                                                    onClick={() => handleDelete(token.id)}
                                                    disabled={!canEdit}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Novo Token de API</DialogTitle>
                        <DialogDescription>O token ser exibido apenas uma vez. Copie e guarde em local seguro.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome do token</label>
                            <Input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Ex: Integra??o CRM" />
                        </div>
                        {generatedToken && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Token gerado</label>
                                <div className="flex items-center gap-2">
                                    <Input value={generatedToken} readOnly className="font-mono text-xs" />
                                    <Button variant="outline" size="icon" onClick={copyToken}>
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Use no header: Authorization: Bearer &lt;token&gt;</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Fechar</Button>
                        <Button onClick={handleCreate} disabled={isCreating || !canEdit}>
                            {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                            Gerar Token
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
