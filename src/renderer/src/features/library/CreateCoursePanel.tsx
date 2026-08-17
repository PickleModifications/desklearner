import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Check,
  FileQuestion,
  KeyRound,
  Loader2,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  X
} from 'lucide-react'
import type { CourseDifficulty } from '@shared/types'
import { Modal } from '@/components/Modal'
import { ProgressBar } from '@/components/ProgressRing'
import { useCourseGen } from '@/stores/courseGen'
import { useTeacher } from '@/stores/teacher'
import { useUi } from '@/stores/ui'
import { cn } from '@/lib/utils'

const DIFFICULTIES: Array<{ value: CourseDifficulty; label: string; hint: string }> = [
  { value: 'beginner', label: 'Beginner', hint: 'Starts from nothing' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Assumes the basics' },
  { value: 'advanced', label: 'Advanced', hint: 'Goes deep, fast' }
]

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium">{label}</span>
      {hint && <span className="ml-1.5 text-[11.5px] text-ink-subtle">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <Field label={label}>
      <input
        type="number"
        className="input"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next))))
        }}
      />
    </Field>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-[12.5px] font-medium">{label}</span>
        <span className="block text-[11.5px] text-ink-subtle">{description}</span>
      </span>
    </label>
  )
}

/** Shown instead of the form when the Teacher has no key — generation needs one too. */
function NoKeyState({ onClose }: { onClose: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
      >
        <KeyRound size={19} />
      </span>
      <div>
        <p className="text-[13px] font-semibold">Building a course needs an API key</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-subtle">
          Courses are written by Claude using your own Anthropic API key. The key stays encrypted on
          this machine, and the finished course is stored offline like any other.
        </p>
      </div>
      <button
        className="btn btn-primary"
        onClick={() => {
          onClose()
          navigate('/settings#teacher')
        }}
      >
        Add your API key
      </button>
    </div>
  )
}

