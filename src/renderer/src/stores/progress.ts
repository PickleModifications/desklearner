import { create } from 'zustand'
import {
  EMPTY_PROGRESS,
  type CourseProgress,
  type LessonProgress,
  type ProgressState,
  type TestAttempt
} from '@shared/types'

export const XP_PER_LESSON = 25
export const XP_PER_TEST_PASS = 120
export const XP_PER_TEST_ATTEMPT = 15

const EMPTY_LESSON: LessonProgress = { status: 'not-started', secondsSpent: 0, scroll: 0 }

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)
  return Math.round(ms / 86_400_000)
}

interface ProgressStore {
  state: ProgressState
  loaded: boolean
  load: () => Promise<void>
  reset: () => Promise<void>
  replace: (next: ProgressState) => void

  openLesson: (courseId: string, chapterId: string, lessonId: string) => void
  addTime: (courseId: string, chapterId: string, lessonId: string, seconds: number) => void
  setScroll: (courseId: string, chapterId: string, lessonId: string, scroll: number) => void
  setStatus: (
    courseId: string,
    chapterId: string,
    lessonId: string,
    status: LessonProgress['status']
  ) => void
  toggleBookmark: (courseId: string, chapterId: string, lessonId: string) => void
  setChecklistItem: (
    courseId: string,
    chapterId: string,
    lessonId: string,
    key: string,
    value: boolean
  ) => void
  setNotes: (courseId: string, chapterId: string, lessonId: string, notes: string) => void
  recordAttempt: (attempt: TestAttempt) => void
}

let flushTimer: ReturnType<typeof setTimeout> | null = null
function persist(state: ProgressState): void {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void window.desklearner.progress.set(state), 400)
}

export function lessonKey(chapterId: string, lessonId: string): string {
  return `${chapterId}/${lessonId}`
}

function emptyCourse(): CourseProgress {
  return { lessons: {}, attempts: [] }
}

/** Applies a mutation to a lesson entry, creating the course/lesson scaffolding as needed. */
function mutate(
  state: ProgressState,
  courseId: string,
  chapterId: string,
  lessonId: string,
  fn: (lesson: LessonProgress, course: CourseProgress) => void
): ProgressState {
  const next: ProgressState = {
    ...state,
    courses: { ...state.courses },
    activity: { ...state.activity }
  }
  const course: CourseProgress = {
    ...(next.courses[courseId] ?? emptyCourse()),
    lessons: { ...(next.courses[courseId]?.lessons ?? {}) },
    attempts: [...(next.courses[courseId]?.attempts ?? [])]
  }
  const key = lessonKey(chapterId, lessonId)
  const lesson: LessonProgress = { ...EMPTY_LESSON, ...course.lessons[key] }
  fn(lesson, course)
  course.lessons[key] = lesson
  next.courses[courseId] = course
  return next
}

/** Records activity for today and rolls the streak forward. */
function touchActivity(
  state: ProgressState,
  patch: Partial<Pick<import('@shared/types').ActivityDay, 'minutes' | 'lessonsCompleted' | 'testsPassed' | 'xp'>>
): ProgressState {
  const today = localDateKey()
  const day = state.activity[today] ?? {
    date: today,
    minutes: 0,
    lessonsCompleted: 0,
    testsPassed: 0,
    xp: 0
  }
  const updated = {
    ...day,
    minutes: day.minutes + (patch.minutes ?? 0),
    lessonsCompleted: day.lessonsCompleted + (patch.lessonsCompleted ?? 0),
    testsPassed: day.testsPassed + (patch.testsPassed ?? 0),
    xp: day.xp + (patch.xp ?? 0)
  }

  let streak = state.streak
  if (state.lastActiveDate !== today) {
    const gap = state.lastActiveDate ? daysBetween(state.lastActiveDate, today) : Infinity
    streak = gap === 1 ? state.streak + 1 : 1
  }

  return {
    ...state,
    activity: { ...state.activity, [today]: updated },
    xp: state.xp + (patch.xp ?? 0),
    streak,
    longestStreak: Math.max(state.longestStreak, streak),
    lastActiveDate: today
  }
}

