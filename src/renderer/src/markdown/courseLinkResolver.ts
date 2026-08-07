import type { CoursePack, ProgressState } from '@shared/types'
import { getLesson } from '@/stores/progress'

/**
 * Resolution logic for `lesson:` / `test:` markdown links, kept free of React so
 * it can be exercised directly. The components live in `CourseLinks.tsx`.
 */

export type CourseLinkKind = 'lesson' | 'test'

export interface ResolvedCourseLink {
  kind: CourseLinkKind
  to: string
  /** The real title from the manifest, used when the link text is just an id. */
  title: string
  done?: boolean
}

export type CourseLinkResolver = (kind: CourseLinkKind, id: string) => ResolvedCourseLink | null

/** Parses an href of the form `lesson:day-12`. */
export function parseCourseLink(href: string): { kind: CourseLinkKind; id: string } | null {
  const match = /^(lesson|test):(.+)$/i.exec(href.trim())
  if (!match) return null
  const id = match[2].trim()
  if (!id) return null
  return { kind: match[1].toLowerCase() as CourseLinkKind, id }
}

/** Builds a resolver over one course pack. Ids are matched case-insensitively. */
export function buildCourseLinkResolver(
  pack: CoursePack | undefined,
  progress: ProgressState
): CourseLinkResolver | null {
  if (!pack) return null

  const courseId = pack.manifest.id
  const lessons = new Map<string, ResolvedCourseLink>()
  const tests = new Map<string, ResolvedCourseLink>()

  for (const chapter of pack.manifest.chapters) {
    for (const lesson of chapter.lessons) {
      lessons.set(lesson.id.toLowerCase(), {
        kind: 'lesson',
        to: `/course/${courseId}/lesson/${chapter.id}/${lesson.id}`,
        title: lesson.title,
        done: getLesson(progress, courseId, chapter.id, lesson.id).status === 'complete'
      })
    }
    if (chapter.test) {
      tests.set(chapter.test.id.toLowerCase(), {
        kind: 'test',
        to: `/course/${courseId}/test/${chapter.test.id}`,
        title: chapter.test.title
      })
    }
  }

  if (pack.manifest.finalExam) {
    tests.set(pack.manifest.finalExam.id.toLowerCase(), {
      kind: 'test',
      to: `/course/${courseId}/test/${pack.manifest.finalExam.id}`,
      title: pack.manifest.finalExam.title
    })
  }

  return (kind, id) => (kind === 'lesson' ? lessons : tests).get(id.trim().toLowerCase()) ?? null
}
