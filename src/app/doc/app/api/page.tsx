'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, KeyRound, RefreshCw } from 'lucide-react'

interface ApiEndpoint {
    method: string
    path: string
    description: string
    auth: string
    body?: Record<string, any>
}

interface ApiDocs {
    title: string
    base_url: string
    auth: Record<string, string>
    endpoints: ApiEndpoint[]
    generated_at?: string
}

export default function ApiDocsPage() {
    const [token, setToken] = useState('')
    const [docs, setDocs] = useState<ApiDocs | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const loadDocs = async (tokenValue: string) => {
        if (!tokenValue) {
            setError('Informe um token Bearer para carregar a documentação.')
            return
        }
        setIsLoading(true)
        setError('')
        try {
            const response = await fetch('/api/docs/metadata', {
                headers: { Authorization: `Bearer ${tokenValue}` },
                cache: 'no-store'
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Falha ao carregar documentação')
            }
            setDocs(data)
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('api_doc_token', tokenValue)
            }
        } catch (err: any) {
            setDocs(null)
            setError(err?.message || 'Falha ao carregar documentação')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (typeof window === 'undefined') return
        const stored = window.localStorage.getItem('api_doc_token')
        if (stored) {
            setToken(stored)
            loadDocs(stored)
        }
    }, [])

    return (
        <div className="max-w-5xl mx-auto py-12 px-6 space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Documentação de API</h1>
                <p className="text-muted-foreground">
                    Consulte os endpoints dispon?veis e exemplos de uso. Para visualizar, informe um token Bearer
                    gerado no painel em Acessos API.
                </p>
            </div>

            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" /> Token Bearer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <Input
                            placeholder="Bearer token"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="font-mono"
                        />
                        <Button onClick={() => loadDocs(token)} disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Carregar documentação
                        </Button>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </CardContent>
            </Card>

            {docs && (
                <div className="space-y-6">
                    <Card className="border-slate-200">
                        <CardHeader>
                            <CardTitle>{docs.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div><span className="font-semibold">Base URL:</span> {docs.base_url}</div>
                            <div className="space-y-1">
                                <div className="font-semibold">Autenticação</div>
                                <div className="text-muted-foreground">Bearer: {docs.auth?.bearer}</div>
                                <div className="text-muted-foreground">Sess?o: {docs.auth?.session}</div>
                            </div>
                            {docs.generated_at && (
                                <div className="text-xs text-muted-foreground">Gerado em: {new Date(docs.generated_at).toLocaleString()}</div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-4">
                        {docs.endpoints.map((endpoint, index) => (
                            <Card key={`${endpoint.path}-${index}`} className="border-slate-200">
                                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Badge variant="outline" className="uppercase">{endpoint.method}</Badge>
                                        <span className="font-mono text-sm">{endpoint.path}</span>
                                    </CardTitle>
                                    <span className="text-xs text-muted-foreground">Auth: {endpoint.auth}</span>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <p>{endpoint.description}</p>
                                    {endpoint.body && (
                                        <div>
                                            <div className="text-xs font-semibold mb-1">Body sugerido</div>
                                            <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-x-auto">{JSON.stringify(endpoint.body, null, 2)}</pre>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
