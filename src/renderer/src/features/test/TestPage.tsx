import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  History,
  Info,
  RotateCcw,
  Send
} from 'lucide-react'
import type { AnswerValue, TestAttempt, TestDocument } from '@shared/types'
import { findCoursePack, useContent } from '@/stores/content'
import { attemptsFor, useProgress } from '@/stores/progress'
import { useUi } from '@/stores/ui'
import { CourseSidebar } from '@/features/lesson/CourseSidebar'
import { QuestionPrompt, QuestionView } from './QuestionView'
import { gradeTest, isAnswered, maxPoints, TYPE_LABEL, type GradedTest } from './grading'
import { cn, formatDuration, seededShuffle } from '@/lib/utils'
import { ProgressBar } from '@/components/ProgressRing'

type Phase = 'intro' | 'running' | 'results'

export function TestPage(): React.JSX.Element {
  const { courseId = '', testId = '' } = useParams()
  const navigate = useNavigate()
  const index = useContent((s) => s.index)
  const pack = findCoursePack(index, courseId)
  const progress = useProgress((s) => s.state)
  const recordAttempt = useProgress((s) => s.recordAttempt)
  const toast = useUi((s) => s.toast)

  const [test, setTest] = useState<TestDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [seed, setSeed] = useState(() => Date.now().toString(36))
  const [answers, setAnswers] = useState<Record<string, AnswerValue | undefined>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [current, setCurrent] = useState(0)
  const [graded, setGraded] = useState<GradedTest | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const history = attemptsFor(progress, courseId, testId)

  useEffect(() => {
    let cancelled = false
    setTest(null)
    setError(null)
    setPhase('intro')
    void window.desklearner.content
      .test(courseId, testId)
      .then((next) => {
        if (!cancelled) setTest(next)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [courseId, testId])

  const questions = useMemo(() => {
    if (!test) return []
    return test.shuffle ? seededShuffle(test.questions, seed) : test.questions
  }, [test, seed])

  /* ------------------------------------------------------------- timer */

  useEffect(() => {
    if (phase !== 'running') return
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [phase])

  const limitSeconds = (test?.timeLimitMinutes ?? 0) * 60
  const remaining = limitSeconds ? Math.max(0, limitSeconds - elapsed) : null

  useEffect(() => {
    if (phase === 'running' && remaining === 0 && limitSeconds > 0) {
      submit(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase])

  /* ------------------------------------------------------------ actions */

  const start = (): void => {
    setSeed(Date.now().toString(36))
    setAnswers({})
    setFlagged(new Set())
    setCurrent(0)
    setGraded(null)
    setElapsed(0)
    startedAt.current = new Date().toISOString()
    setPhase('running')
  }

  const submit = (auto = false): void => {
    if (!test) return
    const result = gradeTest(test, answers)
    const finishedAt = new Date().toISOString()
    const attempt: TestAttempt = {
      id: `${testId}-${Date.now()}`,
      courseId,
      testId,
      startedAt: startedAt.current || finishedAt,
      finishedAt,
      durationSeconds: elapsed,
      score: result.score,
      maxScore: result.maxScore,
      percent: result.percent,
      passed: result.passed,
      results: result.results
    }
    recordAttempt(attempt)
    setGraded(result)
    setPhase('results')
    scrollRef.current?.scrollTo({ top: 0 })
    if (auto) toast('Time is up — your answers were submitted.', 'info')
    else toast(result.passed ? `Passed with ${Math.round(result.percent)}%` : `Scored ${Math.round(result.percent)}% — keep going`, result.passed ? 'success' : 'info')
  }

  const setAnswer = (id: string, value: AnswerValue): void =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  const toggleFlag = (id: string): void =>
    setFlagged((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  /* ------------------------------------------------------------ render */

  if (!pack) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-subtle">
        Course not found. <Link to="/library" className="ml-2 underline">Library</Link>
      </div>
    )
  }

  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length

  return (
    <div className="flex h-full min-h-0">
      <CourseSidebar pack={pack} activeTestId={testId} />

      <div ref={scrollRef} className="scroll-area min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-8 py-8">
          {error && (
            <div
              className="rounded-lg border px-4 py-3 text-[13px]"
              style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)' }}
            >
              Could not load this test: {error}
            </div>
          )}

          {!test && !error && <div className="text-sm text-ink-subtle">Loading test…</div>}

          {test && phase === 'intro' && (
            <TestIntro
              test={test}
              courseId={courseId}
              historyCount={history.length}
              best={history.reduce<number | null>(
                (b, a) => (b === null || a.percent > b ? a.percent : b),
                null
              )}
              onStart={start}
            />
          )}

          {test && phase === 'running' && (
            <>
              <header className="mb-5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[18px] font-semibold">{test.title}</h1>
                  <div className="mt-1.5">
                    <ProgressBar value={answeredCount / questions.length} />
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-subtle">
                    {answeredCount} of {questions.length} answered
                  </div>
                </div>
                {remaining !== null && (
                  <div
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium tabular-nums"
                    style={{
                      borderColor: remaining < 60 ? 'var(--danger)' : 'var(--border)',
                      color: remaining < 60 ? 'var(--danger)' : undefined
                    }}
                  >
                    <Clock size={14} />
                    {formatDuration(remaining)}
                  </div>
                )}
              </header>

              <QuestionGrid
                total={questions.length}
                current={current}
                answered={questions.map((q) => isAnswered(q, answers[q.id]))}
                flagged={questions.map((q) => flagged.has(q.id))}
                onPick={setCurrent}
              />

              {questions[current] && (
                <QuestionCard
                  index={current}
                  total={questions.length}
                  question={questions[current]}
                  value={answers[questions[current].id]}
                  onChange={(v) => setAnswer(questions[current].id, v)}
                  flagged={flagged.has(questions[current].id)}
                  onToggleFlag={() => toggleFlag(questions[current].id)}
                  seed={seed}
                />
              )}

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  className="btn"
                  disabled={current === 0}
                  onClick={() => setCurrent((c) => c - 1)}
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                {current === questions.length - 1 ? (
                  <button className="btn btn-primary" onClick={() => submit()}>
                    <Send size={14} /> Submit test
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => setCurrent((c) => c + 1)}>
                    Next <ChevronRight size={14} />
                  </button>
                )}
              </div>

              {answeredCount === questions.length && current !== questions.length - 1 && (
                <div className="mt-3 text-center">
                  <button className="btn" onClick={() => submit()}>
                    <Send size={14} /> Everything answered — submit now
                  </button>
                </div>
              )}
            </>
          )}

          {test && phase === 'results' && graded && (
            <TestResults
              test={test}
              questions={questions}
              answers={answers}
              graded={graded}
              elapsed={elapsed}
              seed={seed}
              onRetake={start}
              onBack={() => navigate(`/course/${courseId}`)}
              courseId={courseId}
              testId={testId}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- intro */

function TestIntro({
  test,
  courseId,
  historyCount,
  best,
  onStart
}: {
  test: TestDocument
  courseId: string
  historyCount: number
  best: number | null
  onStart: () => void
}): React.JSX.Element {
  const counts = test.questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.type] = (acc[q.type] ?? 0) + 1
    return acc
  }, {})
  const totalPoints = test.questions.reduce((sum, q) => sum + maxPoints(q), 0)

  return (
    <div className="card px-7 py-7">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <Award size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight">{test.title}</h1>
          {test.description && (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{test.description}</p>
          )}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Questions" value={String(test.questions.length)} />
        <Fact label="Points" value={String(totalPoints)} />
        <Fact label="Pass mark" value={`${test.passingScore}%`} />
        <Fact
          label="Time limit"
          value={test.timeLimitMinutes ? `${test.timeLimitMinutes} min` : 'None'}
        />
      </dl>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {Object.entries(counts).map(([type, count]) => (
          <span key={type} className="chip">
            {count} × {TYPE_LABEL[type as keyof typeof TYPE_LABEL]}
          </span>
        ))}
      </div>

      {best !== null && (
        <div
          className="mt-5 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[13px]"
          style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}
        >
          <Info size={15} style={{ color: 'var(--accent)' }} />
          <span>
            Best score so far: <strong>{Math.round(best)}%</strong> across {historyCount} attempt
            {historyCount === 1 ? '' : 's'}.
          </span>
          <Link
            to={`/course/${courseId}/test/${test.id}/history`}
            className="ml-auto inline-flex items-center gap-1 text-[12px] underline"
          >
            <History size={12} /> History
          </Link>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button className="btn btn-primary" onClick={onStart}>
          {historyCount ? 'Retake test' : 'Start test'}
        </button>
        <Link to={`/course/${courseId}`} className="btn">
          Back to course
        </Link>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
      <dt className="text-[10.5px] uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

/* ------------------------------------------------------------- question */

function QuestionGrid({
  total,
  current,
  answered,
  flagged,
  onPick
}: {
  total: number
  current: number
  answered: boolean[]
  flagged: boolean[]
  onPick: (i: number) => void
}): React.JSX.Element {
  return (
    <div className="mb-4 flex flex-wrap gap-1">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onPick(i)}
          title={`Question ${i + 1}`}
          className={cn(
            'relative h-6.5 w-6.5 rounded-md border text-[11px] font-medium tabular-nums transition-colors'
          )}
          style={{
            borderColor: i === current ? 'var(--accent)' : 'var(--border)',
            background: answered[i] ? 'var(--accent-soft)' : 'var(--surface)',
            color: i === current ? 'var(--accent-text)' : undefined
          }}
        >
          {i + 1}
          {flagged[i] && (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--warning)' }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

function QuestionCard({
  index,
  total,
  question,
  value,
  onChange,
  flagged,
  onToggleFlag,
  seed
}: {
  index: number
  total: number
  question: TestDocument['questions'][number]
  value: AnswerValue | undefined
  onChange: (v: AnswerValue) => void
  flagged: boolean
  onToggleFlag: () => void
  seed: string
}): React.JSX.Element {
  return (
    <div className="card px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Question {index + 1} of {total}
        </span>
        <span className="chip">{TYPE_LABEL[question.type]}</span>
        {maxPoints(question) > 1 && <span className="chip">{maxPoints(question)} pts</span>}
        <button
          className={cn('btn btn-ghost ml-auto h-6 !px-2 text-[11px]', flagged && 'text-warning')}
          onClick={onToggleFlag}
          style={flagged ? { color: 'var(--warning)' } : undefined}
        >
          <Flag size={11} fill={flagged ? 'currentColor' : 'none'} />
          {flagged ? 'Flagged' : 'Flag'}
        </button>
      </div>

      <div className="mb-4">
        <QuestionPrompt prompt={question.prompt} />
      </div>

      <QuestionView question={question} value={value} onChange={onChange} seed={seed} />
    </div>
  )
}

/* -------------------------------------------------------------- results */

function TestResults({
  test,
  questions,
  answers,
  graded,
  elapsed,
  seed,
  onRetake,
  onBack,
  courseId,
  testId
}: {
  test: TestDocument
  questions: TestDocument['questions']
  answers: Record<string, AnswerValue | undefined>
  graded: GradedTest
  elapsed: number
  seed: string
  onRetake: () => void
  onBack: () => void
  courseId: string
  testId: string
}): React.JSX.Element {
  const percent = Math.round(graded.percent)
  const byId = new Map(graded.results.map((r) => [r.questionId, r]))
  const wrong = graded.results.filter((r) => !r.correct).length

  return (
    <>
      <div
        className="card mb-6 flex flex-col items-center px-7 py-8 text-center"
        style={{
          borderColor: graded.passed ? 'var(--success)' : 'var(--warning)',
          background: graded.passed ? 'var(--success-soft)' : 'var(--warning-soft)'
        }}
      >
        <div
          className="text-[44px] font-bold leading-none tabular-nums"
          style={{ color: graded.passed ? 'var(--success)' : 'var(--warning)' }}
        >
          {percent}%
        </div>
        <div className="mt-2 text-[16px] font-semibold">
          {graded.passed ? 'Passed' : `Not passed — ${test.passingScore}% needed`}
        </div>
        <div className="mt-1 text-[13px] text-ink-muted">
          {graded.score} of {graded.maxScore} points · {wrong} question{wrong === 1 ? '' : 's'} to
          review · {formatDuration(elapsed)}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button className="btn btn-primary" onClick={onRetake}>
            <RotateCcw size={14} /> Retake
          </button>
          <Link to={`/course/${courseId}/test/${testId}/history`} className="btn">
            <History size={14} /> Attempt history
          </Link>
          <button className="btn" onClick={onBack}>
            Back to course
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-subtle">
        Review
      </h2>

      <div className="flex flex-col gap-3">
        {questions.map((question, i) => {
          const result = byId.get(question.id)
          return (
            <div key={question.id} className="card px-5 py-4">
              <div className="mb-2.5 flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: result?.correct ? 'var(--success)' : 'var(--danger)',
                    color: 'var(--surface)'
                  }}
                >
                  {result?.correct ? '✓' : '✕'}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Question {i + 1}
                </span>
                <span className="chip">{TYPE_LABEL[question.type]}</span>
              </div>

              <div className="mb-3">
                <QuestionPrompt prompt={question.prompt} />
              </div>

              <QuestionView
                question={question}
                value={answers[question.id]}
                onChange={() => undefined}
                review
                correct={result?.correct}
                seed={seed}
              />

              {question.explanation && (
                <div
                  className="mt-3 rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <span className="font-semibold">Why: </span>
                  {question.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
