import { useState } from 'react'
import { Check, CircleHelp, RotateCcw, X } from 'lucide-react'
import YAML from 'yaml'
import { cn } from '@/lib/utils'

interface QuizSpec {
  question: string
  options: string[]
  /** Index of the correct option, or a list of indices for multiple answers. */
  answer: number | number[]
  explanation?: string
}

function parseQuiz(source: string): QuizSpec | null {
  try {
    const raw = YAML.parse(source) as Partial<QuizSpec>
    if (!raw?.question || !Array.isArray(raw.options) || raw.answer === undefined) return null
    return {
      question: raw.question,
      options: raw.options,
      answer: raw.answer,
      explanation: raw.explanation
    }
  } catch {
    return null
  }
}

/** Inline knowledge check authored as a ```quiz fenced block of YAML. */
export function InlineQuiz({ source }: { source: string }): React.JSX.Element {
  const spec = parseQuiz(source)
  const [picked, setPicked] = useState<number | null>(null)

  if (!spec) {
    return (
      <pre className="my-4 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--danger)' }}>
        Malformed quiz block
      </pre>
    )
  }

  const correct = Array.isArray(spec.answer) ? spec.answer : [spec.answer]
  const answered = picked !== null
  const isRight = answered && correct.includes(picked)

  return (
    <div
      className="my-5 rounded-lg border px-4 py-3.5"
      style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--accent-text)' }}>
        <CircleHelp size={14} />
        Knowledge check
      </div>

      <p className="mb-3 text-[0.97em] font-medium">{spec.question}</p>

      <div className="flex flex-col gap-1.5">
        {spec.options.map((option, i) => {
          const state = !answered
            ? 'idle'
            : correct.includes(i)
              ? 'correct'
              : picked === i
                ? 'wrong'
                : 'idle'
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setPicked(i)}
              className={cn(
                'flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-[0.93em] transition-colors',
                !answered && 'hover:border-accent'
              )}
              style={{
                background:
                  state === 'correct'
                    ? 'var(--success-soft)'
                    : state === 'wrong'
                      ? 'var(--danger-soft)'
                      : 'var(--surface)',
                borderColor:
                  state === 'correct'
                    ? 'var(--success)'
                    : state === 'wrong'
                      ? 'var(--danger)'
                      : 'var(--border)'
              }}
            >
              <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
                style={{ borderColor: 'var(--border-strong)' }}>
                {state === 'correct' ? (
                  <Check size={11} style={{ color: 'var(--success)' }} />
                ) : state === 'wrong' ? (
                  <X size={11} style={{ color: 'var(--danger)' }} />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span>{option}</span>
            </button>
          )
        })}
      </div>

      {answered && (
        <div className="mt-3 flex items-start gap-2 text-[0.9em]">
          <span
            className="mt-px shrink-0 font-semibold"
            style={{ color: isRight ? 'var(--success)' : 'var(--danger)' }}
          >
            {isRight ? 'Correct.' : 'Not quite.'}
          </span>
          <span className="flex-1 text-ink-muted">{spec.explanation}</span>
          <button
            className="btn btn-ghost h-6 shrink-0 !px-2 text-[11px]"
            onClick={() => setPicked(null)}
          >
            <RotateCcw size={11} /> Retry
          </button>
        </div>
      )}
    </div>
  )
}
