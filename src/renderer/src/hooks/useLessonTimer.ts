import { useEffect, useRef } from 'react'
import { useProgress } from '@/stores/progress'

const TICK_SECONDS = 15

/**
 * Accrues reading time while the lesson is open and the window is focused,
 * flushing in coarse ticks so we aren't writing to disk every second.
 */
export function useLessonTimer(courseId: string, chapterId: string, lessonId: string): void {
  const addTime = useProgress((s) => s.addTime)
  const pending = useRef(0)

  useEffect(() => {
    pending.current = 0
    let active = document.hasFocus() && !document.hidden

    const flush = (): void => {
      if (pending.current > 0) {
        addTime(courseId, chapterId, lessonId, pending.current)
        pending.current = 0
      }
    }

    const interval = setInterval(() => {
      if (active) {
        pending.current += TICK_SECONDS
        flush()
      }
    }, TICK_SECONDS * 1000)

    const onFocus = (): void => {
      active = true
    }
    const onBlur = (): void => {
      active = false
      flush()
    }
    const onVisibility = (): void => {
      active = !document.hidden && document.hasFocus()
      if (!active) flush()
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [courseId, chapterId, lessonId, addTime])
}
