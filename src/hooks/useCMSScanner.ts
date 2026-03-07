'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { useCMSStore } from './useCMS'

export function useCMSScanner() {
    const { setFields, setMenus, setIsLoading } = useCMSStore()
    const supabase = createClient()

    useEffect(() => {
        const fetchConfig = async () => {
            const [fieldsRes, menusRes] = await Promise.all([
                supabase.from('cms_fields').select('*').eq('is_active', true),
                supabase.from('cms_menus').select('*').eq('is_active', true).order('display_order', { ascending: true })
            ])

            if (fieldsRes.data) setFields(fieldsRes.data)
            if (menusRes.data) setMenus(menusRes.data)
            setIsLoading(false)
        }

        fetchConfig()
    }, [supabase, setFields, setMenus, setIsLoading])
}
