import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { CH } from '@shared/channels'
import type {
  CourseBrief,
  CourseBuildRequest,
  CourseGenEvent,
  CourseManifest,
  CoursePlan,
  CoursePlanChapter,
  CoursePlanLesson,
  CoursePlanResult,
  Question,
  TestDocument
} from '@shared/types'
import { describeError, getClient, MODEL } from './ai'
import { coursePlanSchema, formatZodError, testDocumentSchema } from './schema'
import { installPackFrom } from './packs'
import { listContent } from './content'

/**
 * Course authoring. Two phases, deliberately split:
 *
 *  1. `planCourse` — one call that turns a brief into an outline. Cheap enough
 *     to redo, and the learner reviews it before anything is written.
 *  2. `buildCourse` — one call per lesson and per test, written into a staging
 *     directory and only installed once every file is on disk. A failed or
 *     cancelled build leaves no half-course in the library.
 */

const PLAN_MAX_TOKENS = 8_000
const LESSON_MAX_TOKENS = 16_000
const TEST_MAX_TOKENS = 8_000

/** Lessons are independent, so a few can be in flight at once without confusing the model. */
const CONCURRENCY = 3

const jobs = new Map<string, AbortController>()

export function abortJob(jobId: string): void {
  jobs.get(jobId)?.abort()
  jobs.delete(jobId)
}

export function abortAllJobs(): void {
  for (const controller of jobs.values()) controller.abort()
  jobs.clear()
}

/* ------------------------------------------------------------------ *
 * Shared prompt material
 * ------------------------------------------------------------------ */

/**
 * The subset of the reader's markdown dialect worth teaching the author model.
 * Kept byte-stable so it stays in one prompt-cache entry across every lesson
 * in a build.
 */
const AUTHORING_GUIDE = `DeskLearner lessons are Markdown files with YAML frontmatter. The reader supports GitHub-flavoured Markdown, fenced code blocks with language tags, LaTeX maths (\`$inline$\` and \`$$block$$\`), Mermaid diagrams (\`\`\`mermaid fences) and these directives:

- \`:::hint{type=note|tip|warning|danger}\` … \`:::\` — a callout.
- \`:::steps\` with a numbered list inside — a walkthrough.
- \`:::checklist\` with \`- [ ]\` items — the learner's tick state is saved.
- \`:::details{summary="..."}\` … \`:::\` — collapsed by default. Good for solutions.
- \`:::tabs\` containing \`::::tab{title="..."}\` blocks — parallel variants.
- \`:::cards\` containing \`::::card{title="..."}\` blocks — a summary grid.
- \`::youtube{id=VIDEOID}\` — an embedded video. Only use ids you are certain of; otherwise link out instead.

Do not invent other directives. Never use a fourth-level \`::::\` block outside \`tabs\` or \`cards\`.`

const LESSON_SYSTEM = `You write lessons for DeskLearner, an offline desktop course reader. You are writing one lesson of a larger course, and it will be read on its own screen by one learner working through the course in order.

Write the lesson the way a strong practitioner would teach it to a colleague: concrete, opinionated, and grounded in things the learner will actually do. Prefer worked examples over definitions, and explain why something works, not only that it does. Use the second person. Do not pad with filler sections, marketing language, or a recap of what the lesson is about to say.

Assume the learner has finished every earlier lesson and none of the later ones. Build on the earlier material explicitly; do not re-teach it. Do not reference lessons that come after this one.

End with a short "Practice" section giving the learner something to do, and put any solutions inside a \`:::details\` block so they are not spoiled.

${AUTHORING_GUIDE}

Return only the lesson file: the frontmatter block, then the body. No preamble, no code fence around the whole thing.`

const TEST_SYSTEM = `You write assessments for DeskLearner, an offline desktop course reader.

Write questions that test whether the learner can apply the material, not whether they can recall a sentence from it. Favour scenarios ("a query returns duplicate rows after you add a join — what is the most likely cause?") over definition-matching. Every distractor must be plausible to someone who half-learned the topic; never pad options with obvious throwaways.

Only ask about material the lessons actually covered. Every question needs an \`explanation\` that teaches — say why the right answer is right and why a tempting wrong answer is wrong.

Question ids must be unique within the test.`

