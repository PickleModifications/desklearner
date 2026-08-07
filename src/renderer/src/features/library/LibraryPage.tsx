import { Link } from 'react-router-dom'
import { BookOpen, Clock, FileQuestion, FolderPlus, Library, TriangleAlert } from 'lucide-react'
import { EmptyState, Page, PageHeader } from '@/components/Page'
import { ProgressBar } from '@/components/ProgressRing'
import { useContent } from '@/stores/content'
import { useProgress } from '@/stores/progress'
import { courseStats } from '@/lib/courseStats'
import { formatMinutes } from '@/lib/utils'

export function LibraryPage(): React.JSX.Element {
  const { index, loaded } = useContent()
  const progress = useProgress((s) => s.state)

  return (
    <Page wide>
      <PageHeader
        title="Library"
        subtitle={`${index.courses.length} course${index.courses.length === 1 ? '' : 's'} installed — everything stored on this machine`}
        actions={
          <Link to="/settings#content" className="btn">
            <FolderPlus size={14} /> Add a course
          </Link>
        }
      />

      {index.broken.length > 0 && (
        <div
          className="mb-6 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[13px]"
          style={{ background: 'var(--warning-soft)', borderColor: 'var(--warning)' }}
        >
          <TriangleAlert size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
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
          title="No courses installed"
          description="Course packs are folders of markdown files. Import one from Settings → Content."
          action={
            <Link to="/settings#content" className="btn btn-primary">
              Open content settings
            </Link>
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
        </div>
      )}
    </Page>
  )
}
