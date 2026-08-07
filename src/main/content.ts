import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { is } from '@electron-toolkit/utils'
import type {
  BrokenPack,
  ContentIndex,
  CoursePack,
  LessonDocument,
  LessonFrontmatter,
  PackSource,
  TestDocument
} from '@shared/types'
import { courseManifestSchema, formatZodError, testDocumentSchema } from './schema'
import { markdownToText, parseFrontmatter } from './frontmatter'

/** Packs that ship with the app (read-only). */
export function bundledCoursesDir(): string {
  return is.dev
    ? path.join(app.getAppPath(), 'resources', 'courses')
    : path.join(process.resourcesPath, 'courses')
}

/** Packs the user has imported (removable). */
export function userCoursesDir(): string {
  return path.join(app.getPath('userData'), 'courses')
}

let cache: ContentIndex | null = null

export function invalidateContentCache(): void {
  cache = null
}

async function readDirSafe(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

async function loadPack(root: string, source: PackSource): Promise<CoursePack | BrokenPack> {
  try {
    const raw = await fs.readFile(path.join(root, 'course.json'), 'utf8')
    const parsed = courseManifestSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return { root, source, error: `Invalid course.json — ${formatZodError(parsed.error)}` }
    }
    return { manifest: parsed.data, root, source }
  } catch (err) {
    return { root, source, error: (err as Error).message }
  }
}

export async function listContent(): Promise<ContentIndex> {
  if (cache) return cache

  const courses: CoursePack[] = []
  const broken: BrokenPack[] = []
  const seen = new Set<string>()

  const sources: Array<[string, PackSource]> = [
    [userCoursesDir(), 'user'],
    [bundledCoursesDir(), 'bundled']
  ]

  for (const [dir, source] of sources) {
    for (const name of await readDirSafe(dir)) {
      const result = await loadPack(path.join(dir, name), source)
      if ('error' in result) {
        broken.push(result)
      } else if (seen.has(result.manifest.id)) {
        // A user pack with the same id shadows the bundled one.
        continue
      } else {
        seen.add(result.manifest.id)
        courses.push(result)
      }
    }
  }

  courses.sort((a, b) => a.manifest.title.localeCompare(b.manifest.title))
  cache = { courses, broken }
  return cache
}

export async function findCourse(courseId: string): Promise<CoursePack> {
  const { courses } = await listContent()
  const pack = courses.find((c) => c.manifest.id === courseId)
  if (!pack) throw new Error(`Course "${courseId}" is not installed`)
  return pack
}

/** Joins a pack-relative path and refuses to escape the pack root. */
export function resolveInPack(pack: CoursePack, relative: string): string {
  const full = path.resolve(pack.root, relative)
  const rootWithSep = path.resolve(pack.root) + path.sep
  if (!full.startsWith(rootWithSep)) throw new Error('Path escapes the course pack')
  return full
}

export async function loadLesson(
  courseId: string,
  chapterId: string,
  lessonId: string
): Promise<LessonDocument> {
  const pack = await findCourse(courseId)
  const chapter = pack.manifest.chapters.find((c) => c.id === chapterId)
  if (!chapter) throw new Error(`Chapter "${chapterId}" not found in ${courseId}`)
  const lesson = chapter.lessons.find((l) => l.id === lessonId)
  if (!lesson) throw new Error(`Lesson "${lessonId}" not found in ${chapterId}`)

  const raw = await fs.readFile(resolveInPack(pack, lesson.file), 'utf8')
  const { data, content } = parseFrontmatter<LessonFrontmatter>(raw)
  return {
    courseId,
    chapterId,
    lessonId,
    frontmatter: { title: lesson.title, minutes: lesson.minutes, ...data },
    markdown: content
  }
}

export async function loadTest(courseId: string, testId: string): Promise<TestDocument> {
  const pack = await findCourse(courseId)
  const refs = [
    ...pack.manifest.chapters.flatMap((c) => (c.test ? [c.test] : [])),
    ...(pack.manifest.finalExam ? [pack.manifest.finalExam] : [])
  ]
  const ref = refs.find((t) => t.id === testId)
  if (!ref) throw new Error(`Test "${testId}" not found in ${courseId}`)

  const raw = await fs.readFile(resolveInPack(pack, ref.file), 'utf8')
  const parsed = testDocumentSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) throw new Error(`Invalid test "${testId}" — ${formatZodError(parsed.error)}`)
  return { ...parsed.data, title: ref.title || parsed.data.title }
}

export interface CorpusEntry {
  id: string
  courseId: string
  courseTitle: string
  chapterId: string
  chapterTitle: string
  lessonId: string
  title: string
  text: string
}

export async function buildSearchCorpus(): Promise<CorpusEntry[]> {
  const { courses } = await listContent()
  const out: CorpusEntry[] = []
  for (const pack of courses) {
    for (const chapter of pack.manifest.chapters) {
      for (const lesson of chapter.lessons) {
        let text = ''
        try {
          const raw = await fs.readFile(resolveInPack(pack, lesson.file), 'utf8')
          text = markdownToText(parseFrontmatter(raw).content)
        } catch {
          continue
        }
        out.push({
          id: `${pack.manifest.id}/${chapter.id}/${lesson.id}`,
          courseId: pack.manifest.id,
          courseTitle: pack.manifest.title,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          lessonId: lesson.id,
          title: lesson.title,
          text
        })
      }
    }
  }
  return out
}
