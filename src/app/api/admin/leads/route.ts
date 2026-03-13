import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
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
        const id = (body?.id || '').toString().trim()
        const status = (body?.status || '').toString().trim()
        const dateContato = body?.date_contato ? String(body.date_contato) : null
        const actionContato = body?.action_contato ? String(body.action_contato) : null

        if (!id || !status) {
            return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
        }

        const payload: Record<string, any> = { status }
        if (body?.date_contato !== undefined) payload.date_contato = dateContato
        if (body?.action_contato !== undefined) payload.action_contato = actionContato

        const { data, error } = await supabaseAdmin
            .from('leads')
            .update(payload)
            .eq('id', id)
            .select('*')
            .maybeSingle()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        if (!data) {
            return NextResponse.json({ error: 'Lead nao encontrado' }, { status: 404 })
        }

        return NextResponse.json({ data })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Falha ao atualizar lead' },
            { status: 500 }
        )
    }
}