function describeBrief(brief: CourseBrief): string {
  const lines = [
    `Topic: ${brief.topic}`,
    `Starting level: ${brief.difficulty}`,
    `Shape: ${brief.chapters} chapters, ${brief.lessonsPerChapter} lessons per chapter, about ${brief.minutesPerLesson} minutes of work per lesson.`
  ]
  if (brief.audience) lines.push(`Who it is for: ${brief.audience}`)
  if (brief.goals) lines.push(`What they want to be able to do at the end: ${brief.goals}`)
  return lines.join('\n')
}

/* ------------------------------------------------------------------ *
 * Phase 1 — the plan
 * ------------------------------------------------------------------ */

const PLAN_SYSTEM = `You design course outlines for DeskLearner, an offline desktop course reader.

Design a course that takes the learner from the stated starting level to the stated goal along the shortest honest path. Order chapters so each one is usable on its own and every lesson depends only on lessons before it. Give each lesson a specific, concrete title — "Joins that return too many rows", not "More about joins" — and a summary that tells the lesson writer exactly what to cover and what to leave to a later lesson, so no two lessons overlap.

Match the requested number of chapters and lessons exactly.

Ids: lowercase, hyphenated, unique. Use \`chapter-1\`, \`chapter-2\` … for chapters and \`lesson-01\`, \`lesson-02\` … numbered continuously across the whole course for lessons. The course id must be a short slug derived from the title.

\`color\` is a hex colour used as the course accent — pick one that suits the subject.`

/**
 * Structured-output schemas must mark every property required and forbid extra
 * ones, so "optional" fields are modelled as fields that may be empty.
 */
const PLAN_FORMAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', description: 'Short lowercase slug, hyphens only.' },
    title: { type: 'string' },
    subtitle: { type: 'string', description: 'One line, under 90 characters.' },
    description: { type: 'string', description: 'A paragraph or two of Markdown.' },
    tags: { type: 'array', items: { type: 'string' } },
    color: { type: 'string', description: 'Hex colour like #3b82f6.' },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          lessons: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                summary: {
                  type: 'string',
                  description: 'What this lesson covers, for the lesson writer.'
                }
              },
              required: ['id', 'title', 'summary']
            }
          }
        },
        required: ['id', 'title', 'summary', 'lessons']
      }
    }
  },
  required: ['id', 'title', 'subtitle', 'description', 'tags', 'color', 'chapters']
} as const

/** Pulls the assistant's text out of a message, whatever else came back with it. */
function textOf(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim()
}

/** Structured output is JSON, but a stray fence costs nothing to survive. */
function parseJson(raw: string): unknown {
  const fenced = raw.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/)
  return JSON.parse(fenced ? fenced[1] : raw)
}

export async function planCourse(brief: CourseBrief): Promise<CoursePlanResult> {
  const anthropic = getClient()
  if (!anthropic) return { ok: false, error: 'No API key configured.' }
  if (!brief.topic.trim()) return { ok: false, error: 'Describe what the course should cover.' }

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: PLAN_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: PLAN_FORMAT_SCHEMA }
      },
      system: PLAN_SYSTEM,
      messages: [{ role: 'user', content: describeBrief(brief) }]
    })

    if (message.stop_reason === 'refusal') {
      return { ok: false, error: 'Claude declined to design a course on that topic.' }
    }

    const parsed = coursePlanSchema.safeParse(parseJson(textOf(message.content)))
    if (!parsed.success) {
      return {
        ok: false,
        error: `The outline came back malformed — ${formatZodError(parsed.error)}`
      }
    }
    return { ok: true, plan: parsed.data }
  } catch (err) {
    return { ok: false, error: describeError(err) }
  }
}

