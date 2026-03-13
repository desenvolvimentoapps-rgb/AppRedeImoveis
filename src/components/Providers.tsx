'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthProvider } from '@/hooks/useAuthProvider'
import { useCMSScanner } from '@/hooks/useCMSScanner'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())
    useAuthProvider()
    useInactivityLogout()
    useCMSScanner()

    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                {children}
                <Toaster />
            </TooltipProvider>
        </QueryClientProvider>
    )
}
