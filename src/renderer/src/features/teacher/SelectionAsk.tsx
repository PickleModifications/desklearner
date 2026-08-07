import { useEffect, useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { useSettings } from '@/stores/settings'
import { useTeacher } from '@/stores/teacher'
import { useUi } from '@/stores/ui'
import { quoteSelection } from './prompts'

interface PillPosition {
  top: number
  left: number
  text: string
}

const MIN_SELECTION_LENGTH = 12

/**
 * Floating "Ask teacher" pill that follows a text selection inside the lesson
 * article. Clicking it opens the panel with the excerpt pre-quoted.
 */
export function SelectionAsk({
  container
}: {
  container: HTMLElement | null
}): React.JSX.Element | null {
  const [pill, setPill] = useState<PillPosition | null>(null)
  const setOpen = useUi((s) => s.setTeacherOpen)
  const setDraft = useTeacher((s) => s.setDraft)
  const keyConfigured = useTeacher((s) => s.keyStatus.configured)
  const enabled = useSettings((s) => s.settings.aiEnabled)
  const active = keyConfigured && enabled

  useEffect(() => {
    if (!active || !container) return

    function update(): void {
      const selection = window.getSelection()

      if (!selection || selection.isCollapsed || !container) {
        setPill(null)
        return
      }

      const text = selection.toString().trim()
      if (text.length < MIN_SELECTION_LENGTH) {
        setPill(null)
        return
      }

      // Only react to selections made inside the lesson body.
      const anchor = selection.anchorNode
      if (!anchor || !container.contains(anchor)) {
        setPill(null)
        return
      }

      const rect = selection.getRangeAt(0).getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        setPill(null)
        return
      }

      setPill({
        top: Math.max(8, rect.top - 38),
        left: Math.max(8, rect.left + rect.width / 2),
        text
      })
    }

    // `selectionchange` fires mid-drag, so settle on the next tick.
    const onSelectionChange = (): void => {
      window.setTimeout(update, 0)
    }
    const onScroll = (): void => setPill(null)

    document.addEventListener('selectionchange', onSelectionChange)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [container, active])

  if (!pill) return null

  return (
    <button
      type="button"
      className="fixed z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11.5px] font-medium shadow-e2 transition-colors hover:border-accent-border"
      style={{ top: pill.top, left: pill.left, background: 'var(--bg-elevated)' }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setDraft(`${quoteSelection(pill.text)}`)
        setOpen(true)
        setPill(null)
        window.getSelection()?.removeAllRanges()
      }}
    >
      <MessageCircleQuestion size={13} style={{ color: 'var(--accent)' }} />
      Ask teacher
    </button>
  )
}
