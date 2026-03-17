import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { hasPermission } from '@/lib/permissions'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOKEN_PREFIX = 'api_'
const TOKEN_BYTES = 32

const generateToken = () => `${TOKEN_PREFIX}${crypto.randomBytes(TOKEN_BYTES).toString('hex')}`
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

async function getRequesterProfile() {
    const supabaseServer = await createClient()
    const { data: { user } } = await supabaseServer.auth.getUser()
    if (!user) return { error: 'Nao autenticado', status: 401 }

    const { data: profile } = await supabaseServer
        .from('profiles')
        .select('id, role, permissions')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Perfil nao encontrado', status: 404 }
    return { profile, user }
}

export async function GET() {
    try {
        const { profile, error, status } = await getRequesterProfile()
        if (error) return NextResponse.json({ error }, { status })
        if (!profile) return NextResponse.json({ error: 'Perfil nao encontrado' }, { status: 404 })

        if (profile.role !== 'hakunaadm' || !hasPermission(profile as any, 'settings', 'view')) {
            return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
        }

        const supabaseAdmin = getSupabaseAdmin()
        const { data, error: listError } = await supabaseAdmin
            .from('api_access_tokens')
            .select('id, name, token_prefix, created_at, last_used_at, is_active')
            .order('created_at', { ascending: false })

        if (listError) {
            return NextResponse.json({ error: listError.message }, { status: 500 })
        }

        return NextResponse.json({ tokens: data || [] })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Falha ao carregar tokens' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const { profile, user, error, status } = await getRequesterProfile()
        if (error) return NextResponse.json({ error }, { status })
        if (!profile) return NextResponse.json({ error: 'Perfil nao encontrado' }, { status: 404 })

        if (profile.role !== 'hakunaadm' || !hasPermission(profile as any, 'settings', 'edit')) {
            return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
        }

        const body = await request.json()
        const name = (body?.name || '').toString().trim()
        if (!name) {
            return NextResponse.json({ error: 'Informe um nome para o token' }, { status: 400 })
        }

        const token = generateToken()
        const tokenHash = hashToken(token)
        const tokenPrefix = token.slice(0, 8)

        const supabaseAdmin = getSupabaseAdmin()
        const { error: insertError } = await supabaseAdmin
            .from('api_access_tokens')
            .insert({
                name,
                token_hash: tokenHash,
                token_prefix: tokenPrefix,
                created_by: user?.id || null,
                is_active: true,
            })

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        return NextResponse.json({ token, token_prefix: tokenPrefix })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Falha ao criar token' }, { status: 500 })
    }
}
