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

        const fullName = (body?.fullName || '').toString().trim()
        const email = (body?.email || '').toString().trim()
        const password = (body?.password || '').toString().trim()
        const role = (body?.role || 'corretor').toString().trim()
        const phone = (body?.phone || '').toString().trim()
        const forceReset = !!body?.forceReset

        if (!fullName || !email || !password) {
            return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                role,
                phone,
                force_password_reset: forceReset,
            },
        })

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 })
        }

        const userId = authData.user?.id
        if (!userId) {
            return NextResponse.json({ error: 'Falha ao criar usuario' }, { status: 500 })
        }

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                full_name: fullName,
                email,
                role,
                phone,
                force_password_reset: forceReset,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' })

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Falha ao criar usuario' },
            { status: 500 }
        )
    }
}