export function CreateCoursePanel(): React.JSX.Element | null {
  const open = useCourseGen((s) => s.open)
  const stage = useCourseGen((s) => s.stage)
  const brief = useCourseGen((s) => s.brief)
  const plan = useCourseGen((s) => s.plan)
  const progress = useCourseGen((s) => s.progress)
  const error = useCourseGen((s) => s.error)
  const courseId = useCourseGen((s) => s.courseId)

  const closePanel = useCourseGen((s) => s.closePanel)
  const setBrief = useCourseGen((s) => s.setBrief)
  const setPlan = useCourseGen((s) => s.setPlan)
  const makePlan = useCourseGen((s) => s.makePlan)
  const startBuild = useCourseGen((s) => s.build)
  const cancel = useCourseGen((s) => s.cancel)
  const backToBrief = useCourseGen((s) => s.backToBrief)
  const reset = useCourseGen((s) => s.reset)

  const configured = useTeacher((s) => s.keyStatus.configured)
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()

  if (!open) return null

  const lessonTotal = brief.chapters * brief.lessonsPerChapter
  const busy = stage === 'planning' || stage === 'building'

  function handleClose(): void {
    // Closing mid-build leaves it running; the panel picks it back up.
    closePanel()
  }

  function openCourse(): void {
    if (!courseId) return
    closePanel()
    reset()
    navigate(`/course/${courseId}`)
  }

  return (
    <Modal open={open} onClose={handleClose} labelledBy="create-course-title">
      <div className="flex max-h-[82vh] flex-col">
        <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
          >
            <Sparkles size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="create-course-title" className="text-[14px] font-semibold">
              Create a course with AI
            </h2>
            <p className="truncate text-[11.5px] text-ink-subtle">
              {stage === 'brief' && 'Describe what you want to learn'}
              {stage === 'planning' && 'Designing the outline…'}
              {stage === 'plan' && 'Review the outline before it is written'}
              {stage === 'building' && 'Writing the course — this takes a few minutes'}
              {stage === 'done' && 'Ready to read'}
            </p>
          </div>
          <button className="btn btn-ghost h-7 w-7 !px-0" onClick={handleClose} aria-label="Close">
            <X size={14} />
          </button>
        </header>

        {!configured ? (
          <NoKeyState onClose={handleClose} />
        ) : (
          <>
            <div className="scroll-area min-h-0 flex-1 px-4 py-4">
              {error && (
                <div
                  className="mb-4 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[12.5px]"
                  style={{ background: 'var(--danger-soft)', borderColor: 'var(--danger)' }}
                >
                  <TriangleAlert
                    size={15}
                    className="mt-0.5 shrink-0"
                    style={{ color: 'var(--danger)' }}
                  />
                  <span>{error}</span>
                </div>
              )}

              {(stage === 'brief' || stage === 'planning') && (
                <div className="space-y-4">
                  <Field label="What should the course teach?">
                    <textarea
                      className="input min-h-[72px] resize-y"
                      autoFocus
                      placeholder="e.g. PostgreSQL query performance — indexes, EXPLAIN plans, and fixing slow queries in production"
                      value={brief.topic}
                      disabled={busy}
                      onChange={(e) => setBrief({ topic: e.target.value })}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Who is it for?" hint="optional">
                      <input
                        className="input"
                        placeholder="A backend dev who writes SQL daily"
                        value={brief.audience ?? ''}
                        disabled={busy}
                        onChange={(e) => setBrief({ audience: e.target.value })}
                      />
                    </Field>
                    <Field label="What should they be able to do?" hint="optional">
                      <input
                        className="input"
                        placeholder="Diagnose and fix a slow query alone"
                        value={brief.goals ?? ''}
                        disabled={busy}
                        onChange={(e) => setBrief({ goals: e.target.value })}
                      />
                    </Field>
                  </div>

                  <Field label="Starting level">
                    <div className="grid grid-cols-3 gap-2">
                      {DIFFICULTIES.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          disabled={busy}
                          className={cn(
                            'rounded-lg border px-2.5 py-2 text-left transition-colors',
                            brief.difficulty === option.value
                              ? 'border-accent-border'
                              : 'border-line hover:border-accent-border'
                          )}
                          style={{
                            background:
                              brief.difficulty === option.value
                                ? 'var(--accent-soft)'
                                : 'var(--surface)'
                          }}
                          onClick={() => setBrief({ difficulty: option.value })}
                        >
                          <span className="block text-[12.5px] font-medium">{option.label}</span>
                          <span className="block text-[11px] text-ink-subtle">{option.hint}</span>
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <NumberField
                      label="Chapters"
                      value={brief.chapters}
                      min={1}
                      max={10}
                      onChange={(chapters) => setBrief({ chapters })}
                    />
                    <NumberField
                      label="Lessons per chapter"
                      value={brief.lessonsPerChapter}
                      min={1}
                      max={10}
                      onChange={(lessonsPerChapter) => setBrief({ lessonsPerChapter })}
                    />
                    <NumberField
                      label="Minutes per lesson"
                      value={brief.minutesPerLesson}
                      min={15}
                      max={180}
                      step={5}
                      onChange={(minutesPerLesson) => setBrief({ minutesPerLesson })}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Toggle
                      label="A test at the end of each chapter"
                      description="Ten questions, graded and repeatable."
                      checked={brief.includeTests}
                      onChange={(includeTests) => setBrief({ includeTests })}
                    />
                    <Toggle
                      label="A final exam"
                      description="Twenty questions across the whole course."
                      checked={brief.includeFinalExam}
                      onChange={(includeFinalExam) => setBrief({ includeFinalExam })}
                    />
                  </div>

                  <p className="text-[11.5px] text-ink-subtle">
                    {lessonTotal} lessons, roughly{' '}
                    {Math.round(((lessonTotal * brief.minutesPerLesson) / 60) * 10) / 10} hours of
                    work. Everything is written with your API key and stored offline.
                  </p>
                </div>
              )}

              {stage === 'plan' && plan && (
                <div className="space-y-4">
                  <Field label="Course title">
                    <input
                      className="input"
                      value={plan.title}
                      onChange={(e) => setPlan({ ...plan, title: e.target.value })}
                    />
                  </Field>
                  <Field label="Subtitle">
                    <input
                      className="input"
                      value={plan.subtitle ?? ''}
                      onChange={(e) => setPlan({ ...plan, subtitle: e.target.value })}
                    />
                  </Field>

                  <div className="flex items-center gap-3 text-[11.5px] text-ink-subtle">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen size={12} />
                      {plan.chapters.reduce((n, c) => n + c.lessons.length, 0)} lessons
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileQuestion size={12} />
                      {(brief.includeTests ? plan.chapters.length : 0) +
                        (brief.includeFinalExam ? 1 : 0)}{' '}
                      tests
                    </span>
                  </div>

                  <div className="space-y-3">
                    {plan.chapters.map((chapter, index) => (
                      <div key={chapter.id} className="card p-3">
                        <div className="text-[13px] font-semibold">
                          {index + 1}. {chapter.title}
                        </div>
                        {chapter.summary && (
                          <p className="mt-1 text-[12px] text-ink-muted">{chapter.summary}</p>
                        )}
                        <ul className="mt-2 space-y-1">
                          {chapter.lessons.map((lesson) => (
                            <li key={lesson.id} className="text-[12.5px] text-ink-muted">
                              <span className="text-ink">{lesson.title}</span>
                              {lesson.summary && (
                                <span className="text-ink-subtle"> — {lesson.summary}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stage === 'building' && (
                <div className="space-y-4 py-6">
                  <div className="flex items-center gap-2.5">
                    <Loader2
                      size={16}
                      className="animate-spin"
                      style={{ color: 'var(--accent)' }}
                    />
                    <span className="text-[13px] font-medium">
                      {progress?.label ?? 'Starting…'}
                    </span>
                  </div>
                  <ProgressBar
                    value={progress && progress.total ? progress.done / progress.total : 0}
                  />
                  <p className="text-[12px] text-ink-subtle">
                    {progress ? `${progress.done} of ${progress.total} written.` : ''} You can close
                    this and keep reading — the build carries on, and the course appears in your
                    library when it is finished.
                  </p>
                </div>
              )}

              {stage === 'done' && (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full"
                    style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
                  >
                    <Check size={20} />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold">{plan?.title} is ready</p>
                    <p className="mt-1 text-[12.5px] text-ink-subtle">
                      It is in your library now, and works offline like every other course.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
              {stage === 'brief' || stage === 'planning' ? (
                <>
                  <button className="btn" onClick={handleClose} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !brief.topic.trim()}
                    onClick={() => void makePlan()}
                  >
                    {stage === 'planning' ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Designing…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> Design the outline
                      </>
                    )}
                  </button>
                </>
              ) : stage === 'plan' ? (
                <>
                  <button className="btn" onClick={backToBrief}>
                    Edit the brief
                  </button>
                  <button className="btn" onClick={() => void makePlan()}>
                    <RefreshCw size={14} /> Try another outline
                  </button>
                  <button className="btn btn-primary" onClick={() => void startBuild()}>
                    <Sparkles size={14} /> Build the course
                  </button>
                </>
              ) : stage === 'building' ? (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      cancel()
                      toast('Cancelling the build…')
                    }}
                  >
                    Cancel build
                  </button>
                  <button className="btn" onClick={handleClose}>
                    Keep it running
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      reset()
                      closePanel()
                    }}
                  >
                    Done
                  </button>
                  <button className="btn btn-primary" onClick={openCourse}>
                    Open the course
                  </button>
                </>
              )}
            </footer>
          </>
        )}
      </div>
    </Modal>
  )
}
