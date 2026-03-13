import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type BrowserClient = ReturnType<typeof createBrowserClient>

const globalForSupabase = globalThis as typeof globalThis & {
    __supabaseBrowserClient?: BrowserClient
}

export function createBrowserSupabaseClient() {
    if (globalForSupabase.__supabaseBrowserClient) {
        return globalForSupabase.__supabaseBrowserClient
    }

    const client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    })

    globalForSupabase.__supabaseBrowserClient = client
    return client
}
