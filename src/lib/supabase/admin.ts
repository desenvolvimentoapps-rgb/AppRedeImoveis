import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedAdmin: SupabaseClient | null = null

const getAdminConfig = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''

    return { supabaseUrl, serviceRoleKey }
}

export function getSupabaseAdmin() {
    const { supabaseUrl, serviceRoleKey } = getAdminConfig()

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase admin not configured')
    }

    if (!cachedAdmin) {
        cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        })
    }

    return cachedAdmin
}
