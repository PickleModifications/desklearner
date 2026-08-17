import Anthropic from '@anthropic-ai/sdk'
import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaToolUnion
} from '@anthropic-ai/sdk/resources/beta'
import type { BrowserWindow } from 'electron'
import { CH } from '@shared/channels'
import { fenceLanguageFor, isImageMediaType } from '@shared/attachments'
import type {
  CourseBrief,
  PendingAttachment,
  TeacherAttachment,
  TeacherContext,
  TeacherMessage,
  TeacherSendRequest,
  TeacherStreamEvent
} from '@shared/types'
import { readAttachment } from './attachments'
import { readKey } from './secrets'

export const MODEL = 'claude-opus-5'
const MAX_TOKENS = 16_000

/** One extra round trip, so the Teacher can speak after proposing a course. */
const MAX_TOOL_ROUNDS = 2

/**
 * How many of the most recent attachment-bearing user turns get their bytes
 * re-sent. Older attachments degrade to a text placeholder so a long thread
 * cannot quietly re-upload megabytes of images on every message.
 */
const REHYDRATE_TURNS = 4

let client: Anthropic | null = null
const inFlight = new Map<string, AbortController>()

export function invalidateClient(): void {
  client = null
}

export function getClient(): Anthropic | null {
  if (client) return client
  const apiKey = readKey()
  if (!apiKey) return null
  client = new Anthropic({ apiKey })
  return client
}

/* ------------------------------------------------------------------ *
 * Prompting
 * ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are the Teacher in DeskLearner, a desktop course app. You tutor one learner through the lesson they are currently reading.

Ground every answer in the lesson material provided below. When the lesson covers something, teach it the way the lesson frames it; when the learner asks about something outside the lesson, say so plainly and answer briefly.

Think the question through before answering. Work out what the learner actually misunderstands and check your explanation against the lesson.

**Guide, don't solve.** For exercises, problems, coding tasks, homework, quizzes, and tests, do not give the learner the answer directly. Start with the smallest useful hint or guiding question, then let the learner attempt the next step. If they are wrong, explain the misconception and give another hint. Gradually increase help only when needed.

Never reveal an answer indirectly. Do not state the final result, tell them which option is correct, give the expected output, complete the final calculation, or provide enough intermediate information that the answer becomes trivial.

Ask yourself before responding: "Could the learner copy my response as their answer without doing the thinking themselves?" If yes, give a hint instead.

For normal conceptual questions, explain directly. The guided-learning rule applies when the learner is expected to produce an answer or solve something.

If the learner asks for "just the answer," still guide them rather than giving it.

Never reveal test answers before the learner has attempted the test.

Keep responses focused and brief. Use Markdown and fenced code blocks for commands and code.

If the learner is wrong, correct their reasoning without immediately giving the solution. If unsure, say so rather than guessing.

Use the course outline and completed lessons to place answers in context. Do not assume knowledge from unfinished lessons.

Whenever you refer to another lesson or test, link it using its exact outline id: [Lesson](lesson:id) or [Test](test:id). Never invent ids or link the lesson currently open.

Read attached screenshots, diagrams, PDFs, and files carefully and work from what is actually shown. If something is unreadable or ambiguous, say so.

**Building a course.** DeskLearner can generate a whole new course. Call \`propose_course\` when the learner asks for one ("build me a course on X", "can you make a course about Y"), or when they say a topic sits outside this course and they want to study it properly. The tool does not build anything — it shows the learner a card they can review, edit and confirm. Infer the shape from what they said and from what you know about their level; only ask a follow-up question if the topic itself is unclear. After calling it, say in one or two sentences what you proposed and that they can adjust it before building. Do not call it for a question you can simply answer.`

const PROPOSE_COURSE_TOOL: BetaToolUnion = {
  name: 'propose_course',
  description:
    'Offer to build a new DeskLearner course. Shows the learner an editable proposal card; it does not generate anything until they confirm.',
  input_schema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description:
          'What the course teaches, as a short phrase. e.g. "Rust ownership and lifetimes".'
      },
      audience: {
        type: 'string',
        description: 'Who it is for and what they already know, in one sentence.'
      },
      goals: {
        type: 'string',
        description: 'What the learner should be able to do by the end, in one or two sentences.'
      },
      difficulty: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced'],
        description: 'Where the course starts, relative to the stated audience.'
      },
      chapters: { type: 'integer', description: 'Number of chapters, 1 to 10.' },
      lessonsPerChapter: { type: 'integer', description: 'Lessons in each chapter, 1 to 10.' },
      minutesPerLesson: {
        type: 'integer',
        description: 'Rough working time per lesson, 15 to 180.'
      },
      includeTests: { type: 'boolean', description: 'Whether each chapter ends with a test.' },
      includeFinalExam: {
        type: 'boolean',
        description: 'Whether the course ends with a final exam.'
      }
    },
    required: ['topic', 'difficulty', 'chapters', 'lessonsPerChapter', 'minutesPerLesson']
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** The model's tool input is untrusted — coerce it into a brief the UI can render. */
function briefFromToolInput(input: unknown): CourseBrief | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const topic = typeof raw.topic === 'string' ? raw.topic.trim() : ''
  if (!topic) return null

  const difficulty =
    raw.difficulty === 'beginner' || raw.difficulty === 'advanced' ? raw.difficulty : 'intermediate'

  return {
    topic,
    audience: typeof raw.audience === 'string' ? raw.audience : undefined,
    goals: typeof raw.goals === 'string' ? raw.goals : undefined,
    difficulty,
    chapters: clampInt(raw.chapters, 1, 10, 4),
    lessonsPerChapter: clampInt(raw.lessonsPerChapter, 1, 10, 5),
    minutesPerLesson: clampInt(raw.minutesPerLesson, 15, 180, 45),
    includeTests: raw.includeTests !== false,
    includeFinalExam: raw.includeFinalExam !== false
  }
}

