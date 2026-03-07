'use client'

import { create } from 'zustand'
import { CMSField, CMSMenu } from '@/types/database'

interface CMSState {
    fields: CMSField[]
    menus: CMSMenu[]
    setFields: (fields: CMSField[]) => void
    setMenus: (menus: CMSMenu[]) => void
    isLoading: boolean
    setIsLoading: (isLoading: boolean) => void
}

export const useCMSStore = create<CMSState>((set) => ({
    fields: [],
    menus: [],
    setFields: (fields) => set({ fields }),
    setMenus: (menus) => set({ menus }),
    isLoading: true,
    setIsLoading: (isLoading) => set({ isLoading }),
}))