/* ------------------------------------------------------------------ *
 * Phase 2 — the build
 * ------------------------------------------------------------------ */

/**
 * Only the four question types that survive being written blind. Ordering and
 * matching questions need visual layout the author cannot see, and fill-blank
 * placeholders are easy to get subtly wrong.
 */
const TEST_FORMAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['single', 'multi', 'boolean', 'short'] },
          prompt: { type: 'string' },
          explanation: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'For single and multi only. At least 3 options. Empty otherwise.'
          },
          answerIndices: {
            type: 'array',
            items: { type: 'integer' },
            description:
              'For single (exactly one entry) and multi (one or more). Indices into options. Empty otherwise.'
          },
          answerBoolean: { type: 'boolean', description: 'For boolean only; false otherwise.' },
          accepted: {
            type: 'array',
            items: { type: 'string' },
            description:
              'For short only: every wording that should be marked correct. Empty otherwise.'
          }
        },
        required: [
          'id',
          'type',
          'prompt',
          'explanation',
          'options',
          'answerIndices',
          'answerBoolean',
          'accepted'
        ]
      }
    }
  },
  required: ['questions']
} as const

interface DraftQuestion {
  id: string
  type: 'single' | 'multi' | 'boolean' | 'short'
  prompt: string
  explanation: string
  options: string[]
  answerIndices: number[]
  answerBoolean: boolean
  accepted: string[]
}

/** Folds the flat authoring shape back into the reader's discriminated union. */
function toTestDocument(id: string, title: string, draft: DraftQuestion[]): TestDocument {
  const questions = draft.flatMap((q, index): Question[] => {
    const base = { id: q.id || `q-${index + 1}`, prompt: q.prompt, explanation: q.explanation }
    const valid = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < q.options.length

    if (q.type === 'single') {
      const answer = q.answerIndices.find(valid)
      if (q.options.length < 2 || answer === undefined) return []
      return [{ ...base, type: 'single' as const, options: q.options, answer }]
    }
    if (q.type === 'multi') {
      const answer = [...new Set(q.answerIndices.filter(valid))]
      if (q.options.length < 2 || answer.length === 0) return []
      return [{ ...base, type: 'multi' as const, options: q.options, answer }]
    }
    if (q.type === 'boolean') {
      return [{ ...base, type: 'boolean' as const, answer: Boolean(q.answerBoolean) }]
    }
    const accepted = q.accepted.filter((a) => a.trim())
    if (accepted.length === 0) return []
    return [{ ...base, type: 'short' as const, accepted }]
  })

  return { id, title, passingScore: 70, shuffle: true, questions }
}

interface BuildContext {
  brief: CourseBrief
  plan: CoursePlan
  outline: string
  signal: AbortSignal
}