/**
 * The stable half of the prompt. Everything volatile (scroll position, the
 * current heading) is deliberately left out so this block stays byte-identical
 * across a thread and keeps its prompt-cache entry.
 */
function buildContextBlock(ctx: TeacherContext): string {
  const lines: string[] = []

  lines.push(`# Course: ${ctx.courseTitle}`)
  const outline = ctx.outline
  if (outline) {
    lines.push('')
    if (outline.subtitle) lines.push(outline.subtitle)
    if (outline.description) lines.push('', outline.description)
    lines.push(
      '',
      `Progress: ${outline.lessonsCompleted} of ${outline.lessonsTotal} lessons marked complete.`,
      '',
      '## Course outline',
      '',
      'Legend: [x] finished · [ ] not yet · ← the lesson currently open.',
      'The value in parentheses is the id to use when linking, e.g. `[title](lesson:day-12)`.',
      ''
    )

    for (const chapter of outline.chapters) {
      const scored = chapter.testBest === undefined ? 'not attempted' : `best ${chapter.testBest}%`
      lines.push(`### ${chapter.title}`)
      for (const lesson of chapter.lessons) {
        lines.push(
          `- [${lesson.done ? 'x' : ' '}] (${lesson.id}) ${lesson.title}${lesson.current ? '  ←' : ''}`
        )
      }
      if (chapter.testId) {
        lines.push(`- (test) (${chapter.testId}) ${chapter.testTitle} — ${scored}`)
      }
      lines.push('')
    }
  }

  lines.push(ctx.kind === 'lesson' ? '# Current lesson' : '# Test review')
  lines.push('')
  if (ctx.chapterTitle) lines.push(`Chapter: ${ctx.chapterTitle}`)
  lines.push(ctx.kind === 'lesson' ? `Lesson: ${ctx.lessonTitle}` : `Test: ${ctx.lessonTitle}`)

  if (ctx.objectives?.length) {
    lines.push('', '## Learning objectives', ...ctx.objectives.map((o) => `- ${o}`))
  }

  if (ctx.keyTerms?.length) {
    lines.push('', '## Key terms', ...ctx.keyTerms.map((t) => `- **${t.term}** — ${t.definition}`))
  }

  lines.push('', ctx.kind === 'lesson' ? '## Lesson material' : '## What the learner got wrong')
  lines.push('', ctx.body)

  return lines.join('\n')
}

