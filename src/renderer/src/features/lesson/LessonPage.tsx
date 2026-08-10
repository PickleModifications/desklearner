import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Focus,
  NotebookPen,
  PanelLeft,
  Target,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type { LessonDocument } from '@shared/types'
import { findCoursePack, flattenLessons, useContent } from '@/stores/content'
import { getLesson, useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import { useLessonTimer } from '@/hooks/useLessonTimer'
import { useReaderZoom, ZOOM_MAX, ZOOM_MIN } from '@/hooks/useReaderZoom'
import { Markdown } from '@/markdown/Markdown'
import { CourseSidebar } from './CourseSidebar'
import { NotesDrawer } from './NotesDrawer'
import { TableOfContents, useHeadings } from './TableOfContents'
import { SelectionAsk } from '@/features/teacher/SelectionAsk'
import { useLessonTeacherContext } from '@/features/teacher/useLessonTeacherContext'
import { cn } from '@/lib/utils'

export function LessonPage(): React.JSX.Element {
  const { courseId = '', chapterId = '', lessonId = '' } = useParams()
  const navigate = useNavigate()
  const index = useContent((s) => s.index)
  const pack = findCoursePack(index, courseId)

  // Subscribing to the whole progress state would re-render the reader — and
  // everything under it — every time any lesson's progress is written. Only this
  // lesson's entry matters here, and its identity is stable until it changes.
  const entry = useProgress((s) => getLesson(s.state, courseId, chapterId, lessonId))
  const openLesson = useProgress((s) => s.openLesson)
  const setStatus = useProgress((s) => s.setStatus)
  const setScroll = useProgress((s) => s.setScroll)
  const toggleBookmark = useProgress((s) => s.toggleBookmark)
  const setChecklistItem = useProgress((s) => s.setChecklistItem)

  const settings = useSettings((s) => s.settings)
  const updateSettings = useSettings((s) => s.update)
  const notesOpen = useUi((s) => s.notesOpen)
  const setNotesOpen = useUi((s) => s.setNotesOpen)
  const toast = useUi((s) => s.toast)

  const [doc, setDoc] = useState<LessonDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const [articleEl, setArticleEl] = useState<HTMLElement | null>(null)
  const restored = useRef('')

  const headings = useHeadings(articleEl, doc?.markdown)

  useLessonTimer(courseId, chapterId, lessonId)
  const zoom = useReaderZoom(scrollEl)

  /* ------------------------------------------------------------- loading */

  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setError(null)
    void window.desklearner.content
      .lesson(courseId, chapterId, lessonId)
      .then((next) => {
        if (!cancelled) setDoc(next)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [courseId, chapterId, lessonId])

  useEffect(() => {
    openLesson(courseId, chapterId, lessonId)
    void updateSettings({ lastCourseId: courseId, lastLessonPath: `${chapterId}/${lessonId}` })
    // Intentionally keyed only on the lesson identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, chapterId, lessonId])

  /* ------------------------------------------- scroll restore + tracking */

  const key = `${courseId}/${chapterId}/${lessonId}`

  useEffect(() => {
    if (!scrollEl || !doc || restored.current === key) return
    restored.current = key
    const target = entry.scroll
    if (target > 0.01) {
      // Wait for async content (code blocks, diagrams) to settle before restoring.
      const timer = setTimeout(() => {
        scrollEl.scrollTop = target * (scrollEl.scrollHeight - scrollEl.clientHeight)
      }, 220)
      return () => clearTimeout(timer)
    }
    scrollEl.scrollTop = 0
    return
  }, [scrollEl, doc, key, entry.scroll])

  // Reading scroll metrics forces layout and writing the position re-renders the
  // page, so neither happens while the wheel is moving: the handler only resets
  // a timer, and the position is measured and stored once scrolling settles.
  useEffect(() => {
    if (!scrollEl) return
    let idle: ReturnType<typeof setTimeout> | undefined

    const store = (): void => {
      const max = scrollEl.scrollHeight - scrollEl.clientHeight
      // Nothing to record before the lesson has been restored, or while it is
      // still short enough to fit — writing 0 then would lose the saved position.
      if (max <= 0 || restored.current !== key) return
      setScroll(courseId, chapterId, lessonId, scrollEl.scrollTop / max)
    }

    const onScroll = (): void => {
      clearTimeout(idle)
      idle = setTimeout(store, 400)
    }

    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(idle)
      scrollEl.removeEventListener('scroll', onScroll)
      // Leaving mid-scroll still has to record where the learner got to.
      store()
    }
  }, [scrollEl, courseId, chapterId, lessonId, key, setScroll])

  /* ----------------------------------------------------------- navigation */

  const flat = pack ? flattenLessons(pack) : []
  const at = flat.findIndex((l) => l.chapterId === chapterId && l.lessonId === lessonId)
  const prev = at > 0 ? flat[at - 1] : undefined
  const next = at >= 0 && at < flat.length - 1 ? flat[at + 1] : undefined
  const chapter = pack?.manifest.chapters.find((c) => c.id === chapterId)
  const chapterTest = chapter?.test
  const isLastInChapter = chapter ? chapter.lessons.at(-1)?.id === lessonId : false

  // Keep the Teacher's context — course outline plus current position — in step
  // with what is on screen.
  useLessonTeacherContext({
    pack,
    doc,
    chapterTitle: chapter?.title ?? '',
    lessonTitle: doc?.frontmatter.title ?? lessonId,
    scrollEl,
    headings
  })

  const onTaskChange = useCallback(
    (taskKey: string, value: boolean) =>
      setChecklistItem(courseId, chapterId, lessonId, taskKey, value),
    [setChecklistItem, courseId, chapterId, lessonId]
  )

  const complete = (): void => {
    const done = entry.status === 'complete'
    setStatus(courseId, chapterId, lessonId, done ? 'in-progress' : 'complete')
    if (!done) {
      toast('Lesson complete — nice work.', 'success')
      if (isLastInChapter && chapterTest) {
        navigate(`/course/${courseId}/test/${chapterTest.id}`)
      } else if (next) {
        navigate(`/course/${courseId}/lesson/${next.chapterId}/${next.lessonId}`)
      }
    }
  }

  if (!pack) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-subtle">
        Course not found. <Link to="/library" className="ml-2 underline">Library</Link>
      </div>
    )
  }

  const fm = doc?.frontmatter
  const done = entry.status === 'complete'

  return (
    <div className="flex h-full min-h-0">
      <CourseSidebar pack={pack} activeChapterId={chapterId} activeLessonId={lessonId} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <button
            className="btn btn-ghost h-7 w-7 !px-0"
            title="Toggle sidebar (Ctrl+B)"
            aria-label="Toggle sidebar"
            onClick={() => void updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
          >
            <PanelLeft size={15} />
          </button>

          <div className="min-w-0 flex-1 truncate text-[12px] text-ink-subtle">
            <Link to={`/course/${courseId}`} className="hover:text-ink">
              {pack.manifest.title}
            </Link>
            <span className="mx-1.5">/</span>
            <span>{chapter?.title}</span>
          </div>

          {fm?.minutes && (
            <span className="hidden items-center gap-1 text-[11.5px] text-ink-subtle sm:inline-flex">
              <Clock size={12} /> {fm.minutes} min
            </span>
          )}

          <div
            className="hidden items-center rounded-md border border-line sm:inline-flex"
            title="Zoom content (Ctrl + scroll, Ctrl +/-)"
          >
            <button
              className="btn btn-ghost h-7 w-7 !rounded-r-none !px-0"
              aria-label="Zoom out"
              disabled={zoom.zoom <= ZOOM_MIN}
              onClick={zoom.zoomOut}
            >
              <ZoomOut size={14} />
            </button>
            <button
              className="btn btn-ghost h-7 !rounded-none !px-1 text-[11px] tabular-nums text-ink-subtle"
              aria-label="Reset zoom"
              onClick={zoom.reset}
            >
              {Math.round(zoom.zoom * 100)}%
            </button>
            <button
              className="btn btn-ghost h-7 w-7 !rounded-l-none !px-0"
              aria-label="Zoom in"
              disabled={zoom.zoom >= ZOOM_MAX}
              onClick={zoom.zoomIn}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <button
            className={cn('btn btn-ghost h-7 w-7 !px-0', entry.bookmarked && 'text-accent')}
            title="Bookmark"
            aria-label="Bookmark"
            onClick={() => toggleBookmark(courseId, chapterId, lessonId)}
          >
            <Bookmark size={15} fill={entry.bookmarked ? 'currentColor' : 'none'} />
          </button>
          <button
            className={cn('btn btn-ghost h-7 w-7 !px-0', notesOpen && 'text-accent')}
            title="Notes"
            aria-label="Notes"
            onClick={() => setNotesOpen(!notesOpen)}
          >
            <NotebookPen size={15} />
          </button>
          <button
            className={cn('btn btn-ghost h-7 w-7 !px-0', settings.focusMode && 'text-accent')}
            title="Focus mode"
            aria-label="Focus mode"
            onClick={() => void updateSettings({ focusMode: !settings.focusMode })}
          >
            <Focus size={15} />
          </button>

          <button
            className={cn('btn h-7 text-[12px]', done ? '' : 'btn-primary')}
            onClick={complete}
            style={done ? { color: 'var(--success)' } : undefined}
          >
            {done ? <CheckCircle2 size={13} /> : <Check size={13} />}
            {done ? 'Completed' : 'Mark complete'}
          </button>
        </header>

        <SelectionAsk container={articleEl} />

        <div className="flex min-h-0 flex-1">
          <div ref={setScrollEl} className="scroll-area min-w-0 flex-1">
            <div className="flex justify-center">
              <article
                ref={setArticleEl}
                className="min-w-0 flex-1 px-8 py-8"
                style={{
                  maxWidth: settings.contentWidth + 120,
                  zoom: zoom.zoom,
                  ['--reader-zoom' as string]: String(zoom.zoom)
                }}
              >
                {error && (
                  <div
                    className="rounded-lg border px-4 py-3 text-[13px]"
                    style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)' }}
                  >
                    Could not load this lesson: {error}
                  </div>
                )}

                {!doc && !error && <SkeletonLesson />}

                {doc && (
                  <>
                    <div className="mb-6" style={{ maxWidth: settings.contentWidth, marginInline: 'auto' }}>
                      <div className="text-[11.5px] font-medium uppercase tracking-wider text-ink-subtle">
                        Lesson {at + 1} of {flat.length}
                      </div>
                      <h1 className="mt-1.5 text-[30px] font-bold leading-tight tracking-tight">
                        {fm?.title ?? 'Lesson'}
                      </h1>
                      {fm?.summary && (
                        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{fm.summary}</p>
                      )}
                    </div>

                    {!!fm?.objectives?.length && (
                      <div
                        className="mb-7 rounded-xl border px-5 py-4"
                        style={{
                          maxWidth: settings.contentWidth,
                          marginInline: 'auto',
                          borderColor: 'var(--accent-border)',
                          background: 'var(--accent-soft)'
                        }}
                      >
                        <div
                          className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--accent-text)' }}
                        >
                          <Target size={13} /> By the end of this lesson you will be able to
                        </div>
                        <ul className="space-y-1 text-[13.5px]">
                          {fm.objectives.map((objective, i) => (
                            <li key={i} className="flex gap-2">
                              <span style={{ color: 'var(--accent)' }}>→</span>
                              <span>{objective}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Markdown
                      taskState={entry.checklist}
                      onTaskChange={onTaskChange}
                      style={{
                        ['--reader-size' as string]: `${settings.fontSize}px`,
                        ['--reader-leading' as string]: String(settings.lineHeight),
                        ['--reader-width' as string]: `${settings.contentWidth}px`,
                        fontFamily:
                          settings.readerFont === 'serif'
                            ? 'var(--font-serif)'
                            : settings.readerFont === 'mono'
                              ? 'var(--font-mono)'
                              : 'var(--font-sans)'
                      }}
                    >
                      {doc.markdown}
                    </Markdown>

                    <div style={{ maxWidth: settings.contentWidth, marginInline: 'auto' }}>
                      {!!fm?.keyTerms?.length && (
                        <section className="mt-10">
                          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-subtle">
                            Key terms
                          </h2>
                          <dl className="grid gap-2 sm:grid-cols-2">
                            {fm.keyTerms.map((term) => (
                              <div key={term.term} className="card px-3.5 py-2.5">
                                <dt className="text-[13px] font-semibold">{term.term}</dt>
                                <dd className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                                  {term.definition}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </section>
                      )}

                      {!!fm?.resources?.length && (
                        <section className="mt-8">
                          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-subtle">
                            Go deeper
                          </h2>
                          <ul className="space-y-1.5">
                            {fm.resources.map((resource) => (
                              <li key={resource.url}>
                                <button
                                  className="inline-flex items-center gap-1.5 text-[13px] hover:underline"
                                  style={{ color: 'var(--accent-text)' }}
                                  onClick={() =>
                                    void window.desklearner.system.openExternal(resource.url)
                                  }
                                >
                                  {resource.label}
                                  <ExternalLink size={11} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-5">
                        {prev ? (
                          <Link
                            to={`/course/${courseId}/lesson/${prev.chapterId}/${prev.lessonId}`}
                            className="btn min-w-0 max-w-[45%] justify-start !py-2 text-left"
                          >
                            <ArrowLeft size={14} className="shrink-0" />
                            <span className="min-w-0">
                              <span className="block text-[10.5px] uppercase tracking-wide text-ink-subtle">
                                Previous
                              </span>
                              <span className="block truncate text-[12.5px]">{prev.lessonTitle}</span>
                            </span>
                          </Link>
                        ) : (
                          <span />
                        )}

                        {isLastInChapter && chapterTest ? (
                          <Link
                            to={`/course/${courseId}/test/${chapterTest.id}`}
                            className="btn btn-primary min-w-0 max-w-[45%] justify-end !py-2 text-right"
                          >
                            <span className="min-w-0">
                              <span className="block text-[10.5px] uppercase tracking-wide opacity-75">
                                Chapter test
                              </span>
                              <span className="block truncate text-[12.5px]">{chapterTest.title}</span>
                            </span>
                            <ArrowRight size={14} className="shrink-0" />
                          </Link>
                        ) : next ? (
                          <Link
                            to={`/course/${courseId}/lesson/${next.chapterId}/${next.lessonId}`}
                            className="btn min-w-0 max-w-[45%] justify-end !py-2 text-right"
                          >
                            <span className="min-w-0">
                              <span className="block text-[10.5px] uppercase tracking-wide text-ink-subtle">
                                Next
                              </span>
                              <span className="block truncate text-[12.5px]">{next.lessonTitle}</span>
                            </span>
                            <ArrowRight size={14} className="shrink-0" />
                          </Link>
                        ) : (
                          <span />
                        )}
                      </div>
                    </div>
                  </>
                )}
              </article>

              {!settings.focusMode && <TableOfContents entries={headings} scrollRoot={scrollEl} />}
            </div>
          </div>

          <NotesDrawer
            courseId={courseId}
            chapterId={chapterId}
            lessonId={lessonId}
            lessonTitle={fm?.title ?? ''}
            initialNotes={entry.notes ?? ''}
          />
        </div>
      </div>
    </div>
  )
}

function SkeletonLesson(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[760px] animate-pulse space-y-3">
      <div className="h-8 w-2/3 rounded" style={{ background: 'var(--surface-2)' }} />
      <div className="h-4 w-full rounded" style={{ background: 'var(--surface-2)' }} />
      <div className="h-4 w-5/6 rounded" style={{ background: 'var(--surface-2)' }} />
      <div className="h-32 w-full rounded-lg" style={{ background: 'var(--surface-2)' }} />
      <div className="h-4 w-full rounded" style={{ background: 'var(--surface-2)' }} />
      <div className="h-4 w-4/6 rounded" style={{ background: 'var(--surface-2)' }} />
    </div>
  )
}
