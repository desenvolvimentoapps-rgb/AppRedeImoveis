import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { hasPermission } from '@/lib/permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const supabaseServer = await createClient()
        const { data: { user } } = await supabaseServer.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

        const { data: profile } = await supabaseServer
            .from('profiles')
            .select('id, role, permissions')
            .eq('id', user.id)
            .single()

        if (!profile || profile.role !== 'hakunaadm' || !hasPermission(profile as any, 'settings', 'edit')) {
            return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
        }

        const { id: tokenId } = await context.params
        if (!tokenId) {
            return NextResponse.json({ error: 'Token invalido' }, { status: 400 })
        }

        const supabaseAdmin = getSupabaseAdmin()
        const { error } = await supabaseAdmin
            .from('api_access_tokens')
            .delete()
            .eq('id', tokenId)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Falha ao excluir token' }, { status: 500 })
    }
}
