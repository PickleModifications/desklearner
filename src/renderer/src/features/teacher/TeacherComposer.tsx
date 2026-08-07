import { useEffect, useRef } from 'react'
import { ArrowUp, Paperclip, Square } from 'lucide-react'
import { validateAttachments } from '@shared/attachments'
import type { PendingAttachment } from '@shared/types'
import { useUi } from '@/stores/ui'
import { AttachmentChip } from './AttachmentChip'
import { filesFromTransfer, stageFiles } from './staging'

const MAX_TEXTAREA_HEIGHT = 140

export function TeacherComposer({
  value,
  onChange,
  attachments,
  onAttachmentsChange,
  onSend,
  onStop,
  streaming,
  disabled
}: {
  value: string
  onChange: (value: string) => void
  attachments: PendingAttachment[]
  onAttachmentsChange: (next: PendingAttachment[]) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  disabled?: boolean
}): React.JSX.Element {
  const toast = useUi((s) => s.toast)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grow with the content, up to a cap, then scroll.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [value])

  const canSend = !streaming && !disabled && (value.trim().length > 0 || attachments.length > 0)

  async function stage(files: File[]): Promise<void> {
    if (files.length === 0) return
    const { accepted, rejected } = await stageFiles(files, attachments)
    if (accepted.length) onAttachmentsChange([...attachments, ...accepted])
    for (const rejection of rejected) toast(`${rejection.name} — ${rejection.reason}`, 'error')
  }

  async function pickFiles(): Promise<void> {
    const result = await window.desklearner.ai.pickAttachments()
    for (const message of result.rejected) toast(message, 'error')

    // The dialog validated its own selection in isolation, so re-check against
    // what is already staged — otherwise the per-message count and size budgets
    // could be exceeded by pasting first and then picking.
    const { accepted, rejected } = validateAttachments(result.accepted, attachments)
    if (accepted.length) onAttachmentsChange([...attachments, ...accepted])
    for (const rejection of rejected) toast(`${rejection.name} — ${rejection.reason}`, 'error')
  }

  return (
    <div className="border-t border-line px-2.5 py-2">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              onRemove={() =>
                onAttachmentsChange(attachments.filter((a) => a.id !== attachment.id))
              }
            />
          ))}
        </div>
      )}

      <div
        className="flex items-end gap-1.5 rounded-xl border border-line px-1.5 py-1.5 transition-colors focus-within:border-accent"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <button
          type="button"
          className="btn btn-ghost h-7 w-7 shrink-0 !px-0"
          onClick={() => void pickFiles()}
          disabled={streaming || disabled}
          aria-label="Attach files"
          title="Attach images, PDFs or text files"
        >
          <Paperclip size={15} />
        </button>

        <textarea
          ref={textareaRef}
          className="max-h-[140px] min-h-[26px] flex-1 resize-none bg-transparent py-1 text-[13px] leading-relaxed outline-none"
          rows={1}
          placeholder={disabled ? 'Add an API key to start' : 'Ask about this lesson…'}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend) onSend()
            }
          }}
          onPaste={(e) => {
            const files = filesFromTransfer(e.clipboardData)
            // Only intercept when the clipboard actually carries files, so
            // pasting text keeps working normally.
            if (files.length === 0) return
            e.preventDefault()
            if (streaming || disabled) return
            void stage(files)
          }}
        />

        {streaming ? (
          <button
            type="button"
            className="btn btn-ghost h-7 w-7 shrink-0 !px-0"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop"
          >
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary h-7 w-7 shrink-0 !rounded-lg !px-0"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            <ArrowUp size={15} />
          </button>
        )}
      </div>

      <p className="mt-1 px-1 text-[10.5px] text-ink-subtle">
        Enter to send · Shift+Enter for a new line · paste or drop images and files
      </p>
    </div>
  )
}
