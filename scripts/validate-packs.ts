/**
 * Validates every bundled course pack without launching Electron.
 * Run with: npx tsx scripts/validate-packs.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { courseManifestSchema, testDocumentSchema, formatZodError } from '../src/main/schema'
import { parseFrontmatter } from '../src/main/frontmatter'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const coursesDir = path.join(root, 'resources', 'courses')

let errors = 0
let lessons = 0
let questions = 0

function fail(message: string): void {
  console.error(`  ✗ ${message}`)
  errors++
}

for (const name of readdirSync(coursesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)) {
  const packRoot = path.join(coursesDir, name)
  console.log(`\n${name}`)

  const parsed = courseManifestSchema.safeParse(
    JSON.parse(readFileSync(path.join(packRoot, 'course.json'), 'utf8'))
  )
  if (!parsed.success) {
    fail(`course.json — ${formatZodError(parsed.error)}`)
    continue
  }
  const manifest = parsed.data
  console.log(`  ✓ manifest: ${manifest.chapters.length} chapters`)

  const seenIds = new Set<string>()

  for (const chapter of manifest.chapters) {
    for (const lesson of chapter.lessons) {
      const key = `${chapter.id}/${lesson.id}`
      if (seenIds.has(key)) fail(`duplicate lesson id ${key}`)
      seenIds.add(key)

      const file = path.join(packRoot, lesson.file)
      if (!existsSync(file)) {
        fail(`missing lesson file ${lesson.file}`)
        continue
      }
      const raw = readFileSync(file, 'utf8')
      const { data, content } = parseFrontmatter<Record<string, unknown>>(raw)
      if (!data.title) fail(`${lesson.file} has no title in frontmatter`)
      if (!Array.isArray(data.objectives) || data.objectives.length === 0) {
        fail(`${lesson.file} has no objectives`)
      }
      if (content.trim().length < 500) fail(`${lesson.file} body is suspiciously short`)

      // Unbalanced container directives break the renderer silently.
      const opens = (content.match(/^:::[a-z]/gm) ?? []).length
      const closes = (content.match(/^:::\s*$/gm) ?? []).length
      if (opens !== closes) {
        fail(`${lesson.file}: ${opens} directive openers vs ${closes} closers`)
      }

      const fences = (content.match(/^```/gm) ?? []).length
      if (fences % 2 !== 0) fail(`${lesson.file}: unbalanced code fences (${fences})`)

      lessons++
    }
  }

  const testRefs = [
    ...manifest.chapters.flatMap((c) => (c.test ? [c.test] : [])),
    ...(manifest.finalExam ? [manifest.finalExam] : [])
  ]

  for (const ref of testRefs) {
    const file = path.join(packRoot, ref.file)
    if (!existsSync(file)) {
      fail(`missing test file ${ref.file}`)
      continue
    }
    const result = testDocumentSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    if (!result.success) {
      fail(`${ref.file} — ${formatZodError(result.error)}`)
      continue
    }

    const test = result.data
    const ids = new Set<string>()
    for (const q of test.questions) {
      if (ids.has(q.id)) fail(`${ref.file}: duplicate question id ${q.id}`)
      ids.add(q.id)
      if (!q.explanation) fail(`${ref.file}: ${q.id} has no explanation`)

      // Answer indices must be in range, and ordering answers must match their items.
      if (q.type === 'single' && q.answer >= q.options.length) {
        fail(`${ref.file}: ${q.id} answer index out of range`)
      }
      if (q.type === 'multi' && q.answer.some((a) => a >= q.options.length)) {
        fail(`${ref.file}: ${q.id} answer index out of range`)
      }
      if (q.type === 'ordering') {
        const a = [...q.answer].sort().join('|')
        const b = [...q.items].sort().join('|')
        if (a !== b) fail(`${ref.file}: ${q.id} ordering answer does not match items`)
      }
      if (q.type === 'fill-blank') {
        const placeholders = new Set((q.text.match(/\{\{(\d+)\}\}/g) ?? []))
        if (placeholders.size !== q.blanks.length) {
          fail(`${ref.file}: ${q.id} has ${placeholders.size} placeholders but ${q.blanks.length} blanks`)
        }
      }
      questions++
    }
    console.log(`  ✓ ${ref.file} — ${test.questions.length} questions`)
  }
}

console.log(`\n${lessons} lessons, ${questions} questions checked.`)
if (errors) {
  console.error(`${errors} problem(s) found.`)
  process.exit(1)
}
console.log('All packs valid.')
