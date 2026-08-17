import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Clock,
  FileQuestion,
  FolderPlus,
  Library,
  Plus,
  Sparkles,
  TriangleAlert
} from 'lucide-react'
import { EmptyState, Page, PageHeader } from '@/components/Page'
import { ProgressBar } from '@/components/ProgressRing'
import { useContent } from '@/stores/content'
import { useCourseGen } from '@/stores/courseGen'
import { useProgress } from '@/stores/progress'
import { courseStats } from '@/lib/courseStats'
import { formatMinutes } from '@/lib/utils'

/**
 * "Add a course" is the one entry point learners look for, so both ways in
 * hang off it — generating a new one, and importing a pack from disk.
 */
function AddCourseMenu({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        className="btn btn-primary"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={14} /> Add a course
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-line shadow-e3"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <button
            role="menuitem"
            className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
            onClick={() => {
              setOpen(false)
              onCreate()
            }}
          >
            <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <span>
              <span className="block text-[12.5px] font-medium">Create with AI</span>
              <span className="block text-[11.5px] text-ink-subtle">
                Describe a topic and have a full course written for you
              </span>
            </span>
          </button>
          <Link
            role="menuitem"
            to="/settings#content"
            className="flex w-full items-start gap-2.5 border-t border-line px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
            onClick={() => setOpen(false)}
          >
            <FolderPlus size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
            <span>
              <span className="block text-[12.5px] font-medium">Import a course pack</span>
              <span className="block text-[11.5px] text-ink-subtle">
                From a folder or a .zip on this machine
              </span>
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}

export function LibraryPage(): React.JSX.Element {
  const { index, loaded } = useContent()
  const progress = useProgress((s) => s.state)
  const openCreate = useCourseGen((s) => s.openPanel)

  return (
    <Page wide>
      <PageHeader
        title="Library"
        subtitle={`${index.courses.length} course${index.courses.length === 1 ? '' : 's'} installed — everything stored on this machine`}
        actions={<AddCourseMenu onCreate={() => openCreate()} />}
      />

      {index.broken.length > 0 && (
        <div
          className="mb-6 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[13px]"
          style={{ background: 'var(--warning-soft)', borderColor: 'var(--warning)' }}
        >
          <TriangleAlert
            size={16}
            className="mt-0.5 shrink-0"
            style={{ color: 'var(--warning)' }}
          />
          <div>
            <div className="font-medium">
              {index.broken.length} course pack{index.broken.length === 1 ? '' : 's'} could not be
              loaded
            </div>
            <ul className="mt-1 space-y-0.5 text-ink-muted">
              {index.broken.map((b) => (
                <li key={b.root}>
                  <code className="text-[12px]">{b.root}</code> — {b.error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!loaded ? (
        <div className="text-sm text-ink-subtle">Loading courses…</div>
      ) : index.courses.length === 0 ? (
        <EmptyState
          icon={<Library size={30} />}
          title="No courses yet"
          description="Describe something you want to learn and have a course written for you, or import a course pack you already have."
          action={
            <div className="flex items-center gap-2">
              <button className="btn btn-primary" onClick={() => openCreate()}>
                <Sparkles size={14} /> Create with AI
              </button>
              <Link to="/settings#content" className="btn">
                Import a pack
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {index.courses.map((pack) => {
            const stats = courseStats(pack, progress)
            const accent = pack.manifest.color
            return (
              <Link
                key={pack.manifest.id}
                to={`/course/${pack.manifest.id}`}
                className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-e2"
              >
                <div
                  className="h-1.5 w-full"
                  style={{ background: accent ?? 'var(--accent)' }}
                  aria-hidden
                />
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-[15px] font-semibold leading-snug">{pack.manifest.title}</h3>
                  {pack.manifest.subtitle && (
                    <p className="mt-1 text-[12.5px] text-ink-muted">{pack.manifest.subtitle}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pack.manifest.tags?.slice(0, 4).map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex-1" />

                  <div className="mt-4 flex items-center gap-3 text-[11.5px] text-ink-subtle">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen size={12} /> {stats.totalLessons} lessons
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileQuestion size={12} /> {stats.testsTotal} tests
                    </span>
                    {stats.totalMinutes > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} /> {formatMinutes(stats.totalMinutes)}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5">
                    <ProgressBar value={stats.fraction} />
                    <div className="mt-1.5 flex justify-between text-[11px] text-ink-subtle">
                      <span>
                        {stats.completedLessons}/{stats.totalLessons} complete
                      </span>
                      <span className="tabular-nums">{Math.round(stats.fraction * 100)}%</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}

          <button
            onClick={() => openCreate()}
            className="card group flex min-h-[180px] flex-col items-center justify-center gap-2 border-dashed px-4 py-6 text-center transition-colors hover:border-accent-border"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full transition-transform group-hover:scale-105"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              <Plus size={20} />
            </span>
            <span className="text-[13.5px] font-medium">Create with AI</span>
            <span className="max-w-[16rem] text-[11.5px] text-ink-subtle">
              Turn any topic into a full course with lessons and tests
            </span>
          </button>
        </div>
      )}
    </Page>
  )
}
