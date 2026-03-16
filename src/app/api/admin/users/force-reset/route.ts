import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const supabaseServer = await createClient()
        const { data: { user } } = await supabaseServer.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
        }

        const { data: requesterProfile, error: requesterError } = await supabaseServer
            .from('profiles')
            .select('id, role, permissions')
            .eq('id', user.id)
            .single()

        if (requesterError || !requesterProfile) {
            return NextResponse.json({ error: 'Perfil nao encontrado' }, { status: 403 })
        }

        if (!hasPermission(requesterProfile as any, 'users', 'edit')) {
            return NextResponse.json({ error: 'Sem permissao para editar usuario' }, { status: 403 })
        }

        const body = await request.json()
        const userId = (body?.userId || '').toString().trim()
        const forceReset = !!body?.forceReset

        if (!userId) {
            return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
        }

        const supabaseAdmin = getSupabaseAdmin()

        if (requesterProfile.role !== 'hakunaadm') {
            const { data: targetProfile } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single()

            if (targetProfile?.role === 'hakunaadm') {
                return NextResponse.json({ error: 'Sem permissao para alterar administrador' }, { status: 403 })
            }
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ force_password_reset: forceReset, updated_at: new Date().toISOString() })
            .eq('id', userId)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Falha ao atualizar usuario' },
            { status: 500 }
        )
    }
}
