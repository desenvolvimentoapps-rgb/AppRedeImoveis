import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { hasPermission } from '@/lib/permissions'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INVITE_KEY = 'invite_code'
const TOKEN_LENGTH = 14
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'

const generateToken = () => {
    const bytes = crypto.randomBytes(TOKEN_LENGTH)
    let token = ''
    for (let i = 0; i < TOKEN_LENGTH; i += 1) {
        token += CHARSET[bytes[i] % CHARSET.length]
    }
    return token
}

async function getOrCreateInvite() {
    const supabaseAdmin = getSupabaseAdmin()
    const { data } = await supabaseAdmin
        .from('cms_settings')
        .select('id, value')
        .eq('key', INVITE_KEY)
        .maybeSingle()

    const now = Date.now()
    const current = data?.value as { token?: string; expires_at?: string } | null
    const expiresAt = current?.expires_at ? new Date(current.expires_at).getTime() : 0

    if (!current?.token || !current?.expires_at || now >= expiresAt) {
        const token = generateToken()
        const nextExpires = new Date(now + TOKEN_TTL_MS).toISOString()
        const payload = { token, expires_at: nextExpires }

        await supabaseAdmin
            .from('cms_settings')
            .upsert({
                id: data?.id,
                key: INVITE_KEY,
                value: payload,
                label: 'Código de convite',
                description: 'Token de convite para novos cadastros',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' })

        return payload
    }

    return current
}

export async function GET() {
    try {
        const supabaseServer = await createClient()
        const { data: { user } } = await supabaseServer.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

        const { data: profile } = await supabaseServer
            .from('profiles')
            .select('role, permissions')
            .eq('id', user.id)
            .single()

        if (!profile || profile.role !== 'hakunaadm' || !hasPermission(profile as any, 'users', 'view')) {
            return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
        }

        const invite = await getOrCreateInvite()
        return NextResponse.json(invite)
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Falha ao carregar token' }, { status: 500 })
    }
}

export async function POST() {
    try {
        const supabaseServer = await createClient()
        const { data: { user } } = await supabaseServer.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

        const { data: profile } = await supabaseServer
            .from('profiles')
            .select('role, permissions')
            .eq('id', user.id)
            .single()

        if (!profile || profile.role !== 'hakunaadm' || !hasPermission(profile as any, 'users', 'edit')) {
            return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
        }

        const supabaseAdmin = getSupabaseAdmin()
        const token = generateToken()
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

        await supabaseAdmin
            .from('cms_settings')
            .upsert({
                key: INVITE_KEY,
                value: { token, expires_at: expiresAt },
                label: 'Código de convite',
                description: 'Token de convite para novos cadastros',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' })

        return NextResponse.json({ token, expires_at: expiresAt })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Falha ao gerar token' }, { status: 500 })
    }
}
