import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { EmptyState, Page, PageHeader } from '@/components/Page'
import { findCoursePack, useContent } from '@/stores/content'
import { attemptsFor, useProgress } from '@/stores/progress'
import { formatDateTime, formatDuration } from '@/lib/utils'

export function TestHistoryPage(): React.JSX.Element {
  const { courseId = '', testId = '' } = useParams()
  const index = useContent((s) => s.index)
  const progress = useProgress((s) => s.state)
  const pack = findCoursePack(index, courseId)
  const attempts = attemptsFor(progress, courseId, testId)

  const title =
    pack?.manifest.chapters.find((c) => c.test?.id === testId)?.test?.title ??
    (pack?.manifest.finalExam?.id === testId ? pack.manifest.finalExam.title : testId)

  const best = attempts.reduce<number>((b, a) => Math.max(b, a.percent), 0)
  const average = attempts.length
    ? attempts.reduce((sum, a) => sum + a.percent, 0) / attempts.length
    : 0

  return (
    <Page>
      <PageHeader
        title={title}
        subtitle="Attempt history"
        actions={
          <Link to={`/course/${courseId}/test/${testId}`} className="btn btn-primary">
            Take again
          </Link>
        }
      />

      {attempts.length === 0 ? (
        <EmptyState
          title="No attempts yet"
          description="Take the test and your scores will be recorded here."
          action={
            <Link to={`/course/${courseId}/test/${testId}`} className="btn btn-primary">
              Start the test
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <Stat label="Attempts" value={String(attempts.length)} />
            <Stat label="Best" value={`${Math.round(best)}%`} />
            <Stat label="Average" value={`${Math.round(average)}%`} />
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th className="px-4 py-2.5 text-left font-semibold">When</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Score</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Correct</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Time</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => {
                  const right = attempt.results.filter((r) => r.correct).length
                  return (
                    <tr key={attempt.id} className="border-t border-line">
                      <td className="px-4 py-2.5">{formatDateTime(attempt.finishedAt)}</td>
                      <td className="px-4 py-2.5 font-medium tabular-nums">
                        {Math.round(attempt.percent)}%
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-ink-muted">
                        {right}/{attempt.results.length}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-ink-muted">
                        {formatDuration(attempt.durationSeconds)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-flex items-center gap-1.5 font-medium"
                          style={{ color: attempt.passed ? 'var(--success)' : 'var(--danger)' }}
                        >
                          {attempt.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          {attempt.passed ? 'Passed' : 'Not passed'}
                        </span>
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

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="card px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-wide text-ink-subtle">{label}</div>
      <div className="mt-0.5 text-[20px] font-semibold tabular-nums">{value}</div>
    </div>
  )
}
