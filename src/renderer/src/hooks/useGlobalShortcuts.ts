import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null
  if (!node) return false
  const tag = node.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable
}

export function useGlobalShortcuts(): void {
  const navigate = useNavigate()
  const { setPaletteOpen, setSearchOpen, setTeacherOpen } = useUi.getState()
  const update = useSettings((s) => s.update)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(!useUi.getState().paletteOpen)
        return
      }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (mod && e.key === ',') {
        e.preventDefault()
        navigate('/settings')
        return
      }
      if (mod && e.key.toLowerCase() === 'b' && !isTypingTarget(e.target)) {
        e.preventDefault()
        const { sidebarCollapsed } = useSettings.getState().settings
        void update({ sidebarCollapsed: !sidebarCollapsed })
        return
      }
      if (mod && e.key === '/') {
        e.preventDefault()
        setTeacherOpen(!useUi.getState().teacherOpen)
        return
      }
      if (e.key === 'Escape') {
        const ui = useUi.getState()
        if (ui.paletteOpen) ui.setPaletteOpen(false)
        else if (ui.searchOpen) ui.setSearchOpen(false)
        else if (ui.teacherOpen) ui.setTeacherOpen(false)
        else if (ui.notesOpen) ui.setNotesOpen(false)
        return
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        navigate(-1)
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        navigate(1)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, setPaletteOpen, setSearchOpen, setTeacherOpen, update])
}
