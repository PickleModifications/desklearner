import { useEffect } from 'react'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'

/**
 * Applies theme/accent/density to the document root and keeps the resolved
 * light-vs-dark answer in the UI store so Mermaid and Shiki can react to it.
 */
export function useTheme(): void {
  const settings = useSettings((s) => s.settings)
  const setIsDark = useUi((s) => s.setIsDark)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = (): void => {
      const isDark = settings.theme === 'system' ? media.matches : settings.theme === 'dark'
      root.dataset.theme = isDark ? 'dark' : 'light'
      setIsDark(isDark)
    }

    apply()
    media.addEventListener('change', apply)
    const off = window.desklearner.system.onNativeThemeChange(apply)
    return () => {
      media.removeEventListener('change', apply)
      off()
    }
  }, [settings.theme, setIsDark])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.accent = settings.accent
    root.dataset.density = settings.density
    root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full'
  }, [settings.accent, settings.density, settings.reducedMotion])
}
