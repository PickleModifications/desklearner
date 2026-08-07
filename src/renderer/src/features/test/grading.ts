import type { AnswerValue, Question, QuestionResult, TestDocument } from '@shared/types'
import { normaliseAnswer } from '@/lib/utils'

export function maxPoints(question: Question): number {
  return question.points ?? 1
}

function matchesText(given: string, accepted: string[], pattern?: string): boolean {
  const value = normaliseAnswer(given)
  if (!value) return false
  if (accepted.some((a) => normaliseAnswer(a) === value)) return true
  if (pattern) {
    try {
      return new RegExp(pattern, 'i').test(given.trim())
    } catch {
      return false
    }
  }
  return false
}

export function isAnswered(question: Question, given: AnswerValue | undefined): boolean {
  if (given === undefined || given === null) return false
  switch (question.type) {
    case 'multi':
      return Array.isArray(given) && given.length > 0
    case 'short':
      return typeof given === 'string' && given.trim().length > 0
    case 'ordering':
      return Array.isArray(given) && given.length === question.items.length
    case 'matching': {
      const map = given as Record<string, string>
      return Object.values(map).filter(Boolean).length === question.pairs.length
    }
    case 'fill-blank': {
      const values = given as string[]
      return (
        Array.isArray(values) &&
        values.length === question.blanks.length &&
        values.every((v) => v?.trim())
      )
    }
    default:
      return true
  }
}

export function gradeQuestion(question: Question, given: AnswerValue | undefined): QuestionResult {
  const max = maxPoints(question)
  const base = { questionId: question.id, maxPoints: max, given }

  let correct = false

  switch (question.type) {
    case 'single':
      correct = given === question.answer
      break

    case 'boolean':
      correct = given === question.answer
      break

    case 'multi': {
      const picked = Array.isArray(given) ? [...(given as number[])].sort() : []
      const expected = [...question.answer].sort()
      correct =
        picked.length === expected.length && picked.every((value, i) => value === expected[i])
      break
    }

    case 'short':
      correct =
        typeof given === 'string' && matchesText(given, question.accepted, question.pattern)
      break

    case 'ordering': {
      const order = Array.isArray(given) ? (given as string[]) : []
      correct =
        order.length === question.answer.length &&
        order.every((item, i) => item === question.answer[i])
      break
    }

    case 'matching': {
      const map = (given ?? {}) as Record<string, string>
      correct = question.pairs.every((pair) => map[pair.left] === pair.right)
      break
    }

    case 'fill-blank': {
      const values = Array.isArray(given) ? (given as string[]) : []
      correct =
        values.length === question.blanks.length &&
        question.blanks.every((accepted, i) => matchesText(values[i] ?? '', accepted))
      break
    }
  }

  return { ...base, correct, points: correct ? max : 0 }
}

export interface GradedTest {
  results: QuestionResult[]
  score: number
  maxScore: number
  percent: number
  passed: boolean
}

export function gradeTest(
  test: TestDocument,
  answers: Record<string, AnswerValue | undefined>
): GradedTest {
  const results = test.questions.map((q) => gradeQuestion(q, answers[q.id]))
  const score = results.reduce((sum, r) => sum + r.points, 0)
  const maxScore = results.reduce((sum, r) => sum + r.maxPoints, 0)
  const percent = maxScore ? (score / maxScore) * 100 : 0
  return { results, score, maxScore, percent, passed: percent >= test.passingScore }
}

export const TYPE_LABEL: Record<Question['type'], string> = {
  single: 'Choose one',
  multi: 'Choose all that apply',
  boolean: 'True or false',
  short: 'Short answer',
  ordering: 'Put in order',
  matching: 'Match the pairs',
  'fill-blank': 'Fill in the blanks'
}
