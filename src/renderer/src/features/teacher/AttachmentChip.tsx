import { FileText, FileType2, ImageIcon, X } from 'lucide-react'
import { formatBytes } from '@shared/attachments'
import type { AttachmentKind } from '@shared/types'
import { cn } from '@/lib/utils'

export interface ChipAttachment {
  id: string
  kind: AttachmentKind
  name: string
  sizeBytes: number
  thumb?: string
}

function KindIcon({ kind }: { kind: AttachmentKind }): React.JSX.Element {
  if (kind === 'image') return <ImageIcon size={13} />
  if (kind === 'pdf') return <FileType2 size={13} />
  return <FileText size={13} />
}

/**
 * One attachment, used both in the composer tray (with a remove button) and
 * inside a sent message bubble (read-only, images clickable).
 */
export function AttachmentChip({
  attachment,
  onRemove,
  onOpen,
  className
}: {
  attachment: ChipAttachment
  onRemove?: () => void
  onOpen?: () => void
  className?: string
}): React.JSX.Element {
  const clickable = Boolean(onOpen) && attachment.kind === 'image'

  return (
    <div
      className={cn(
        'group flex max-w-[190px] items-center gap-1.5 rounded-lg border border-line py-1 pl-1 pr-1.5 text-[11px]',
        className
      )}
      style={{ background: 'var(--surface-2)' }}
      title={`${attachment.name} · ${formatBytes(attachment.sizeBytes)}`}
    >
      {attachment.thumb ? (
        <img
          src={attachment.thumb}
          alt=""
          className={cn('h-7 w-7 shrink-0 rounded object-cover', clickable && 'cursor-zoom-in')}
          onClick={clickable ? onOpen : undefined}
        />
      ) : (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
          style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}
        >
          <KindIcon kind={attachment.kind} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{attachment.name}</span>
        <span className="block text-ink-subtle">{formatBytes(attachment.sizeBytes)}</span>
      </span>

      {onRemove && (
        <button
          type="button"
          className="btn btn-ghost h-5 w-5 shrink-0 !rounded-md !px-0"
          onClick={onRemove}
          aria-label={`Remove ${attachment.name}`}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
