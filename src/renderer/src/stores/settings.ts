import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'

interface SettingsStore {
  settings: Settings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<Settings>) => Promise<void>
  reset: () => Promise<void>
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await window.desklearner.settings.get()
    set({ settings, loaded: true })
  },

  update: async (patch) => {
    // Optimistic: the UI reacts immediately, disk catches up.
    set({ settings: { ...get().settings, ...patch } })
    const settings = await window.desklearner.settings.set(patch)
    set({ settings })
  },

  reset: async () => {
    const settings = await window.desklearner.settings.reset()
    set({ settings })
  }
}))
