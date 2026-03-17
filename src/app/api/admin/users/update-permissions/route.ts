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

        if (!requesterProfile || !hasPermission(requesterProfile as any, 'management', 'edit')) {
            return NextResponse.json({ error: 'Sem permissao para editar permissoes' }, { status: 403 })
        }

        const body = await request.json()
        const userId = (body?.userId || '').toString().trim()
        const permissions = body?.permissions

        if (!userId || !permissions) {
            return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
        }

        if (requesterProfile.role !== 'hakunaadm') {
            const supabaseAdmin = getSupabaseAdmin()
            const { data: targetProfile } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single()

            if (targetProfile?.role === 'hakunaadm') {
                return NextResponse.json({ error: 'Sem permissao para editar administrador' }, { status: 403 })
            }
        }

        const supabaseAdmin = getSupabaseAdmin()
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ permissions, updated_at: new Date().toISOString() })
            .eq('id', userId)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Falha ao salvar permissoes' },
            { status: 500 }
        )
    }
}
