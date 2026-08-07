import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'success' | 'error'
}

interface UiStore {
  paletteOpen: boolean
  searchOpen: boolean
  notesOpen: boolean
  teacherOpen: boolean
  isDark: boolean
  toasts: Toast[]
  setPaletteOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setNotesOpen: (open: boolean) => void
  setTeacherOpen: (open: boolean) => void
  setIsDark: (isDark: boolean) => void
  toast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export const useUi = create<UiStore>((set, get) => ({
  paletteOpen: false,
  searchOpen: false,
  notesOpen: false,
  teacherOpen: false,
  isDark: false,
  toasts: [],

  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setNotesOpen: (notesOpen) => set({ notesOpen }),
  setTeacherOpen: (teacherOpen) => set({ teacherOpen }),
  setIsDark: (isDark) => set({ isDark }),

  toast: (message, tone = 'info') => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, message, tone }] })
    setTimeout(() => get().dismissToast(id), 4000)
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))
