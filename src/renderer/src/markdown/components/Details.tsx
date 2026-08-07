import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

export function Details({
  children,
  ...props
}: {
  children?: React.ReactNode
  'data-summary'?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const summary = props['data-summary'] ?? 'Show answer'

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-line">
      <button
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-[var(--surface-2)]"
        style={{ background: open ? 'var(--surface-2)' : 'var(--surface)' }}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <ChevronRight
          size={15}
          className="shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : undefined, color: 'var(--accent)' }}
        />
        {summary}
      </button>
      {open && (
        <div
          className="border-t border-line px-4 py-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          style={{ background: 'var(--surface)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
