import { useEffect } from 'react'

/** Centred overlay dialog used by the command palette and search. */
export function Modal({
  open,
  onClose,
  children,
  top = false,
  labelledBy
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  top?: boolean
  labelledBy?: string
}): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center px-4"
      style={{
        background: 'color-mix(in oklab, #000 42%, transparent)',
        alignItems: top ? 'flex-start' : 'center',
        paddingTop: top ? '9vh' : undefined
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal
      aria-labelledby={labelledBy}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-line shadow-e3"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {children}
      </div>
    </div>
  )
}
