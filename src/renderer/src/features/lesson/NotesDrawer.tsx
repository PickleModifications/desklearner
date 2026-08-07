import { useEffect, useState } from 'react'
import { NotebookPen, X } from 'lucide-react'
import { useProgress } from '@/stores/progress'
import { useUi } from '@/stores/ui'
import { Markdown } from '@/markdown/Markdown'

export function NotesDrawer({
  courseId,
  chapterId,
  lessonId,
  lessonTitle,
  initialNotes
}: {
  courseId: string
  chapterId: string
  lessonId: string
  lessonTitle: string
  initialNotes: string
}): React.JSX.Element | null {
  const open = useUi((s) => s.notesOpen)
  const setOpen = useUi((s) => s.setNotesOpen)
  const setNotes = useProgress((s) => s.setNotes)
  const [draft, setDraft] = useState(initialNotes)
  const [preview, setPreview] = useState(false)

  useEffect(() => setDraft(initialNotes), [initialNotes, lessonId])

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (draft === initialNotes) return
    const timer = setTimeout(() => setNotes(courseId, chapterId, lessonId, draft), 600)
    return () => clearTimeout(timer)
  }, [draft, initialNotes, courseId, chapterId, lessonId, setNotes])

  if (!open) return null

  return (
    <div
      className="flex w-88 shrink-0 flex-col border-l border-line"
      style={{ background: 'var(--bg-elevated)' }}
    >
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <NotebookPen size={15} style={{ color: 'var(--accent)' }} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">Notes</div>
          <div className="truncate text-[11px] text-ink-subtle">{lessonTitle}</div>
        </div>
        <button
          className="btn btn-ghost h-6 !px-2 text-[11px]"
          onClick={() => setPreview(!preview)}
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
        <button className="btn btn-ghost h-7 w-7 !px-0" onClick={() => setOpen(false)} aria-label="Close notes">
          <X size={14} />
        </button>
      </header>

      {preview ? (
        <div className="scroll-area flex-1 px-4 py-3">
          {draft.trim() ? (
            <Markdown className="!max-w-none" style={{ ['--reader-size' as string]: '13px' }}>
              {draft}
            </Markdown>
          ) : (
            <p className="text-[12.5px] text-ink-subtle">Nothing written yet.</p>
          )}
        </div>
      ) : (
        <textarea
          className="flex-1 resize-none bg-transparent px-4 py-3 text-[13px] leading-relaxed outline-none"
          placeholder={'Your notes for this lesson…\n\nMarkdown works here.'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck
        />
      )}

      <footer className="border-t border-line px-3 py-1.5 text-[11px] text-ink-subtle">
        Saved automatically · {draft.trim().split(/\s+/).filter(Boolean).length} words
      </footer>
    </div>
  )
}
