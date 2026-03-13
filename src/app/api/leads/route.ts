import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const toEmail = 'desenvolvimentoimoveis@gmail.com'

function escapeHtml(input: string) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export async function POST(request: Request) {
    try {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY not configured')
        }

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json(
                { error: 'Supabase admin nao configurado no servidor.' },
                { status: 500 }
            )
        }
        if (serviceRoleKey.startsWith('sb_publishable') || serviceRoleKey.startsWith('sb_public')) {
            return NextResponse.json(
                { error: 'SUPABASE_SERVICE_ROLE_KEY invalida. Use a chave service_role (sb_secret_*).' },
                { status: 500 }
            )
        }

        const supabaseAdmin = getSupabaseAdmin()
        const resend = new Resend(process.env.RESEND_API_KEY)
        const body = await request.json()

        const name = (body?.name || '').toString().trim()
        const email = (body?.email || '').toString().trim()
        const phone = (body?.phone || '').toString().trim()
        const message = (body?.message || '').toString().trim()
        const propertyId = (body?.propertyId || '').toString().trim()
        const propertyTitle = (body?.propertyTitle || '').toString().trim()
        const propertyCode = (body?.propertyCode || '').toString().trim()
        const internalCode = (body?.propertyInternalCode || '').toString().trim()
        const propertyUrl = (body?.propertyUrl || '').toString().trim()

        if (!name || !email) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        const { error: leadError } = await supabaseAdmin
            .from('leads')
            .insert([{
                property_id: propertyId || null,
                name,
                email,
                phone,
                message,
                status: 'new',
                created_at: new Date().toISOString(),
            }])

        if (leadError) {
            return NextResponse.json({ error: leadError.message || 'Failed to save lead' }, { status: 500 })
        }

        const safeName = escapeHtml(name)
        const safeEmail = escapeHtml(email)
        const safePhone = escapeHtml(phone)
        const safeMessage = escapeHtml(message)
        const safeTitle = escapeHtml(propertyTitle || 'Imovel')
        const safeCode = escapeHtml(propertyCode || 'N/A')
        const safeInternal = escapeHtml(internalCode || 'N/A')
        const safeUrl = escapeHtml(propertyUrl || 'N/A')

        const subjectCode = safeCode && safeCode !== 'N/A' ? safeCode : safeTitle
        const emailResult = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: toEmail,
            subject: `Novo contato sobre imovel - ${subjectCode}`,
            replyTo: safeEmail,
            html: `
                <h2>Novo lead do site</h2>
                <p><strong>Nome:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Telefone:</strong> ${safePhone || 'N/A'}</p>
                <p><strong>Imovel:</strong> ${safeTitle}</p>
                <p><strong>Codigo:</strong> ${safeCode}</p>
                <p><strong>Codigo interno:</strong> ${safeInternal}</p>
                <p><strong>Link:</strong> ${safeUrl}</p>
                <p><strong>Mensagem:</strong></p>
                <p>${safeMessage ? safeMessage.replace(/\n/g, '<br />') : 'N/A'}</p>
            `,
        })

        if (emailResult?.error) {
            return NextResponse.json(
                { error: emailResult.error.message || 'Failed to send email' },
                { status: 500 }
            )
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Failed to send lead' },
            { status: 500 }
        )
    }
}
