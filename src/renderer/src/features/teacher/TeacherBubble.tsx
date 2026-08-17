import { useState } from 'react'
import { AlertTriangle, ChevronRight, Sparkles } from 'lucide-react'
import type { CourseBrief, TeacherAttachment, TeacherMessage } from '@shared/types'
import { Markdown } from '@/markdown/Markdown'
import { useCourseGen } from '@/stores/courseGen'
import { useUi } from '@/stores/ui'
import { cn } from '@/lib/utils'
import { AttachmentChip } from './AttachmentChip'

/**
 * A course the Teacher offered to build. Nothing is generated until the learner
 * opens it and confirms — this is an invitation into the Create panel, not a job.
 */
function CourseProposalCard({ proposal }: { proposal: CourseBrief }): React.JSX.Element {
  const openPanel = useCourseGen((s) => s.openPanel)
  const closeTeacher = useUi((s) => s.setTeacherOpen)

  const lessons = proposal.chapters * proposal.lessonsPerChapter

  return (
    <div
      className="mt-2 rounded-xl border border-line p-3"
      style={{ background: 'var(--surface)' }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
        >
          <Sparkles size={13} />
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold">{proposal.topic}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-subtle">
            {proposal.chapters} chapters · {lessons} lessons · {proposal.difficulty}
            {proposal.includeTests && ' · with tests'}
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary mt-2.5 h-7 w-full text-[12px]"
        onClick={() => {
          closeTeacher(false)
          openPanel(proposal)
        }}
      >
        Review and build
      </button>
    </div>
  )
}

/** Collapsible summary of the model's reasoning, shown above its answer. */
function ThinkingDisclosure({
  text,
  streaming
}: {
  text: string
  streaming: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-1.5">
      <button
        type="button"
        className="flex items-center gap-1 text-[11px] text-ink-subtle transition-colors hover:text-ink-muted"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          size={11}
          className="transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : undefined }}
        />
        <Sparkles size={11} />
        {streaming ? 'Thinking…' : 'Thought this through'}
      </button>

      {open && (
        <div
          className="mt-1 rounded-lg border border-line px-2.5 py-2 text-[12px] leading-relaxed whitespace-pre-wrap text-ink-muted"
          style={{ background: 'var(--surface-2)' }}
        >
          {text}
        </div>
      )}
    </div>
  )
}

export function TeacherBubble({
  message,
  onOpenImage
}: {
  message: TeacherMessage
  onOpenImage?: (attachment: TeacherAttachment) => void
}): React.JSX.Element {
  const isUser = message.role === 'user'

  if (message.error && !message.text.trim()) {
    return (
      <div
        className="flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[12.5px]"
        style={{
          background: 'var(--danger-soft)',
          borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)'
        }}
      >
        <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
        <span>{message.error}</span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      {message.attachments && message.attachments.length > 0 && (
        <div className={cn('flex flex-wrap gap-1.5', isUser && 'justify-end')}>
          {message.attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              onOpen={onOpenImage ? () => onOpenImage(attachment) : undefined}
            />
          ))}
        </div>
      )}

      {isUser ? (
        message.text.trim() && (
          <div
            className="max-w-[85%] rounded-xl rounded-br-sm px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
          >
            {message.text}
          </div>
        )
      ) : (
        <div className="w-full">
          {message.thinking && <ThinkingDisclosure text={message.thinking} streaming={false} />}
          <Markdown className="!max-w-none" style={{ ['--reader-size' as string]: '13px' }}>
            {message.text}
          </Markdown>
          {message.proposal && <CourseProposalCard proposal={message.proposal} />}
          {message.error && (
            <p className="mt-1 text-[11.5px]" style={{ color: 'var(--danger)' }}>
              {message.error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** The in-flight answer: streamed thinking, then streamed text. */
export function StreamingBubble({
  text,
  thinking,
  waiting,
  showThinking,
  proposal
}: {
  text: string
  thinking: string
  waiting: boolean
  showThinking: boolean
  proposal?: CourseBrief
}): React.JSX.Element {
  return (
    <div className="w-full">
      {showThinking && thinking && <ThinkingDisclosure text={thinking} streaming={!text} />}

      {text ? (
        <Markdown className="!max-w-none" style={{ ['--reader-size' as string]: '13px' }}>
          {text}
        </Markdown>
      ) : (
        waiting &&
        !proposal && (
          <div className="teacher-dots flex items-center gap-1 py-1" aria-label="Thinking">
            <span />
            <span />
            <span />
          </div>
        )
      )}

      {proposal && <CourseProposalCard proposal={proposal} />}
    </div>
  )
}
