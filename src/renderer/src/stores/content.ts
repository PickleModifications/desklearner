import { create } from 'zustand'
import type { ContentIndex, CoursePack } from '@shared/types'

interface ContentStore {
  index: ContentIndex
  loaded: boolean
  error?: string
  load: () => Promise<void>
  reload: () => Promise<void>
}

export const useContent = create<ContentStore>((set) => ({
  index: { courses: [], broken: [] },
  loaded: false,

  load: async () => {
    try {
      const index = await window.desklearner.content.list()
      set({ index, loaded: true, error: undefined })
    } catch (err) {
      set({ loaded: true, error: (err as Error).message })
    }
  },

  reload: async () => {
    const index = await window.desklearner.content.list()
    set({ index })
  }
}))

export function findCoursePack(index: ContentIndex, courseId: string): CoursePack | undefined {
  return index.courses.find((c) => c.manifest.id === courseId)
}

export interface FlatLesson {
  chapterId: string
  chapterTitle: string
  chapterIndex: number
  lessonId: string
  lessonTitle: string
  lessonIndex: number
  /** Position across the whole course, 1-based. */
  ordinal: number
  minutes?: number
}

/** Flattens a course's chapters into a single ordered lesson list for prev/next navigation. */
export function flattenLessons(pack: CoursePack): FlatLesson[] {
  const out: FlatLesson[] = []
  pack.manifest.chapters.forEach((chapter, chapterIndex) => {
    chapter.lessons.forEach((lesson, lessonIndex) => {
      out.push({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterIndex,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonIndex,
        ordinal: out.length + 1,
        minutes: lesson.minutes
      })
    })
  })
  return out
}

export function courseTests(
  pack: CoursePack
): Array<{ id: string; title: string; chapterId?: string }> {
  const tests: Array<{ id: string; title: string; chapterId?: string }> = pack.manifest.chapters
    .filter((c) => c.test)
    .map((c) => ({ id: c.test!.id, title: c.test!.title, chapterId: c.id }))
  if (pack.manifest.finalExam) {
    tests.push({ id: pack.manifest.finalExam.id, title: pack.manifest.finalExam.title })
  }
  return tests
}
