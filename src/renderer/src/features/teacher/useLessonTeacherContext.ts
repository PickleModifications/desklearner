import { useEffect, useMemo, useRef } from 'react'
import type { CoursePack, LessonDocument } from '@shared/types'
import { useProgress } from '@/stores/progress'
import { threadKeyForLesson, useTeacher } from '@/stores/teacher'
import type { TocEntry } from '../lesson/TableOfContents'
import { courseOutline, lessonContext } from './prompts'

/**
 * Publishes the lesson the learner is reading — plus roughly where they are in
 * it — to the Teacher store, so the panel always has current context without
 * the page having to know anything about the chat.
 */
export function useLessonTeacherContext({
  pack,
  doc,
  chapterTitle,
  lessonTitle,
  scrollEl,
  headings
}: {
  pack: CoursePack | undefined
  doc: LessonDocument | null
  chapterTitle: string
  lessonTitle: string
  scrollEl: HTMLElement | null
  headings: TocEntry[]
}): void {
  const openFor = useTeacher((s) => s.openFor)
  const setContext = useTeacher((s) => s.setContext)
  const progress = useProgress((s) => s.state)

  const courseTitle = pack?.manifest.title ?? ''

  // `setScroll` replaces the whole ProgressState on every scroll frame, so
  // memoising on `progress` itself would rebuild the outline continuously and
  // re-fire every effect below. Key on what the outline actually shows instead,
  // so it is rebuilt only when a lesson is completed or a test is scored.
  const outlineSignature = useMemo(() => {
    if (!pack) return ''
    const course = progress.courses[pack.manifest.id]
    const completed = Object.entries(course?.lessons ?? {})
      .filter(([, lesson]) => lesson.status === 'complete')
      .map(([key]) => key)
      .sort()
      .join(',')
    const scores = (course?.attempts ?? [])
      .map((a) => `${a.testId}:${Math.round(a.percent)}`)
      .sort()
      .join(',')
    return `${completed}|${scores}`
  }, [pack, progress])

  const outline = useMemo(
    () =>
      pack && doc
        ? courseOutline(pack, progress, { chapterId: doc.chapterId, lessonId: doc.lessonId })
        : undefined,
    // `progress` is read inside but deliberately not a dependency — the
    // signature is what determines whether the outline can have changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pack, doc, outlineSignature]
  )

  // Position updates are frequent; keep them out of React state and just push
  // the latest values into the store on a rAF-throttled scroll handler.
  const positionRef = useRef<{ currentHeading?: string; scrollPercent?: number }>({})

  useEffect(() => {
    if (!doc) {
      setContext(null)
      return
    }

    openFor(threadKeyForLesson(doc.courseId, doc.chapterId, doc.lessonId), lessonTitle)
    setContext(lessonContext(doc, courseTitle, chapterTitle, outline, positionRef.current))
  }, [doc, courseTitle, chapterTitle, lessonTitle, outline, openFor, setContext])

  useEffect(() => {
    if (!scrollEl || !doc) return

    let frame = 0
    const update = (): void => {
      const max = scrollEl.scrollHeight - scrollEl.clientHeight
      const scrollPercent = max > 0 ? scrollEl.scrollTop / max : 0

      // The heading the learner is under: the last one above the top third of
      // the viewport.
      const cutoff = scrollEl.getBoundingClientRect().top + scrollEl.clientHeight / 3
      let currentHeading: string | undefined
      for (const heading of headings) {
        const el = document.getElementById(heading.id)
        if (el && el.getBoundingClientRect().top <= cutoff) currentHeading = heading.text
        else break
      }

      positionRef.current = { currentHeading, scrollPercent }
      setContext(lessonContext(doc, courseTitle, chapterTitle, outline, positionRef.current))
    }

    const onScroll = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      scrollEl.removeEventListener('scroll', onScroll)
    }
  }, [scrollEl, doc, headings, courseTitle, chapterTitle, outline, setContext])
}
