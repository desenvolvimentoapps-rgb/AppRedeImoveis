import { NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/api-tokens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const API_DOCS = {
    title: 'API Imobili?ria - Documenta??o',
    base_url: '/api',
    auth: {
        bearer: 'Authorization: Bearer <token>',
        session: 'Rotas administrativas exigem sess?o ativa no painel.'
    },
    endpoints: [
        {
            method: 'GET',
            path: '/api/admin/api-tokens',
            description: 'Lista tokens de acesso gerados no painel.',
            auth: 'session (admin)'
        },
        {
            method: 'POST',
            path: '/api/admin/api-tokens',
            description: 'Cria um novo token bearer.',
            auth: 'session (admin)',
            body: { name: 'Nome do token' }
        },
        {
            method: 'DELETE',
            path: '/api/admin/api-tokens/{id}',
            description: 'Remove um token existente.',
            auth: 'session (admin)'
        },
        {
            method: 'GET',
            path: '/api/admin/leads',
            description: 'Lista leads cadastrados.',
            auth: 'session (admin)'
        },
        {
            method: 'POST',
            path: '/api/admin/users',
            description: 'Cria um novo usu?rio do painel.',
            auth: 'session (admin)'
        },
        {
            method: 'POST',
            path: '/api/admin/users/reset-password',
            description: 'Reseta senha de um usu?rio.',
            auth: 'session (admin)',
            body: { userId: 'uuid', password: 'nova senha', forceReset: true }
        },
        {
            method: 'POST',
            path: '/api/admin/users/force-reset',
            description: 'Ativa ou remove o reset obrigat?rio de senha.',
            auth: 'session (admin)',
            body: { userId: 'uuid', forceReset: true }
        },
        {
            method: 'POST',
            path: '/api/admin/users/update-profile',
            description: 'Atualiza dados b?sicos do perfil.',
            auth: 'session (admin)',
            body: { userId: 'uuid', updates: { full_name: 'Nome', role: 'corretor' } }
        },
        {
            method: 'POST',
            path: '/api/admin/users/update-permissions',
            description: 'Atualiza permiss?es granulares por usu?rio.',
            auth: 'session (admin)',
            body: { userId: 'uuid', permissions: { menus: [], actions: {} } }
        },
        {
            method: 'POST',
            path: '/api/auth/validate-invite',
            description: 'Valida c?digo de convite para registro.',
            auth: 'public',
            body: { code: 'TOKEN' }
        },
        {
            method: 'POST',
            path: '/api/auth/complete-password-reset',
            description: 'Finaliza reset obrigat?rio de senha.',
            auth: 'session'
        },
        {
            method: 'POST',
            path: '/api/contact',
            description: 'Dispara contato via formul?rio p?blico.',
            auth: 'public',
            body: { name: 'Nome', email: 'email', message: 'Mensagem' }
        },
        {
            method: 'POST',
            path: '/api/leads',
            description: 'Cria lead p?blico de im?vel.',
            auth: 'public',
            body: { property_id: 'uuid', name: 'Nome', email: 'email' }
        },
        {
            method: 'POST',
            path: '/api/upload',
            description: 'Upload de arquivos para o CMS.',
            auth: 'session'
        },
        {
            method: 'GET',
            path: '/api/docs/metadata',
            description: 'Retorna este cat?logo de endpoints.',
            auth: 'bearer (token do painel)'
        }
    ]
}

export async function GET(request: Request) {
    const validation = await validateBearerToken(request)
    if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 401 })
    }

    return NextResponse.json({ ...API_DOCS, generated_at: new Date().toISOString() })
}
