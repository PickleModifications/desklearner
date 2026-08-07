import { Link } from 'react-router-dom'
import { BookOpen, Flame, Library, Play, Sparkles, Target, Trophy } from 'lucide-react'
import { EmptyState, Page, SectionTitle } from '@/components/Page'
import { ProgressBar, ProgressRing } from '@/components/ProgressRing'
import { flattenLessons, useContent } from '@/stores/content'
import { getLesson, localDateKey, useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { courseStats } from '@/lib/courseStats'
import { formatMinutes } from '@/lib/utils'

export function HomePage(): React.JSX.Element {
  const index = useContent((s) => s.index)
  const progress = useProgress((s) => s.state)
  const settings = useSettings((s) => s.settings)

  const today = progress.activity[localDateKey()]
  const goal = settings.dailyGoalMinutes
  const todayMinutes = today?.minutes ?? 0

  const started = index.courses
    .map((pack) => ({ pack, stats: courseStats(pack, progress) }))
    .filter((c) => c.stats.completedLessons > 0 || c.stats.inProgressLessons > 0)
    .sort(
      (a, b) =>
        (progress.courses[b.pack.manifest.id]?.lastOpenedAt ?? '').localeCompare(
          progress.courses[a.pack.manifest.id]?.lastOpenedAt ?? ''
        )
    )

  const primary = started[0] ?? (index.courses[0] ? { pack: index.courses[0], stats: courseStats(index.courses[0], progress) } : null)

  const resume = (() => {
    if (!primary) return null
    const flat = flattenLessons(primary.pack)
    const last = primary.stats.lastLesson
    if (last) {
      const at = flat.findIndex((l) => l.chapterId === last.chapterId && l.lessonId === last.lessonId)
      if (at >= 0) {
        const entry = getLesson(progress, primary.pack.manifest.id, last.chapterId, last.lessonId)
        // If the last lesson is finished, point at the next unfinished one.
        if (entry.status === 'complete') {
          return flat.slice(at + 1).find(
            (l) => getLesson(progress, primary.pack.manifest.id, l.chapterId, l.lessonId).status !== 'complete'
          ) ?? flat[at]
        }
        return flat[at]
      }
    }
    return flat.find(
      (l) => getLesson(progress, primary.pack.manifest.id, l.chapterId, l.lessonId).status !== 'complete'
    ) ?? flat[0]
  })()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <Page wide>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {todayMinutes >= goal
            ? `Daily goal met — ${formatMinutes(todayMinutes)} studied today.`
            : todayMinutes > 0
              ? `${formatMinutes(todayMinutes)} today. ${formatMinutes(goal - todayMinutes)} to hit your goal.`
              : 'Nothing studied yet today. A short session counts.'}
        </p>
      </div>

      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Flame size={16} />}
          label="Current streak"
          value={`${progress.streak} day${progress.streak === 1 ? '' : 's'}`}
          hint={progress.longestStreak > progress.streak ? `Best: ${progress.longestStreak}` : undefined}
        />
        <StatCard icon={<Sparkles size={16} />} label="Total XP" value={progress.xp.toLocaleString()} />
        <StatCard
          icon={<Trophy size={16} />}
          label="Lessons complete"
          value={String(
            index.courses.reduce((sum, p) => sum + courseStats(p, progress).completedLessons, 0)
          )}
        />
        <div className="card flex items-center gap-4 px-4 py-3.5">
          <ProgressRing value={goal ? Math.min(1, todayMinutes / goal) : 0} size={44} stroke={4.5} />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-ink-subtle">Daily goal</div>
            <div className="truncate text-[14px] font-semibold">
              {Math.round(todayMinutes)}/{goal} min
            </div>
          </div>
        </div>
      </div>

      {primary && resume ? (
        <>
          <SectionTitle>Pick up where you left off</SectionTitle>
          <Link
            to={`/course/${primary.pack.manifest.id}/lesson/${resume.chapterId}/${resume.lessonId}`}
            className="card mb-7 block p-5 transition-shadow hover:shadow-e2"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <Play size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] uppercase tracking-wide text-ink-subtle">
                  {primary.pack.manifest.title} · {resume.chapterTitle}
                </div>
                <div className="mt-0.5 text-[16px] font-semibold">{resume.lessonTitle}</div>
                <div className="mt-3">
                  <ProgressBar value={primary.stats.fraction} />
                  <div className="mt-1.5 flex justify-between text-[11.5px] text-ink-subtle">
                    <span>
                      Lesson {resume.ordinal} of {primary.stats.totalLessons}
                    </span>
                    <span className="tabular-nums">
                      {Math.round(primary.stats.fraction * 100)}% complete
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </>
      ) : (
        <EmptyState
          icon={<Library size={30} />}
          title="No courses yet"
          description="Import a course pack to start learning. Everything stays on this machine."
          action={
            <Link to="/library" className="btn btn-primary">
              Open library
            </Link>
          }
        />
      )}

      {started.length > 1 && (
        <>
          <SectionTitle>In progress</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {started.slice(1).map(({ pack, stats }) => (
              <Link
                key={pack.manifest.id}
                to={`/course/${pack.manifest.id}`}
                className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-e2"
              >
                <ProgressRing value={stats.fraction} size={40} stroke={4} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{pack.manifest.title}</div>
                  <div className="text-[12px] text-ink-muted">
                    {stats.completedLessons}/{stats.totalLessons} lessons
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {index.courses.length > 0 && (
        <div className="mt-7">
          <SectionTitle>Jump to</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Link to="/library" className="btn">
              <Library size={14} /> All courses
            </Link>
            <Link to="/flashcards" className="btn">
              <BookOpen size={14} /> Review flashcards
            </Link>
            <Link to="/stats" className="btn">
              <Target size={14} /> Statistics
            </Link>
          </div>
        </div>
      )}
    </Page>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}): React.JSX.Element {
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-subtle">
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 text-[20px] font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11.5px] text-ink-subtle">{hint}</div>}
    </div>
  )
}
