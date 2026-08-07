import { CheckCircle2, Flame, Info, Lightbulb, TriangleAlert } from 'lucide-react'

type HintType = 'info' | 'tip' | 'warning' | 'danger' | 'success'

const CONFIG: Record<HintType, { icon: typeof Info; color: string; soft: string; label: string }> =
  {
    info: { icon: Info, color: 'var(--info)', soft: 'var(--info-soft)', label: 'Note' },
    tip: { icon: Lightbulb, color: 'var(--accent)', soft: 'var(--accent-soft)', label: 'Tip' },
    warning: {
      icon: TriangleAlert,
      color: 'var(--warning)',
      soft: 'var(--warning-soft)',
      label: 'Careful'
    },
    danger: { icon: Flame, color: 'var(--danger)', soft: 'var(--danger-soft)', label: 'Watch out' },
    success: {
      icon: CheckCircle2,
      color: 'var(--success)',
      soft: 'var(--success-soft)',
      label: 'Good to know'
    }
  }

export function Hint({
  children,
  ...props
}: {
  children?: React.ReactNode
  'data-type'?: string
  'data-title'?: string
}): React.JSX.Element {
  const type = (props['data-type'] ?? 'info') as HintType
  const config = CONFIG[type] ?? CONFIG.info
  const Icon = config.icon
  const title = props['data-title'] ?? config.label

  return (
    <aside
      className="my-5 flex gap-3 rounded-lg border px-4 py-3"
      style={{ background: config.soft, borderColor: `color-mix(in oklab, ${config.color} 30%, transparent)` }}
    >
      <Icon size={17} className="mt-0.5 shrink-0" style={{ color: config.color }} />
      <div className="min-w-0 flex-1 [&>*:last-child]:mb-0">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide" style={{ color: config.color }}>
          {title}
        </div>
        {children}
      </div>
    </aside>
  )
}
