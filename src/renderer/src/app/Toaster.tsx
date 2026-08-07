import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useUi } from '@/stores/ui'

const toneIcon = {
  info: Info,
  success: CheckCircle2,
  error: TriangleAlert
}

const toneColor = {
  info: 'var(--info)',
  success: 'var(--success)',
  error: 'var(--danger)'
}

export function Toaster(): React.JSX.Element {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-100 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = toneIcon[t.tone]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-96 items-start gap-2.5 rounded-lg border
              border-line px-3 py-2.5 text-[13px] shadow-e3"
            style={{ background: 'var(--surface)' }}
            role="status"
          >
            <Icon size={16} style={{ color: toneColor[t.tone] }} className="mt-px shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              className="text-ink-subtle hover:text-ink"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
