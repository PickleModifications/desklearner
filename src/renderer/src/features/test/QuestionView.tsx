import { useMemo } from 'react'
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { AnswerValue, Question } from '@shared/types'
import { cn, seededShuffle } from '@/lib/utils'
import { Markdown } from '@/markdown/Markdown'

export interface QuestionViewProps {
  question: Question
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
  /** After submitting, inputs lock and correctness is shown. */
  review?: boolean
  correct?: boolean
  seed: string
}

export function QuestionView(props: QuestionViewProps): React.JSX.Element {
  const { question } = props
  switch (question.type) {
    case 'single':
    case 'boolean':
      return <ChoiceQuestion {...props} multiple={false} />
    case 'multi':
      return <ChoiceQuestion {...props} multiple />
    case 'short':
      return <ShortQuestion {...props} />
    case 'ordering':
      return <OrderingQuestion {...props} />
    case 'matching':
      return <MatchingQuestion {...props} />
    case 'fill-blank':
      return <FillBlankQuestion {...props} />
  }
}

/* ------------------------------------------------------- choice / boolean */

function ChoiceQuestion({
  question,
  value,
  onChange,
  review,
  multiple
}: QuestionViewProps & { multiple: boolean }): React.JSX.Element {
  const options =
    question.type === 'boolean'
      ? ['True', 'False']
      : 'options' in question
        ? question.options
        : []

  const correctSet = new Set<number>(
    question.type === 'boolean'
      ? [question.answer ? 0 : 1]
      : question.type === 'single'
        ? [question.answer]
        : question.type === 'multi'
          ? question.answer
          : []
  )

  const selected = new Set<number>(
    question.type === 'multi'
      ? ((value as number[]) ?? [])
      : question.type === 'boolean'
        ? value === undefined
          ? []
          : [value === true ? 0 : 1]
        : value === undefined
          ? []
          : [value as number]
  )

  const toggle = (i: number): void => {
    if (review) return
    if (question.type === 'multi') {
      const next = new Set(selected)
      next.has(i) ? next.delete(i) : next.add(i)
      onChange([...next].sort((a, b) => a - b))
    } else if (question.type === 'boolean') {
      onChange(i === 0)
    } else {
      onChange(i)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {options.map((option, i) => {
        const isSelected = selected.has(i)
        const isCorrect = correctSet.has(i)
        const tone = review
          ? isCorrect
            ? 'correct'
            : isSelected
              ? 'wrong'
              : 'idle'
          : isSelected
            ? 'selected'
            : 'idle'

        return (
          <button
            key={i}
            type="button"
            disabled={review}
            onClick={() => toggle(i)}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left text-[13.5px] transition-colors',
              !review && 'hover:border-line-strong'
            )}
            style={{
              background:
                tone === 'correct'
                  ? 'var(--success-soft)'
                  : tone === 'wrong'
                    ? 'var(--danger-soft)'
                    : tone === 'selected'
                      ? 'var(--accent-soft)'
                      : 'var(--surface)',
              borderColor:
                tone === 'correct'
                  ? 'var(--success)'
                  : tone === 'wrong'
                    ? 'var(--danger)'
                    : tone === 'selected'
                      ? 'var(--accent)'
                      : 'var(--border)'
            }}
          >
            <span
              className={cn(
                'mt-px flex h-5 w-5 shrink-0 items-center justify-center border text-[11px] font-semibold',
                multiple ? 'rounded' : 'rounded-full'
              )}
              style={{
                borderColor:
                  tone === 'correct'
                    ? 'var(--success)'
                    : tone === 'wrong'
                      ? 'var(--danger)'
                      : tone === 'selected'
                        ? 'var(--accent)'
                        : 'var(--border-strong)',
                background:
                  tone === 'selected' ? 'var(--accent)' : 'transparent',
                color: tone === 'selected' ? 'var(--accent-contrast)' : undefined
              }}
            >
              {review && isCorrect ? (
                <Check size={12} style={{ color: 'var(--success)' }} />
              ) : review && isSelected ? (
                <X size={12} style={{ color: 'var(--danger)' }} />
              ) : (
                String.fromCharCode(65 + i)
              )}
            </span>
            <span className="min-w-0 flex-1">{option}</span>
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------------- short */

function ShortQuestion({ question, value, onChange, review, correct }: QuestionViewProps): React.JSX.Element {
  if (question.type !== 'short') return <></>
  return (
    <div>
      <input
        className="input max-w-lg"
        placeholder={question.placeholder ?? 'Type your answer…'}
        value={(value as string) ?? ''}
        disabled={review}
        onChange={(e) => onChange(e.target.value)}
        style={
          review
            ? {
                borderColor: correct ? 'var(--success)' : 'var(--danger)',
                background: correct ? 'var(--success-soft)' : 'var(--danger-soft)'
              }
            : undefined
        }
      />
      {review && !correct && (
        <p className="mt-2 text-[12.5px] text-ink-muted">
          Accepted answers: <strong>{question.accepted.join(', ')}</strong>
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- ordering */

function OrderingQuestion({
  question,
  value,
  onChange,
  review,
  seed
}: QuestionViewProps): React.JSX.Element {
  const initial = useMemo(
    () => (question.type === 'ordering' ? seededShuffle(question.items, seed + question.id) : []),
    [question, seed]
  )
  if (question.type !== 'ordering') return <></>

  const order = (value as string[]) ?? initial

  const move = (from: number, to: number): void => {
    if (review || to < 0 || to >= order.length) return
    const next = [...order]
    ;[next[from], next[to]] = [next[to], next[from]]
    onChange(next)
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {order.map((item, i) => {
        const rightPlace = review && question.answer[i] === item
        return (
          <li
            key={item}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px]"
            style={{
              background: review
                ? rightPlace
                  ? 'var(--success-soft)'
                  : 'var(--danger-soft)'
                : 'var(--surface)',
              borderColor: review
                ? rightPlace
                  ? 'var(--success)'
                  : 'var(--danger)'
                : 'var(--border)'
            }}
          >
            <span className="w-5 shrink-0 text-center text-[11.5px] font-semibold text-ink-subtle tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">{item}</span>
            {!review && (
              <span className="flex shrink-0 flex-col">
                <button
                  className="text-ink-subtle hover:text-ink disabled:opacity-30"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  className="text-ink-subtle hover:text-ink disabled:opacity-30"
                  onClick={() => move(i, i + 1)}
                  disabled={i === order.length - 1}
                  aria-label="Move down"
                >
                  <ChevronDown size={14} />
                </button>
              </span>
            )}
          </li>
        )
      })}
      {review && (
        <li className="mt-1 text-[12.5px] text-ink-muted">
          Correct order: {question.answer.map((a, i) => `${i + 1}. ${a}`).join('  ·  ')}
        </li>
      )}
    </ol>
  )
}

/* ------------------------------------------------------------- matching */

function MatchingQuestion({
  question,
  value,
  onChange,
  review,
  seed
}: QuestionViewProps): React.JSX.Element {
  const choices = useMemo(
    () =>
      question.type === 'matching'
        ? seededShuffle(
            question.pairs.map((p) => p.right),
            seed + question.id
          )
        : [],
    [question, seed]
  )
  if (question.type !== 'matching') return <></>

  const map = ((value as Record<string, string>) ?? {}) as Record<string, string>

  return (
    <div className="flex flex-col gap-2">
      {question.pairs.map((pair) => {
        const picked = map[pair.left] ?? ''
        const right = review && picked === pair.right
        return (
          <div
            key={pair.left}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border px-3 py-2"
            style={{
              background: review
                ? right
                  ? 'var(--success-soft)'
                  : 'var(--danger-soft)'
                : 'var(--surface)',
              borderColor: review ? (right ? 'var(--success)' : 'var(--danger)') : 'var(--border)'
            }}
          >
            <span className="text-[13.5px]">{pair.left}</span>
            <span className="text-ink-subtle">→</span>
            <select
              className="input !py-1"
              value={picked}
              disabled={review}
              onChange={(e) => onChange({ ...map, [pair.left]: e.target.value })}
            >
              <option value="">Select…</option>
              {choices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
            {review && !right && (
              <span className="col-span-3 text-[12px] text-ink-muted">
                Correct: <strong>{pair.right}</strong>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------------- fill blank */

function FillBlankQuestion({ question, value, onChange, review }: QuestionViewProps): React.JSX.Element {
  if (question.type !== 'fill-blank') return <></>
  const values = ((value as string[]) ?? question.blanks.map(() => '')) as string[]
  const parts = question.text.split(/\{\{(\d+)\}\}/g)

  return (
    <div>
      <p className="text-[14px] leading-loose">
        {parts.map((part, i) => {
          if (i % 2 === 0) return <span key={i}>{part}</span>
          const slot = Number(part)
          const accepted = question.blanks[slot] ?? []
          const given = values[slot] ?? ''
          const right =
            review && accepted.some((a) => a.trim().toLowerCase() === given.trim().toLowerCase())
          return (
            <input
              key={i}
              className="mx-1 inline-block w-36 rounded border-b-2 border-line-strong bg-transparent px-1.5 py-0.5 text-[13.5px] outline-none focus:border-accent"
              value={given}
              disabled={review}
              onChange={(e) => {
                const next = [...values]
                next[slot] = e.target.value
                onChange(next)
              }}
              style={
                review
                  ? {
                      borderColor: right ? 'var(--success)' : 'var(--danger)',
                      background: right ? 'var(--success-soft)' : 'var(--danger-soft)'
                    }
                  : undefined
              }
            />
          )
        })}
      </p>
      {review && (
        <p className="mt-2 text-[12.5px] text-ink-muted">
          Answers: {question.blanks.map((b, i) => `${i + 1}. ${b[0]}`).join('  ·  ')}
        </p>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- prompt */

export function QuestionPrompt({ prompt }: { prompt: string }): React.JSX.Element {
  return (
    <Markdown
      className="!max-w-none"
      style={{ ['--reader-size' as string]: '14.5px', ['--reader-width' as string]: 'none' }}
    >
      {prompt}
    </Markdown>
  )
}