/** Volatile position hints. These ride in the user turn, after the cache breakpoint. */
function buildPositionNote(ctx: TeacherContext): string | null {
  if (ctx.kind !== 'lesson') return null
  const parts: string[] = []
  if (ctx.currentHeading) parts.push(`reading the section "${ctx.currentHeading}"`)
  if (typeof ctx.scrollPercent === 'number') {
    parts.push(`about ${Math.round(ctx.scrollPercent * 100)}% through the lesson`)
  }
  if (parts.length === 0) return null
  return `[The learner is currently ${parts.join(', ')}.]`
}

/* ------------------------------------------------------------------ *
 * Content blocks
 * ------------------------------------------------------------------ */

interface ResolvedAttachment {
  kind: TeacherAttachment['kind']
  name: string
  mediaType: string
  data: string
}

function attachmentBlock(item: ResolvedAttachment): BetaContentBlockParam {
  if (item.kind === 'image' && isImageMediaType(item.mediaType)) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: item.mediaType, data: item.data }
    }
  }

  if (item.kind === 'pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: item.data },
      title: item.name
    }
  }

  // Text files are cheaper and more legible inlined as fenced code than as
  // document blocks.
  const text = Buffer.from(item.data, 'base64').toString('utf8')
  return {
    type: 'text',
    text: `Attached file \`${item.name}\`:\n\n\`\`\`${fenceLanguageFor(item.name)}\n${text}\n\`\`\``
  }
}

/** Media first, then the question — the model grounds better in that order. */
function userTurn(text: string, attachments: ResolvedAttachment[]): BetaMessageParam {
  const content: BetaContentBlockParam[] = attachments.map(attachmentBlock)
  if (text.trim()) content.push({ type: 'text', text })
  if (content.length === 0) content.push({ type: 'text', text: '(no message)' })
  return { role: 'user', content }
}

function placeholderFor(item: TeacherAttachment): BetaContentBlockParam {
  return {
    type: 'text',
    text: `[${item.kind}: ${item.name} — attached earlier, no longer in context. Ask the learner to re-attach it if you need to look at it again.]`
  }
}

async function buildHistory(history: TeacherMessage[]): Promise<BetaMessageParam[]> {
  // Work out which user turns still get their bytes re-sent.
  const rehydrate = new Set<string>()
  for (let i = history.length - 1; i >= 0 && rehydrate.size < REHYDRATE_TURNS; i -= 1) {
    const message = history[i]
    if (message.role === 'user' && message.attachments?.length) rehydrate.add(message.id)
  }

  const messages: BetaMessageParam[] = []

  for (const message of history) {
    if (message.error) continue

    if (message.role === 'assistant') {
      if (!message.text.trim()) continue
      messages.push({ role: 'assistant', content: [{ type: 'text', text: message.text }] })
      continue
    }

    const attachments = message.attachments ?? []
    if (attachments.length === 0) {
      messages.push(userTurn(message.text, []))
      continue
    }

    if (!rehydrate.has(message.id)) {
      const content: BetaContentBlockParam[] = attachments.map(placeholderFor)
      if (message.text.trim()) content.push({ type: 'text', text: message.text })
      messages.push({ role: 'user', content })
      continue
    }

    const resolved: ResolvedAttachment[] = []
    const missing: TeacherAttachment[] = []
    for (const item of attachments) {
      const data = await readAttachment(item.file)
      if (data) resolved.push({ ...item, data })
      else missing.push(item)
    }

    const content: BetaContentBlockParam[] = [
      ...resolved.map(attachmentBlock),
      ...missing.map(placeholderFor)
    ]
    if (message.text.trim()) content.push({ type: 'text', text: message.text })
    messages.push({ role: 'user', content })
  }

  return messages
}

/* ------------------------------------------------------------------ *
 * Streaming
 * ------------------------------------------------------------------ */

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'Your API key was rejected. Check it in Settings → Teacher.'
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return 'This API key does not have access to Claude Opus 5.'
  }
  if (err instanceof Anthropic.RateLimitError) {
    return 'Rate limited by the API. Wait a moment and try again.'
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the Anthropic API. Check your internet connection.'
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `The request was rejected: ${err.message}`
  }
  if (err instanceof Anthropic.APIError) {
    return `The API returned an error (${err.status ?? 'unknown'}). Try again.`
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong talking to the API.'
}