export const useProgress = create<ProgressStore>((set, get) => {
  /**
   * Applies a new state and schedules a write.
   *
   * Refuses to do either before the initial load has resolved — otherwise a
   * component that mounts and records activity while `load()` is still in
   * flight would persist an empty state over the user's real progress.
   */
  const commit = (next: ProgressState): void => {
    if (!get().loaded) return
    set({ state: next })
    persist(next)
  }

  return {
    state: EMPTY_PROGRESS,
    loaded: false,

    load: async () => {
      const state = await window.desklearner.progress.get()
      set({ state, loaded: true })
    },

    reset: async () => {
      const state = await window.desklearner.progress.reset()
      set({ state })
    },

    replace: (next) => set({ state: next }),

    openLesson: (courseId, chapterId, lessonId) => {
      const now = new Date().toISOString()
      let next = mutate(get().state, courseId, chapterId, lessonId, (lesson, course) => {
        if (lesson.status === 'not-started') lesson.status = 'in-progress'
        lesson.lastOpenedAt = now
        course.lastLesson = lessonKey(chapterId, lessonId)
        course.lastOpenedAt = now
        course.startedAt ??= now
      })
      next = touchActivity(next, {})
      commit(next)
    },

    addTime: (courseId, chapterId, lessonId, seconds) => {
      if (seconds <= 0) return
      let next = mutate(get().state, courseId, chapterId, lessonId, (lesson) => {
        lesson.secondsSpent += seconds
      })
      next = touchActivity(next, { minutes: seconds / 60 })
      commit(next)
    },

    setScroll: (courseId, chapterId, lessonId, scroll) => {
      const current =
        get().state.courses[courseId]?.lessons[lessonKey(chapterId, lessonId)]?.scroll ?? 0
      if (Math.abs(current - scroll) < 0.01) return
      commit(
        mutate(get().state, courseId, chapterId, lessonId, (lesson) => {
          lesson.scroll = scroll
        })
      )
    },

    setStatus: (courseId, chapterId, lessonId, status) => {
      const key = lessonKey(chapterId, lessonId)
      const was = get().state.courses[courseId]?.lessons[key]?.status
      let next = mutate(get().state, courseId, chapterId, lessonId, (lesson) => {
        lesson.status = status
        lesson.completedAt = status === 'complete' ? new Date().toISOString() : undefined
      })
      if (status === 'complete' && was !== 'complete') {
        next = touchActivity(next, { lessonsCompleted: 1, xp: XP_PER_LESSON })
      }
      commit(next)
    },

    toggleBookmark: (courseId, chapterId, lessonId) => {
      commit(
        mutate(get().state, courseId, chapterId, lessonId, (lesson) => {
          lesson.bookmarked = !lesson.bookmarked
        })
      )
    },

    setChecklistItem: (courseId, chapterId, lessonId, key, value) => {
      commit(
        mutate(get().state, courseId, chapterId, lessonId, (lesson) => {
          lesson.checklist = { ...(lesson.checklist ?? {}), [key]: value }
        })
      )
    },

    setNotes: (courseId, chapterId, lessonId, notes) => {
      commit(
        mutate(get().state, courseId, chapterId, lessonId, (lesson) => {
          lesson.notes = notes
        })
      )
    },

    recordAttempt: (attempt) => {
      const state = get().state
      const course: CourseProgress = {
        ...(state.courses[attempt.courseId] ?? emptyCourse()),
        lessons: { ...(state.courses[attempt.courseId]?.lessons ?? {}) },
        attempts: [...(state.courses[attempt.courseId]?.attempts ?? []), attempt]
      }
      const alreadyPassed = course.attempts
        .slice(0, -1)
        .some((a) => a.testId === attempt.testId && a.passed)

      let next: ProgressState = {
        ...state,
        courses: { ...state.courses, [attempt.courseId]: course }
      }
      next = touchActivity(next, {
        testsPassed: attempt.passed && !alreadyPassed ? 1 : 0,
        minutes: attempt.durationSeconds / 60,
        xp:
          attempt.passed && !alreadyPassed
            ? XP_PER_TEST_PASS
            : XP_PER_TEST_ATTEMPT
      })
      commit(next)
    }
  }
})

/* ------------------------------- selectors ------------------------------- */

export function getLesson(
  state: ProgressState,
  courseId: string,
  chapterId: string,
  lessonId: string
): LessonProgress {
  return state.courses[courseId]?.lessons[lessonKey(chapterId, lessonId)] ?? EMPTY_LESSON
}

export function bestAttempt(
  state: ProgressState,
  courseId: string,
  testId: string
): TestAttempt | undefined {
  const attempts = (state.courses[courseId]?.attempts ?? []).filter((a) => a.testId === testId)
  if (!attempts.length) return undefined
  return attempts.reduce((best, a) => (a.percent > best.percent ? a : best))
}

export function attemptsFor(
  state: ProgressState,
  courseId: string,
  testId: string
): TestAttempt[] {
  return (state.courses[courseId]?.attempts ?? [])
    .filter((a) => a.testId === testId)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
}
