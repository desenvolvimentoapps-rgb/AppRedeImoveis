import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'

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

        if (!hasPermission(requesterProfile as any, 'users', 'create')) {
            return NextResponse.json({ error: 'Sem permissao para criar usuarios' }, { status: 403 })
        }

        const supabaseAdmin = getSupabaseAdmin()
        const body = await request.json()

        const fullName = (body?.fullName || '').toString().trim()
        const email = (body?.email || '').toString().trim()
        const password = (body?.password || '').toString().trim()
        const role = (body?.role || 'corretor').toString().trim()
        const roleId = body?.roleId ? body?.roleId.toString().trim() : null
        const phone = (body?.phone || '').toString().trim()
        const forceReset = !!body?.forceReset

        if (!fullName || !email || !password) {
            return NextResponse.json({ error: 'Dados invalidos' }, { status: 400 })
        }
        if (role === 'hakunaadm' && requesterProfile.role !== 'hakunaadm') {
            return NextResponse.json({ error: 'Sem permissao para criar administrador' }, { status: 403 })
        }
        if (roleId && requesterProfile.role !== 'hakunaadm') {
            return NextResponse.json({ error: 'Sem permissao para definir role personalizada' }, { status: 403 })
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
                role_id: roleId,
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
