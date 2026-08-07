import type {
  AnswerValue,
  CourseOutline,
  CoursePack,
  LessonDocument,
  ProgressState,
  Question,
  TeacherContext,
  TestAttempt,
  TestDocument
} from '@shared/types'
import { bestAttempt, getLesson } from '@/stores/progress'

/** Preset openers shown in an empty thread. */
export const QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Explain this simply',
    prompt: 'Explain the main idea of this lesson as simply as you can, as if I am new to it.'
  },
  {
    label: 'Give me an analogy',
    prompt: 'Give me a concrete analogy for the central concept in this lesson.'
  },
  {
    label: 'Quiz me',
    prompt:
      'Ask me three questions about this lesson, one at a time. Wait for my answer before asking the next one, and tell me whether I was right.'
  },
  {
    label: 'How is this used on the job?',
    prompt:
      'How does what this lesson covers actually show up in day-to-day work? Give me a realistic scenario.'
  },
  {
    label: 'What will I get wrong?',
    prompt:
      'What do people most often misunderstand about this material, and how do I avoid making those mistakes?'
  }
]

/**
 * Compresses the whole course into titles plus completion state. Bodies are
 * excluded — this is a map, not the material — so it stays cheap enough to send
 * on every turn while letting the Teacher say "you covered that on day 12" or
 * "that's coming in week 4" instead of answering in a vacuum.
 */
export function courseOutline(
  pack: CoursePack,
  progress: ProgressState,
  current?: { chapterId: string; lessonId: string }
): CourseOutline {
  const courseId = pack.manifest.id
  let lessonsCompleted = 0
  let lessonsTotal = 0

  const chapters = pack.manifest.chapters.map((chapter) => {
    const lessons = chapter.lessons.map((lesson) => {
      const done = getLesson(progress, courseId, chapter.id, lesson.id).status === 'complete'
      lessonsTotal += 1
      if (done) lessonsCompleted += 1
      return {
        id: lesson.id,
        title: lesson.title,
        done,
        current:
          current?.chapterId === chapter.id && current?.lessonId === lesson.id ? true : undefined
      }
    })

    const best = chapter.test ? bestAttempt(progress, courseId, chapter.test.id) : undefined

    return {
      id: chapter.id,
      title: chapter.title,
      lessons,
      testId: chapter.test?.id,
      testTitle: chapter.test?.title,
      testBest: best ? Math.round(best.percent) : undefined
    }
  })

  return {
    subtitle: pack.manifest.subtitle,
    description: pack.manifest.description,
    chapters,
    lessonsCompleted,
    lessonsTotal
  }
}

/** Builds the prompt context for the lesson the learner is reading. */
export function lessonContext(
  doc: LessonDocument,
  courseTitle: string,
  chapterTitle: string,
  outline?: CourseOutline,
  position: { currentHeading?: string; scrollPercent?: number } = {}
): TeacherContext {
  const fm = doc.frontmatter ?? {}
  return {
    kind: 'lesson',
    courseId: doc.courseId,
    courseTitle,
    chapterTitle,
    lessonTitle: fm.title ?? doc.lessonId,
    body: doc.markdown,
    objectives: fm.objectives,
    keyTerms: fm.keyTerms,
    outline,
    currentHeading: position.currentHeading,
    scrollPercent: position.scrollPercent
  }
}

/**
 * Builds the context for the post-test explainer: only the questions the
 * learner actually got wrong, with their answer beside the correct one.
 */
export function testReviewContext(
  test: TestDocument,
  attempt: TestAttempt,
  courseId: string,
  courseTitle: string,
  outline?: CourseOutline
): TeacherContext {
  const byId = new Map(test.questions.map((q) => [q.id, q]))
  const missed = attempt.results.filter((r) => !r.correct)

  const body = missed
    .map((result, index) => {
      const question = byId.get(result.questionId)
      const lines: string[] = [`### ${index + 1}. ${question?.prompt ?? result.questionId}`]
      if (question?.type === 'fill-blank') lines.push(question.text)
      lines.push(`My answer: ${formatGiven(question, result.given)}`)
      lines.push(`Correct answer: ${correctAnswerText(question)}`)
      if (question?.explanation) lines.push(`Official explanation: ${question.explanation}`)
      return lines.join('\n\n')
    })
    .join('\n\n---\n\n')

  return {
    kind: 'test',
    courseId,
    courseTitle,
    lessonTitle: test.title,
    body: body || 'The learner answered every question correctly.',
    outline
  }
}

/** Renders an answer the learner gave, resolving option indices to their text. */
function formatGiven(question: Question | undefined, given: AnswerValue | undefined): string {
  if (given == null) return '(left blank)'

  if (question && (question.type === 'single' || question.type === 'multi')) {
    const indices = Array.isArray(given) ? given : [given]
    const labels = indices
      .map((i) => (typeof i === 'number' ? question.options[i] : String(i)))
      .filter(Boolean)
    return labels.length ? labels.join(', ') : '(left blank)'
  }

  if (typeof given === 'boolean') return given ? 'True' : 'False'
  if (Array.isArray(given)) return given.length ? given.map(String).join(' → ') : '(left blank)'
  if (typeof given === 'object') {
    return Object.entries(given)
      .map(([left, right]) => `${left} → ${right}`)
      .join('; ')
  }

  return String(given).trim() || '(left blank)'
}

/** `QuestionResult` records only what was given, so the answer comes from the question. */
function correctAnswerText(question: Question | undefined): string {
  if (!question) return '(unknown)'

  switch (question.type) {
    case 'single':
      return question.options[question.answer] ?? '(unknown)'
    case 'multi':
      return question.answer
        .map((i) => question.options[i])
        .filter(Boolean)
        .join(', ')
    case 'boolean':
      return question.answer ? 'True' : 'False'
    case 'short':
      return question.accepted.join(' / ')
    case 'ordering':
      return question.answer.join(' → ')
    case 'matching':
      return question.pairs.map((p) => `${p.left} → ${p.right}`).join('; ')
    case 'fill-blank':
      return question.blanks.map((options, i) => `${i + 1}. ${options.join(' / ')}`).join('; ')
    default:
      return '(unknown)'
  }
}

export const TEST_REVIEW_OPENER =
  'I just finished this test. Walk me through what I got wrong and what I misunderstood, one question at a time.'

/** Wraps a lesson excerpt the learner selected so the model knows it is a quote. */
export function quoteSelection(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  const excerpt = trimmed.length > 600 ? `${trimmed.slice(0, 600)}…` : trimmed
  return `About this part of the lesson:\n\n> ${excerpt}\n\n`
}
