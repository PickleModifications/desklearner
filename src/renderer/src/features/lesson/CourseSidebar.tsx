import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Circle,
  CircleDot,
  FileQuestion
} from 'lucide-react'
import type { CoursePack } from '@shared/types'
import { bestAttempt, getLesson, useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { chapterFraction } from '@/lib/courseStats'
import { cn } from '@/lib/utils'
import { ProgressBar } from '@/components/ProgressRing'

export function CourseSidebar({
  pack,
  activeChapterId,
  activeLessonId,
  activeTestId
}: {
  pack: CoursePack
  activeChapterId?: string
  activeLessonId?: string
  activeTestId?: string
}): React.JSX.Element {
  const progress = useProgress((s) => s.state)
  const settings = useSettings((s) => s.settings)
  const navigate = useNavigate()
  const courseId = pack.manifest.id

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(pack.manifest.chapters.map((c) => [c.id, true]))
  )

  // Always reveal the chapter containing whatever is open.
  useEffect(() => {
    if (activeChapterId) setExpanded((prev) => ({ ...prev, [activeChapterId]: true }))
  }, [activeChapterId])

  const overall = useMemo(() => {
    const all = pack.manifest.chapters.flatMap((c) => c.lessons.map((l) => [c.id, l.id] as const))
    const done = all.filter(
      ([cid, lid]) => getLesson(progress, courseId, cid, lid).status === 'complete'
    ).length
    return all.length ? done / all.length : 0
  }, [pack, progress, courseId])

  if (settings.sidebarCollapsed || settings.focusMode) return <></>

  return (
    <aside
      className="flex w-72 shrink-0 flex-col border-r border-line"
      style={{ background: 'var(--bg-elevated)' }}
    >
      <div className="border-b border-line px-3 py-3">
        <button
          className="mb-2 flex items-center gap-1 text-[11.5px] text-ink-subtle hover:text-ink"
          onClick={() => navigate(`/course/${courseId}`)}
        >
          <ChevronLeft size={13} /> Course overview
        </button>
        <div className="text-[13px] font-semibold leading-snug">{pack.manifest.title}</div>
        <div className="mt-2">
          <ProgressBar value={overall} />
          <div className="mt-1 text-[11px] text-ink-subtle tabular-nums">
            {Math.round(overall * 100)}% complete
          </div>
        </div>
      </div>

      <nav className="scroll-area flex-1 px-1.5 py-2">
        {pack.manifest.chapters.map((chapter, ci) => {
          const open = expanded[chapter.id] ?? false
          const fraction = chapterFraction(pack, chapter, progress)
          const attempt = chapter.test ? bestAttempt(progress, courseId, chapter.test.id) : undefined

          return (
            <div key={chapter.id} className="mb-0.5">
              <button
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12.5px] font-semibold transition-colors hover:bg-[var(--surface-2)]"
                onClick={() => setExpanded((p) => ({ ...p, [chapter.id]: !open }))}
                aria-expanded={open}
              >
                <ChevronDown
                  size={13}
                  className="shrink-0 text-ink-subtle transition-transform"
                  style={{ transform: open ? undefined : 'rotate(-90deg)' }}
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-ink-subtle">{ci + 1}. </span>
                  {chapter.title}
                </span>
                {fraction === 1 && (
                  <CheckCircle2 size={13} className="shrink-0" style={{ color: 'var(--success)' }} />
                )}
              </button>

              {open && (
                <ul className="ml-2 border-l border-line pl-1.5">
                  {chapter.lessons.map((lesson, li) => {
                    const entry = getLesson(progress, courseId, chapter.id, lesson.id)
                    const active = activeChapterId === chapter.id && activeLessonId === lesson.id
                    const Icon =
                      entry.status === 'complete'
                        ? CheckCircle2
                        : entry.status === 'in-progress'
                          ? CircleDot
                          : Circle
                    return (
                      <li key={lesson.id}>
                        <Link
                          to={`/course/${courseId}/lesson/${chapter.id}/${lesson.id}`}
                          className={cn(
                            'flex items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-[12.5px] transition-colors',
                            active ? 'font-medium' : 'text-ink-muted hover:bg-[var(--surface-2)] hover:text-ink'
                          )}
                          style={active ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' } : undefined}
                        >
                          <Icon
                            size={12}
                            className="shrink-0"
                            style={{
                              color:
                                entry.status === 'complete'
                                  ? 'var(--success)'
                                  : active
                                    ? 'var(--accent)'
                                    : 'var(--text-subtle)'
                            }}
                          />
                          {settings.showLessonNumbers && (
                            <span className="shrink-0 tabular-nums text-[10.5px] text-ink-subtle">
                              {ci + 1}.{li + 1}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                          {entry.bookmarked && (
                            <Bookmark size={11} className="shrink-0" style={{ color: 'var(--accent)' }} />
                          )}
                        </Link>
                      </li>
                    )
                  })}

                  {chapter.test && (
                    <li>
                      <Link
                        to={`/course/${courseId}/test/${chapter.test.id}`}
                        className={cn(
                          'flex items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-[12.5px] transition-colors',
                          activeTestId === chapter.test.id
                            ? 'font-medium'
                            : 'text-ink-muted hover:bg-[var(--surface-2)] hover:text-ink'
                        )}
                        style={
                          activeTestId === chapter.test.id
                            ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' }
                            : undefined
                        }
                      >
                        <FileQuestion
                          size={12}
                          className="shrink-0"
                          style={{ color: attempt?.passed ? 'var(--success)' : 'var(--text-subtle)' }}
                        />
                        <span className="min-w-0 flex-1 truncate">{chapter.test.title}</span>
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )
        })}

        {pack.manifest.finalExam && (
          <Link
            to={`/course/${courseId}/test/${pack.manifest.finalExam.id}`}
            className="mt-2 flex items-center gap-2 rounded-md px-2 py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={
              activeTestId === pack.manifest.finalExam.id
                ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' }
                : undefined
            }
          >
            <FileQuestion size={13} style={{ color: 'var(--accent)' }} />
            {pack.manifest.finalExam.title}
          </Link>
        )}
      </nav>
    </aside>
  )
}
