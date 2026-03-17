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

        const { data: requesterProfile } = await supabaseServer
            .from('profiles')
            .select('id, role, permissions')
            .eq('id', user.id)
            .single()

        if (!requesterProfile || !hasPermission(requesterProfile as any, 'users', 'edit')) {
            return NextResponse.json({ error: 'Sem permissao para editar usuarios' }, { status: 403 })
        }

        const body = await request.json()
        const userId = (body?.userId || '').toString().trim()
        const updates = body?.updates || {}

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
                return NextResponse.json({ error: 'Sem permissao para editar administrador' }, { status: 403 })
            }
            if (updates?.role === 'hakunaadm') {
                return NextResponse.json({ error: 'Sem permissao para promover administrador' }, { status: 403 })
            }
        }

        const allowedUpdates: Record<string, any> = {}
        if (typeof updates.full_name === 'string') allowedUpdates.full_name = updates.full_name
        if (typeof updates.phone === 'string') allowedUpdates.phone = updates.phone
        if (typeof updates.role === 'string') allowedUpdates.role = updates.role
        if (updates.role_id === null || typeof updates.role_id === 'string') allowedUpdates.role_id = updates.role_id
        if (typeof updates.force_password_reset === 'boolean') allowedUpdates.force_password_reset = updates.force_password_reset

        allowedUpdates.updated_at = new Date().toISOString()

        const { error } = await supabaseAdmin
            .from('profiles')
            .update(allowedUpdates)
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
