import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
    try {
        const supabaseServer = await createClient()
        const { data: { user } } = await supabaseServer.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
        }

        const supabaseAdmin = getSupabaseAdmin()
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ force_password_reset: false, updated_at: new Date().toISOString() })
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