/** The whole syllabus as titles, so each lesson knows what it may assume and must not repeat. */
function buildOutlineBlock(plan: CoursePlan): string {
  const lines = [`# ${plan.title}`]
  if (plan.description) lines.push('', plan.description)
  lines.push('', '## Full outline', '')
  for (const chapter of plan.chapters) {
    lines.push(`### ${chapter.title}`, chapter.summary, '')
    for (const lesson of chapter.lessons) {
      lines.push(`- **${lesson.title}** — ${lesson.summary}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

async function writeLesson(
  ctx: BuildContext,
  chapter: CoursePlanChapter,
  lesson: CoursePlanLesson,
  root: string
): Promise<void> {
  const anthropic = getClient()
  if (!anthropic) throw new Error('No API key configured.')

  const message = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: LESSON_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: [
        { type: 'text', text: LESSON_SYSTEM },
        // Every lesson in this build shares the outline verbatim, so it is
        // written to the cache once and read back at ~10% of input price.
        { type: 'text', text: ctx.outline, cache_control: { type: 'ephemeral' } }
      ],
      messages: [
        {
          role: 'user',
          content: [
            `Write the lesson "${lesson.title}".`,
            '',
            `It sits in the chapter "${chapter.title}".`,
            `Cover: ${lesson.summary}`,
            '',
            `Target about ${ctx.brief.minutesPerLesson} minutes of reading and working — write to that length rather than filling space.`,
            '',
            'Frontmatter must contain:',
            `- title: ${lesson.title}`,
            '- summary: one sentence',
            `- minutes: ${ctx.brief.minutesPerLesson}`,
            '- objectives: 3 to 5 things the learner can do afterwards',
            '- keyTerms: 3 to 8 entries, each with `term` and `definition`',
            '- resources: up to 5 entries with `label` and `url`. Only real, stable URLs you are confident exist — official documentation, specifications, standards. Omit the field entirely rather than guessing a link.'
          ].join('\n')
        }
      ]
    },
    { signal: ctx.signal }
  )

  if (message.stop_reason === 'refusal') {
    throw new Error(`Claude declined to write the lesson "${lesson.title}".`)
  }

  const body = textOf(message.content)
  if (!body.startsWith('---')) {
    throw new Error(`The lesson "${lesson.title}" came back without frontmatter.`)
  }
  await fs.writeFile(path.join(root, 'lessons', `${lesson.id}.md`), `${body}\n`, 'utf8')
}

async function writeTest(
  ctx: BuildContext,
  testId: string,
  title: string,
  scope: string,
  questionCount: number,
  root: string
): Promise<void> {
  const anthropic = getClient()
  if (!anthropic) throw new Error('No API key configured.')

  const message = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: TEST_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: TEST_FORMAT_SCHEMA }
      },
      system: [
        { type: 'text', text: TEST_SYSTEM },
        { type: 'text', text: ctx.outline, cache_control: { type: 'ephemeral' } }
      ],
      messages: [
        {
          role: 'user',
          content: `Write ${questionCount} questions for "${title}".\n\nCover only this material:\n${scope}\n\nMix the question types: mostly single-choice, with some multi-choice and short-answer, and boolean only where a genuine misconception is at stake.`
        }
      ]
    },
    { signal: ctx.signal }
  )

  if (message.stop_reason === 'refusal') throw new Error(`Claude declined to write "${title}".`)

  const draft = parseJson(textOf(message.content)) as { questions?: DraftQuestion[] }
  const document = toTestDocument(testId, title, draft.questions ?? [])

  const parsed = testDocumentSchema.safeParse(document)
  if (!parsed.success) {
    throw new Error(`"${title}" came back unusable — ${formatZodError(parsed.error)}`)
  }
  await fs.writeFile(
    path.join(root, 'tests', `${testId}.json`),
    `${JSON.stringify(parsed.data, null, 2)}\n`,
    'utf8'
  )
}

/** Runs `tasks` a few at a time, failing the whole batch on the first error. */
async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      await fn(items[index])
    }
  })
  await Promise.all(workers)
}

function manifestFor(plan: CoursePlan, brief: CourseBrief): CourseManifest {
  const lessonCount = plan.chapters.reduce((sum, c) => sum + c.lessons.length, 0)
  return {
    id: plan.id,
    title: plan.title,
    subtitle: plan.subtitle || undefined,
    description: plan.description || undefined,
    version: '1.0.0',
    author: 'Generated with AI',
    tags: plan.tags?.length ? plan.tags : undefined,
    color: plan.color || undefined,
    estimatedHours: Math.round(((lessonCount * brief.minutesPerLesson) / 60) * 10) / 10,
    chapters: plan.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary || undefined,
      lessons: chapter.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        file: `lessons/${lesson.id}.md`,
        minutes: brief.minutesPerLesson
      })),
      test: brief.includeTests
        ? {
            id: `test-${chapter.id}`,
            title: `${chapter.title} — Test`,
            file: `tests/test-${chapter.id}.json`
          }
        : undefined
    })),
    finalExam: brief.includeFinalExam
      ? { id: 'final-exam', title: 'Final Exam', file: 'tests/final-exam.json' }
      : undefined
  }
}

/**
 * Installing writes to `<userData>/courses/<id>`, replacing whatever is there.
 * A model that picks an id already in use would quietly delete that course, so
 * generated ids step aside instead.
 */
async function freeCourseId(wanted: string): Promise<string> {
  const { courses } = await listContent()
  const taken = new Set(courses.map((c) => c.manifest.id))
  if (!taken.has(wanted)) return wanted
  for (let n = 2; n < 100; n += 1) {
    if (!taken.has(`${wanted}-${n}`)) return `${wanted}-${n}`
  }
  return `${wanted}-${Date.now()}`
}

export async function buildCourse(win: BrowserWindow, request: CourseBuildRequest): Promise<void> {
  const { jobId, brief } = request
  const plan: CoursePlan = { ...request.plan, id: await freeCourseId(request.plan.id) }

  const emit = (event: CourseGenEvent): void => {
    if (!win.isDestroyed()) win.webContents.send(CH.courseGenEvent, event)
  }

  const controller = new AbortController()
  jobs.set(jobId, controller)

  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'desklearner-gen-'))
  const ctx: BuildContext = {
    brief,
    plan,
    outline: buildOutlineBlock(plan),
    signal: controller.signal
  }

  const lessonJobs = plan.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({ chapter, lesson }))
  )
  const testCount =
    (brief.includeTests ? plan.chapters.length : 0) + (brief.includeFinalExam ? 1 : 0)
  const total = lessonJobs.length + testCount
  let done = 0

  const step = (label: string): void => {
    done += 1
    emit({ jobId, type: 'progress', done, total, label })
  }

  try {
    await fs.mkdir(path.join(staging, 'lessons'), { recursive: true })
    await fs.mkdir(path.join(staging, 'tests'), { recursive: true })

    emit({ jobId, type: 'progress', done: 0, total, label: 'Writing lessons…' })

    await runPool(lessonJobs, CONCURRENCY, async ({ chapter, lesson }) => {
      if (controller.signal.aborted) return
      await writeLesson(ctx, chapter, lesson, staging)
      step(`Wrote “${lesson.title}”`)
    })

    if (controller.signal.aborted) throw new Error('aborted')

    // Tests come after their lessons so a later feature can feed the real
    // lesson text in; for now the outline is the shared source of truth.
    if (brief.includeTests) {
      await runPool(plan.chapters, CONCURRENCY, async (chapter) => {
        if (controller.signal.aborted) return
        const title = `${chapter.title} — Test`
        const scope = chapter.lessons.map((l) => `- ${l.title}: ${l.summary}`).join('\n')
        await writeTest(ctx, `test-${chapter.id}`, title, scope, 10, staging)
        step(`Wrote the ${chapter.title} test`)
      })
    }

    if (controller.signal.aborted) throw new Error('aborted')

    if (brief.includeFinalExam) {
      const scope = plan.chapters
        .map((c) => `${c.title}\n${c.lessons.map((l) => `- ${l.title}: ${l.summary}`).join('\n')}`)
        .join('\n\n')
      await writeTest(ctx, 'final-exam', 'Final Exam', scope, 20, staging)
      step('Wrote the final exam')
    }

    if (controller.signal.aborted) throw new Error('aborted')

    await fs.writeFile(
      path.join(staging, 'course.json'),
      `${JSON.stringify(manifestFor(plan, brief), null, 2)}\n`,
      'utf8'
    )

    const result = await installPackFrom(staging)
    if (!result.ok || !result.courseId) {
      throw new Error(result.error ?? 'The finished course could not be installed.')
    }

    emit({ jobId, type: 'done', courseId: result.courseId, title: plan.title })
  } catch (err) {
    if (controller.signal.aborted) {
      emit({ jobId, type: 'error', message: 'Cancelled.' })
    } else {
      emit({ jobId, type: 'error', message: describeError(err) })
    }
  } finally {
    jobs.delete(jobId)
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined)
  }
}
