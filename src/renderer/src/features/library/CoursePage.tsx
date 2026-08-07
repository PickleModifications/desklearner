import { Link, useParams } from 'react-router-dom'
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  FileQuestion,
  Layers,
  Play
} from 'lucide-react'
import { Page, PageHeader, SectionTitle } from '@/components/Page'
import { ProgressBar, ProgressRing } from '@/components/ProgressRing'
import { findCoursePack, flattenLessons, useContent } from '@/stores/content'
import { bestAttempt, getLesson, useProgress } from '@/stores/progress'
import { chapterFraction, courseStats } from '@/lib/courseStats'
import { formatMinutes } from '@/lib/utils'
import { Markdown } from '@/markdown/Markdown'

export function CoursePage(): React.JSX.Element {
  const { courseId = '' } = useParams()
  const index = useContent((s) => s.index)
  const progress = useProgress((s) => s.state)
  const pack = findCoursePack(index, courseId)

  if (!pack) {
    return (
      <Page>
        <PageHeader title="Course not found" subtitle={courseId} />
        <Link to="/library" className="btn">
          Back to library
        </Link>
      </Page>
    )
  }

  const stats = courseStats(pack, progress)
  const flat = flattenLessons(pack)
  const resume =
    stats.lastLesson ??
    flat.find(
      (l) => getLesson(progress, courseId, l.chapterId, l.lessonId).status !== 'complete'
    ) ??
    flat[0]

  return (
    <Page wide>
      <PageHeader
        title={pack.manifest.title}
        subtitle={pack.manifest.subtitle}
        actions={
          resume && (
            <Link
              to={`/course/${courseId}/lesson/${resume.chapterId}/${resume.lessonId}`}
              className="btn btn-primary"
            >
              <Play size={14} />
              {stats.completedLessons > 0 ? 'Continue' : 'Start course'}
            </Link>
          )
        }
      />

      <div className="mb-7 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="card p-5">
          {pack.manifest.description && (
            <Markdown className="!max-w-none text-[13.5px]" style={{ ['--reader-size' as string]: '13.5px' }}>
              {pack.manifest.description}
            </Markdown>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-ink-muted">
            <Metric icon={<Layers size={13} />} label={`${pack.manifest.chapters.length} chapters`} />
            <Metric icon={<BookOpen size={13} />} label={`${stats.totalLessons} lessons`} />
            <Metric icon={<FileQuestion size={13} />} label={`${stats.testsTotal} tests`} />
            {pack.manifest.estimatedHours && (
              <Metric icon={<Clock size={13} />} label={`~${pack.manifest.estimatedHours} hours`} />
            )}
            {pack.manifest.author && <Metric icon={<Award size={13} />} label={pack.manifest.author} />}
          </div>
        </div>

        <div className="card flex items-center gap-5 px-6 py-5">
          <ProgressRing value={stats.fraction} size={72} stroke={6} />
          <div className="text-[12.5px]">
            <div className="font-medium">
              {stats.completedLessons} of {stats.totalLessons} lessons
            </div>
            <div className="mt-0.5 text-ink-muted">
              {stats.testsPassed}/{stats.testsTotal} tests passed
            </div>
            {stats.minutesSpent >= 1 && (
              <div className="mt-0.5 text-ink-subtle">{formatMinutes(stats.minutesSpent)} studied</div>
            )}
          </div>
        </div>
      </div>

      <SectionTitle>Curriculum</SectionTitle>
      <div className="flex flex-col gap-3">
        {pack.manifest.chapters.map((chapter, ci) => {
          const fraction = chapterFraction(pack, chapter, progress)
          const test = chapter.test
          const attempt = test ? bestAttempt(progress, courseId, test.id) : undefined

          return (
            <section key={chapter.id} className="card overflow-hidden">
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <ProgressRing value={fraction} size={34} stroke={3.5} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold">
                    <span className="text-ink-subtle">Chapter {ci + 1} · </span>
                    {chapter.title}
                  </h3>
                  {chapter.summary && (
                    <p className="mt-0.5 truncate text-[12px] text-ink-muted">{chapter.summary}</p>
                  )}
                </div>
                <span className="chip shrink-0">{chapter.lessons.length} lessons</span>
              </header>

              <ol>
                {chapter.lessons.map((lesson, li) => {
                  const entry = getLesson(progress, courseId, chapter.id, lesson.id)
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
                        className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[13px] transition-colors last:border-b-0 hover:bg-[var(--surface-2)]"
                      >
                        <Icon
                          size={15}
                          className="shrink-0"
                          style={{
                            color:
                              entry.status === 'complete'
                                ? 'var(--success)'
                                : entry.status === 'in-progress'
                                  ? 'var(--accent)'
                                  : 'var(--text-subtle)'
                          }}
                        />
                        <span className="w-8 shrink-0 tabular-nums text-[11.5px] text-ink-subtle">
                          {ci + 1}.{li + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                        {lesson.minutes && (
                          <span className="shrink-0 text-[11.5px] text-ink-subtle">
                            {lesson.minutes} min
                          </span>
                        )}
                        <ChevronRight size={14} className="shrink-0 text-ink-subtle" />
                      </Link>
                    </li>
                  )
                })}

                {test && (
                  <li>
                    <Link
                      to={`/course/${courseId}/test/${test.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--surface-2)]"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <FileQuestion
                        size={15}
                        className="shrink-0"
                        style={{ color: attempt?.passed ? 'var(--success)' : 'var(--accent)' }}
                      />
                      <span className="w-8 shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-medium">{test.title}</span>
                      {attempt && (
                        <span
                          className="shrink-0 text-[11.5px] font-medium tabular-nums"
                          style={{ color: attempt.passed ? 'var(--success)' : 'var(--warning)' }}
                        >
                          best {Math.round(attempt.percent)}%
                        </span>
                      )}
                      <ChevronRight size={14} className="shrink-0 text-ink-subtle" />
                    </Link>
                  </li>
                )}
              </ol>

              {fraction > 0 && fraction < 1 && (
                <div className="px-4 pb-3 pt-2">
                  <ProgressBar value={fraction} />
                </div>
              )}
            </section>
          )
        })}

        {pack.manifest.finalExam && <FinalExamCard courseId={courseId} />}
      </div>
    </Page>
  )
}

function FinalExamCard({ courseId }: { courseId: string }): React.JSX.Element | null {
  const index = useContent((s) => s.index)
  const progress = useProgress((s) => s.state)
  const pack = findCoursePack(index, courseId)
  const exam = pack?.manifest.finalExam
  if (!exam) return null

  const attempt = bestAttempt(progress, courseId, exam.id)
  const stats = pack ? courseStats(pack, progress) : undefined
  const ready = !stats || stats.fraction >= 0.8

  return (
    <Link
      to={`/course/${courseId}/test/${exam.id}`}
      className="card flex items-center gap-4 px-5 py-4 transition-shadow hover:shadow-e2"
      style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}
    >
      <Award size={22} style={{ color: 'var(--accent)' }} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{exam.title}</div>
        <div className="mt-0.5 text-[12px] text-ink-muted">
          {attempt
            ? `Best score ${Math.round(attempt.percent)}% — ${attempt.passed ? 'passed' : 'not yet passed'}`
            : ready
              ? 'Covers every chapter in the course.'
              : 'Available now, but best taken after you finish the chapters.'}
        </div>
      </div>
      <ChevronRight size={16} className="text-ink-subtle" />
    </Link>
  )
}

function Metric({ icon, label }: { icon: React.ReactNode; label: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {label}
    </span>
  )
}