export function abort(requestId: string): void {
  inFlight.get(requestId)?.abort()
  inFlight.delete(requestId)
}

export function abortAll(): void {
  for (const controller of inFlight.values()) controller.abort()
  inFlight.clear()
}

export async function streamTeacher(
  win: BrowserWindow,
  request: TeacherSendRequest,
  attachments: PendingAttachment[]
): Promise<void> {
  const { requestId } = request

  const emit = (event: TeacherStreamEvent): void => {
    if (!win.isDestroyed()) win.webContents.send(CH.aiStreamEvent, event)
  }

  const anthropic = getClient()
  if (!anthropic) {
    emit({ requestId, type: 'error', message: 'No API key configured.' })
    return
  }

  const controller = new AbortController()
  inFlight.set(requestId, controller)

  try {
    const history = await buildHistory(request.history)
    const positionNote = buildPositionNote(request.context)
    const prompt = positionNote ? `${positionNote}\n\n${request.prompt}` : request.prompt

    const messages: BetaMessageParam[] = [
      ...history,
      userTurn(
        prompt,
        attachments.map((a) => ({
          kind: a.kind,
          name: a.name,
          mediaType: a.mediaType,
          data: a.data
        }))
      )
    ]

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const stream = anthropic.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: 'adaptive', display: 'summarized' },
          output_config: { effort: 'high' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          tools: [PROPOSE_COURSE_TOOL],
          system: [
            { type: 'text', text: SYSTEM_PROMPT },
            {
              type: 'text',
              text: buildContextBlock(request.context),
              // Caches the system prompt and the whole lesson body, so every
              // follow-up in this thread re-reads it at ~10% of input price.
              cache_control: { type: 'ephemeral' }
            }
          ],
          messages
        },
        { signal: controller.signal }
      )

      for await (const event of stream) {
        if (event.type !== 'content_block_delta') continue
        if (event.delta.type === 'text_delta') {
          emit({ requestId, type: 'text-delta', text: event.delta.text })
        } else if (event.delta.type === 'thinking_delta') {
          emit({ requestId, type: 'thinking-delta', text: event.delta.thinking })
        }
      }

      const final = await stream.finalMessage()

      // Check the stop reason before trusting `content` — a refusal can arrive
      // with an empty or partial content array.
      if (final.stop_reason === 'refusal') {
        emit({
          requestId,
          type: 'error',
          message:
            'Claude declined to answer that one. Try rephrasing, or ask about the lesson material directly.'
        })
        return
      }

      if (final.stop_reason !== 'tool_use') {
        emit({ requestId, type: 'done', stopReason: final.stop_reason, model: final.model })
        return
      }

      // Thinking and tool_use blocks have to ride back unedited for the next turn.
      messages.push({ role: 'assistant', content: final.content as BetaContentBlockParam[] })

      const results: BetaContentBlockParam[] = []
      for (const block of final.content) {
        if (block.type !== 'tool_use') continue
        const proposal = briefFromToolInput(block.input)
        if (proposal) emit({ requestId, type: 'course-proposal', proposal })
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: proposal
            ? 'The proposal card is now showing under your message. The learner can edit it and press Build, or ignore it.'
            : 'That proposal was missing a topic, so nothing was shown. Ask the learner what the course should cover.',
          is_error: !proposal
        })
      }
      messages.push({ role: 'user', content: results })
    }

    // Ran out of rounds with the model still calling tools; close the turn out
    // rather than leaving the renderer waiting forever.
    emit({ requestId, type: 'done', stopReason: 'tool_use', model: MODEL })
  } catch (err) {
    if (controller.signal.aborted) {
      emit({ requestId, type: 'done', stopReason: 'aborted', model: MODEL })
      return
    }
    emit({ requestId, type: 'error', message: describeError(err) })
  } finally {
    inFlight.delete(requestId)
  }
}
