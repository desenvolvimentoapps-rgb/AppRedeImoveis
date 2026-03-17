import { getSupabaseAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

export type ApiTokenValidation =
    | { ok: true; tokenId: string }
    | { ok: false; error: string }

export async function validateBearerToken(request: Request): Promise<ApiTokenValidation> {
    const authHeader = request.headers.get('authorization') || ''
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    const token = match?.[1]?.trim()

    if (!token) {
        return { ok: false, error: 'Token ausente' }
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
        .from('api_access_tokens')
        .select('id, is_active')
        .eq('token_hash', tokenHash)
        .maybeSingle()

    if (error || !data || !data.is_active) {
        return { ok: false, error: 'Token invalido ou inativo' }
    }

    await supabaseAdmin
        .from('api_access_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)

    return { ok: true, tokenId: data.id }
}
