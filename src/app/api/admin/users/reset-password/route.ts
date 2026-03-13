import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

        if (!supabaseUrl) {
            return NextResponse.json(
                { error: 'SUPABASE_URL nao configurada no servidor.' },
                { status: 500 }
            )
        }

        if (!serviceRoleKey || serviceRoleKey.startsWith('sb_publishable') || serviceRoleKey.startsWith('sb_public')) {
            return NextResponse.json(
                { error: 'SUPABASE_SERVICE_ROLE_KEY invalida. Use a chave service_role (sb_secret_*).' },
                { status: 500 }
            )
        }

        const supabaseAdmin = getSupabaseAdmin()
        const body = await request.json()
        const userId = (body?.userId || '').toString().trim()
        const newPassword = (body?.newPassword || '').toString().trim()
        const forceReset = !!body?.forceReset

        if (!userId || !newPassword) {
            return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
        }

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword,
        })

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 })
        }

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ force_password_reset: forceReset, updated_at: new Date().toISOString() })
            .eq('id', userId)

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Falha ao resetar senha' },
            { status: 500 }
        )
    }
}
