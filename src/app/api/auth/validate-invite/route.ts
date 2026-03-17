import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INVITE_KEY = 'invite_code'
const MASTER_TOKEN = '#ADM!moveisAPP'
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const TOKEN_LENGTH = 14
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'

const generateToken = () => {
    const bytes = crypto.randomBytes(TOKEN_LENGTH)
    let token = ''
    for (let i = 0; i < TOKEN_LENGTH; i += 1) {
        token += CHARSET[bytes[i] % CHARSET.length]
    }
    return token
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const code = (body?.code || '').toString().trim()

        if (!code) {
            return NextResponse.json({ error: 'Informe o código de convite' }, { status: 400 })
        }

        if (code === MASTER_TOKEN) {
            return NextResponse.json({ ok: true })
        }

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

            await supabaseAdmin
                .from('cms_settings')
                .upsert({
                    id: data?.id,
                    key: INVITE_KEY,
                    value: { token, expires_at: nextExpires },
                    label: 'Código de convite',
                    description: 'Token de convite para novos cadastros',
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'key' })

            return NextResponse.json({ error: 'Código expirado. Solicite um novo.' }, { status: 403 })
        }

        if (code !== current.token) {
            return NextResponse.json({ error: 'Código de convite inválido.' }, { status: 403 })
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Falha ao validar código' }, { status: 500 })
    }
}
