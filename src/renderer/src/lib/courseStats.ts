import type { ChapterRef, CoursePack, ProgressState } from '@shared/types'
import { bestAttempt, lessonKey } from '@/stores/progress'

export interface CourseStats {
  totalLessons: number
  completedLessons: number
  inProgressLessons: number
  fraction: number
  totalMinutes: number
  minutesSpent: number
  testsTotal: number
  testsPassed: number
  lastLesson?: { chapterId: string; lessonId: string }
}

export function chapterFraction(
  pack: CoursePack,
  chapter: ChapterRef,
  progress: ProgressState
): number {
  const lessons = chapter.lessons
  if (!lessons.length) return 0
  const done = lessons.filter(
    (l) =>
      progress.courses[pack.manifest.id]?.lessons[lessonKey(chapter.id, l.id)]?.status === 'complete'
  ).length
  return done / lessons.length
}

export function courseStats(pack: CoursePack, progress: ProgressState): CourseStats {
  const courseProgress = progress.courses[pack.manifest.id]
  let totalLessons = 0
  let completedLessons = 0
  let inProgressLessons = 0
  let totalMinutes = 0
  let secondsSpent = 0

  for (const chapter of pack.manifest.chapters) {
    for (const lesson of chapter.lessons) {
      totalLessons++
      totalMinutes += lesson.minutes ?? 0
      const entry = courseProgress?.lessons[lessonKey(chapter.id, lesson.id)]
      if (entry?.status === 'complete') completedLessons++
      else if (entry?.status === 'in-progress') inProgressLessons++
      secondsSpent += entry?.secondsSpent ?? 0
    }
  }

  const testIds = [
    ...pack.manifest.chapters.flatMap((c) => (c.test ? [c.test.id] : [])),
    ...(pack.manifest.finalExam ? [pack.manifest.finalExam.id] : [])
  ]
  const testsPassed = testIds.filter(
    (id) => bestAttempt(progress, pack.manifest.id, id)?.passed
  ).length

  const [chapterId, lessonId] = (courseProgress?.lastLesson ?? '').split('/')

  return {
    totalLessons,
    completedLessons,
    inProgressLessons,
    fraction: totalLessons ? completedLessons / totalLessons : 0,
    totalMinutes,
    minutesSpent: secondsSpent / 60,
    testsTotal: testIds.length,
    testsPassed,
    lastLesson: chapterId && lessonId ? { chapterId, lessonId } : undefined
  }
}
