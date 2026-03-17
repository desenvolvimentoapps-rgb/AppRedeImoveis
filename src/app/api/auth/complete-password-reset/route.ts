import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const supabaseServer = await createClient()
        const { data: { user } } = await supabaseServer.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({}))
        const userId = (body?.userId || '').toString().trim()
        const newPassword = (body?.newPassword || '').toString()
        const forceReset = typeof body?.forceReset === 'boolean' ? body.forceReset : false

        if (userId && userId !== user.id) {
            return NextResponse.json({ error: 'Usuario invalido' }, { status: 403 })
        }

        const supabaseAdmin = getSupabaseAdmin()

        if (newPassword) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                password: newPassword,
            })

            if (authError) {
                return NextResponse.json({ error: authError.message }, { status: 400 })
            }
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ force_password_reset: forceReset, updated_at: new Date().toISOString() })
            .eq('id', user.id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Falha ao atualizar perfil' },
            { status: 500 }
        )
    }
}
