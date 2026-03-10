import { NextResponse } from 'next/server'
import { cloudinary } from '@/lib/cloudinary/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeFolder(input: string | null) {
    if (!input) return 'properties'
    const safe = input.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
    return safe || 'properties'
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file')
        const folder = normalizeFolder(formData.get('folder')?.toString() || null)

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString('base64')
        const dataUri = `data:${file.type};base64,${base64}`

        const uploadResult = await cloudinary.uploader.upload(dataUri, {
            folder,
            resource_type: 'image',
            overwrite: false,
        })

        return NextResponse.json({
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            width: uploadResult.width,
            height: uploadResult.height,
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Falha no upload' },
            { status: 500 }
        )
    }
}
