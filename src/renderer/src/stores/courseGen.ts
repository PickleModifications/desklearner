import { create } from 'zustand'
import {
  DEFAULT_COURSE_BRIEF,
  type CourseBrief,
  type CourseGenEvent,
  type CoursePlan
} from '@shared/types'

/**
 * The Create-with-AI flow, as one state machine:
 *
 *   brief → (planning) → plan → (building) → done
 *
 * It lives in a store rather than the dialog so a build survives the learner
 * closing the panel and carrying on reading.
 */
export type CourseGenStage = 'brief' | 'planning' | 'plan' | 'building' | 'done'

export interface BuildProgress {
  done: number
  total: number
  label: string
}

interface CourseGenStore {
  open: boolean
  stage: CourseGenStage
  brief: CourseBrief
  plan: CoursePlan | null
  progress: BuildProgress | null
  error: string | null
  /** Set once a build finishes, so the panel can link straight to the course. */
  courseId: string | null
  jobId: string | null

  openPanel: (seed?: Partial<CourseBrief>) => void
  closePanel: () => void
  setBrief: (patch: Partial<CourseBrief>) => void
  setPlan: (plan: CoursePlan) => void
  reset: () => void
  backToBrief: () => void

  makePlan: () => Promise<void>
  build: () => Promise<void>
  cancel: () => void
  handleEvent: (event: CourseGenEvent) => void
}

function newId(): string {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const IDLE = {
  stage: 'brief' as CourseGenStage,
  plan: null,
  progress: null,
  error: null,
  courseId: null,
  jobId: null
}

export const useCourseGen = create<CourseGenStore>((set, get) => ({
  open: false,
  brief: DEFAULT_COURSE_BRIEF,
  ...IDLE,

  openPanel: (seed) => {
    // A build already running keeps its state; opening the panel just shows it.
    if (get().stage === 'building') {
      set({ open: true })
      return
    }
    set({
      open: true,
      ...IDLE,
      brief: seed ? { ...DEFAULT_COURSE_BRIEF, ...seed } : get().brief
    })
  },

  closePanel: () => set({ open: false }),

  setBrief: (patch) => set((prev) => ({ brief: { ...prev.brief, ...patch }, error: null })),

  setPlan: (plan) => set({ plan }),

  reset: () => set({ ...IDLE, brief: DEFAULT_COURSE_BRIEF }),

  backToBrief: () => set({ stage: 'brief', plan: null, error: null }),

  makePlan: async () => {
    const { brief, stage } = get()
    if (stage === 'planning' || stage === 'building') return
    set({ stage: 'planning', error: null })

    const result = await window.desklearner.courseGen.plan(brief)
    if (!result.ok || !result.plan) {
      set({ stage: 'brief', error: result.error ?? 'Could not design that course.' })
      return
    }
    set({ stage: 'plan', plan: result.plan })
  },

  build: async () => {
    const { plan, brief, stage } = get()
    if (!plan || stage === 'building') return

    const jobId = newId()
    const lessons = plan.chapters.reduce((sum, c) => sum + c.lessons.length, 0)
    set({
      stage: 'building',
      jobId,
      error: null,
      progress: { done: 0, total: lessons, label: 'Starting…' }
    })

    const result = await window.desklearner.courseGen.build({ jobId, plan, brief })
    if (!result.ok) {
      set({ stage: 'plan', jobId: null, error: result.error ?? 'Could not start the build.' })
    }
  },

  cancel: () => {
    const { jobId } = get()
    if (jobId) void window.desklearner.courseGen.abort(jobId)
  },

  handleEvent: (event) => {
    // Ignore anything from a job this window is no longer tracking.
    if (get().jobId !== event.jobId) return

    if (event.type === 'progress') {
      set({ progress: { done: event.done, total: event.total, label: event.label } })
      return
    }
    if (event.type === 'done') {
      set({ stage: 'done', courseId: event.courseId, jobId: null, progress: null })
      return
    }
    set({ stage: 'plan', error: event.message, jobId: null, progress: null })
  }
}))
