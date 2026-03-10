'use client'

import { CMSField } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import * as LucideIcons from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'

interface DynamicFieldRendererProps {
    field: CMSField
    value: any
    onChange: (value: any) => void
    disabled?: boolean
}

export function DynamicFieldRenderer({ field, value, onChange, disabled }: DynamicFieldRendererProps) {
    const normalizeIconName = (name: string) => {
        if (!name) return 'Info'
        // Convert kebab-case or space-separated to PascalCase
        const pascal = name
            .split(/[- ]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('')
        return pascal
    }

    const iconName = normalizeIconName(field.icon || 'Info')
    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Info

    const LabelWithInfo = () => (
        <div className="flex items-center gap-1.5 mb-1">
            <IconComponent className="w-3.5 h-3.5 text-muted-foreground" />
            <Label htmlFor={field.name} className="text-xs font-semibold uppercase tracking-wider">
                {field.label} {field.is_required && <span className="text-destructive">*</span>}
            </Label>
            {field.instruction && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger render={(props) => (
                            <HelpCircle {...props} className="w-3 h-3 text-muted-foreground cursor-help" />
                        )} />
                        <TooltipContent>
                            <p className="max-w-xs">{field.instruction}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    )

    if (field.type === 'boolean') {
        return (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                        <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <Label htmlFor={field.name} className="cursor-pointer font-medium">
                            {field.label}
                        </Label>
                        {field.instruction && <p className="text-[10px] text-muted-foreground">{field.instruction}</p>}
                    </div>
                </div>
                <Switch
                    id={field.name}
                    checked={!!value}
                    onCheckedChange={onChange}
                    disabled={disabled}
                />
            </div>
        )
    }

    if (field.type === 'textarea') {
        return (
            <div className="space-y-2">
                <LabelWithInfo />
                <Textarea
                    id={field.name}
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || `Informe ${field.label.toLowerCase()}`}
                    disabled={disabled}
                    className="min-h-[100px]"
                />
            </div>
        )
    }

    if (field.type === 'select') {
        const options = Array.isArray(field.options) ? field.options : []
        return (
            <div className="space-y-2">
                <LabelWithInfo />
                <Select value={value?.toString() || ''} onValueChange={onChange} disabled={disabled}>
                    <SelectTrigger id={field.name}>
                        <SelectValue placeholder={field.placeholder || 'Selecione uma opção'} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((opt: string) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <LabelWithInfo />
            <Input
                id={field.name}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                value={value ?? ''}
                onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={field.placeholder || `Informe ${field.label.toLowerCase()}`}
                disabled={disabled}
                className="focus-visible:ring-primary"
            />
        </div>
    )
}
