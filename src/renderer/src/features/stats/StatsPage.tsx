import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Award, Flame, Sparkles, Timer, TrendingUp } from 'lucide-react'
import { Page, PageHeader, SectionTitle } from '@/components/Page'
import { ProgressBar, ProgressRing } from '@/components/ProgressRing'
import { useContent } from '@/stores/content'
import { localDateKey, useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { courseStats } from '@/lib/courseStats'
import { formatDateTime, formatMinutes } from '@/lib/utils'

const WEEKS = 26

export function StatsPage(): React.JSX.Element {
  const index = useContent((s) => s.index)
  const progress = useProgress((s) => s.state)
  const goal = useSettings((s) => s.settings.dailyGoalMinutes)

  const totals = useMemo(() => {
    const days = Object.values(progress.activity)
    return {
      minutes: days.reduce((sum, d) => sum + d.minutes, 0),
      lessons: days.reduce((sum, d) => sum + d.lessonsCompleted, 0),
      tests: days.reduce((sum, d) => sum + d.testsPassed, 0),
      activeDays: days.filter((d) => d.minutes > 0.5).length
    }
  }, [progress.activity])

  const grid = useMemo(() => buildHeatmap(progress.activity, goal), [progress.activity, goal])

  const attempts = useMemo(
    () =>
      Object.values(progress.courses)
        .flatMap((c) => c.attempts)
        .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
        .slice(0, 8),
    [progress.courses]
  )

  return (
    <Page wide>
      <PageHeader title="Statistics" subtitle="All data is stored locally on this machine" />

      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Flame size={16} />} label="Current streak" value={`${progress.streak} d`} hint={`Best ${progress.longestStreak} d`} />
        <Stat icon={<Sparkles size={16} />} label="Total XP" value={progress.xp.toLocaleString()} />
        <Stat icon={<Timer size={16} />} label="Time studied" value={formatMinutes(totals.minutes)} hint={`${totals.activeDays} active days`} />
        <Stat icon={<Award size={16} />} label="Tests passed" value={String(totals.tests)} hint={`${totals.lessons} lessons complete`} />
      </div>

      <SectionTitle>Activity</SectionTitle>
      <div className="card mb-7 overflow-x-auto p-5">
        <div className="flex gap-1">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => (
                <div
                  key={day.date}
                  title={
                    day.inRange
                      ? `${day.date} — ${Math.round(day.minutes)} min`
                      : undefined
                  }
                  className="h-3 w-3 rounded-[3px]"
                  style={{
                    background: !day.inRange
                      ? 'transparent'
                      : day.level === 0
                        ? 'var(--surface-3)'
                        : `color-mix(in oklab, var(--accent) ${25 + day.level * 25}%, var(--surface-2))`
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-subtle">
          <span>Less</span>
          {[0, 1, 2, 3].map((level) => (
            <span
              key={level}
              className="h-3 w-3 rounded-[3px]"
              style={{
                background:
                  level === 0
                    ? 'var(--surface-3)'
                    : `color-mix(in oklab, var(--accent) ${25 + level * 25}%, var(--surface-2))`
              }}
            />
          ))}
          <span>More</span>
          <span className="ml-auto">Last {WEEKS} weeks · goal {goal} min/day</span>
        </div>
      </div>

      <SectionTitle>Course progress</SectionTitle>
      <div className="mb-7 grid gap-3 sm:grid-cols-2">
        {index.courses.map((pack) => {
          const stats = courseStats(pack, progress)
          return (
            <Link
              key={pack.manifest.id}
              to={`/course/${pack.manifest.id}`}
              className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-e2"
            >
              <ProgressRing value={stats.fraction} size={48} stroke={5} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{pack.manifest.title}</div>
                <div className="mt-1 text-[12px] text-ink-muted">
                  {stats.completedLessons}/{stats.totalLessons} lessons ·{' '}
                  {stats.testsPassed}/{stats.testsTotal} tests
                </div>
                <div className="mt-2">
                  <ProgressBar value={stats.fraction} />
                </div>
                {stats.minutesSpent >= 1 && (
                  <div className="mt-1.5 text-[11px] text-ink-subtle">
                    {formatMinutes(stats.minutesSpent)} studied
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {attempts.length > 0 && (
        <>
          <SectionTitle>Recent test attempts</SectionTitle>
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th className="px-4 py-2.5 text-left font-semibold">Test</th>
                  <th className="px-4 py-2.5 text-left font-semibold">When</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => {
                  const pack = index.courses.find((c) => c.manifest.id === attempt.courseId)
                  const title =
                    pack?.manifest.chapters.find((c) => c.test?.id === attempt.testId)?.test
                      ?.title ??
                    (pack?.manifest.finalExam?.id === attempt.testId
                      ? pack.manifest.finalExam.title
                      : attempt.testId)
                  return (
                    <tr key={attempt.id} className="border-t border-line">
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/course/${attempt.courseId}/test/${attempt.testId}/history`}
                          className="hover:underline"
                        >
                          {title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">
                        {formatDateTime(attempt.finishedAt)}
                      </td>
                      <td
                        className="px-4 py-2.5 text-right font-medium tabular-nums"
                        style={{ color: attempt.passed ? 'var(--success)' : 'var(--warning)' }}
                      >
                        <TrendingUp size={12} className="mr-1 inline" />
                        {Math.round(attempt.percent)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Page>
  )
}

interface HeatCell {
  date: string
  minutes: number
  level: number
  inRange: boolean
}

/** Builds a GitHub-style contribution grid ending on the current week. */
function buildHeatmap(
  activity: Record<string, { minutes: number }>,
  goal: number
): HeatCell[][] {
  const today = new Date()
  const end = new Date(today)
  end.setDate(end.getDate() + (6 - end.getDay()))

  const weeks: HeatCell[][] = []
  for (let w = WEEKS - 1; w >= 0; w--) {
    const week: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(end)
      date.setDate(end.getDate() - w * 7 - (6 - d))
      const key = localDateKey(date)
      const minutes = activity[key]?.minutes ?? 0
      const ratio = goal > 0 ? minutes / goal : minutes / 30
      week.push({
        date: key,
        minutes,
        level: minutes <= 0.5 ? 0 : ratio >= 1 ? 3 : ratio >= 0.5 ? 2 : 1,
        inRange: date <= today
      })
    }
    weeks.push(week)
  }
  return weeks
}

function Stat({
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
