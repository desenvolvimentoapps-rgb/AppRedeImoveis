import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const supabase = await createClient()
    const { data: properties } = await supabase
        .from('properties')
        .select('slug, updated_at, locale, plan_index')
        .eq('status', 'available')

    const propertyEntries: MetadataRoute.Sitemap = (properties || []).map((p) => ({
        url: `https://oliviaprado.com.br${p.locale === 'en' ? '/imoveis/en' : '/imoveis'}/${p.slug}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'weekly',
        priority: 0.8,
    }))

    return [
        {
            url: 'https://oliviaprado.com.br',
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        ...propertyEntries,
    ]
}
