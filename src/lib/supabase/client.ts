import { createBrowserSupabaseClient } from './browser'

const supabase = createBrowserSupabaseClient()

export function createClient() {
    return supabase
}

export default supabase
