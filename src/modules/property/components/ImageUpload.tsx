'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ImageUploadProps {
    images: string[]
    onChange: (images: string[]) => void
    onMainImageChange?: (index: number) => void
    mainImageIndex: number
}

export function ImageUpload({ images, onChange, onMainImageChange, mainImageIndex }: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false)

    const uploadToCloudinary = async (file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'properties')

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        })

        const data = await response.json()
        if (!response.ok) {
            throw new Error(data?.error || 'Falha no upload')
        }

        return data?.url as string
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        const newImages = [...images]

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const url = await uploadToCloudinary(file)
                newImages.push(url)
            }

            onChange(newImages)
            toast.success('Imagens enviadas com sucesso!')
        } catch (error: any) {
            toast.error('Erro no upload', { description: error.message })
        } finally {
            setIsUploading(false)
            e.target.value = ''
        }
    }

    const removeImage = (index: number) => {
        const newImages = images.filter((_, i) => i !== index)
        onChange(newImages)
        if (mainImageIndex === index) {
            onMainImageChange?.(0)
        } else if (mainImageIndex > index) {
            onMainImageChange?.(mainImageIndex - 1)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
                        <img src={url} alt={`Property ${index}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-2">
                            <Button
                                type="button"
                                variant={mainImageIndex === index ? "default" : "secondary"}
                                size="sm"
                                className="h-7 text-[9px] px-2 shadow-sm"
                                onClick={() => onMainImageChange?.(index)}
                            >
                                {mainImageIndex === index ? 'Principal' : 'Tornar Princ.'}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-7 w-7 p-0 shadow-sm"
                                onClick={() => removeImage(index)}
                                title="Remover Foto"
                            >
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                        {mainImageIndex === index && (
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded shadow">
                                PRINCIPAL
                            </div>
                        )}
                    </div>
                ))}

                <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={isUploading}
                    />
                    {isUploading ? (
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : (
                        <>
                            <Plus className="w-8 h-8 text-muted-foreground mb-2" />
                            <span className="text-xs font-medium text-muted-foreground">Upload Fotos</span>
                        </>
                    )}
                </label>
            </div>
        </div>
    )
}
