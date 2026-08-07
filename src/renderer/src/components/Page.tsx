import { cn } from '@/lib/utils'

export function Page({
  children,
  className,
  wide
}: {
  children: React.ReactNode
  className?: string
  wide?: boolean
}): React.JSX.Element {
  return (
    <div className="scroll-area h-full">
      <div className={cn('mx-auto px-8 py-8', wide ? 'max-w-6xl' : 'max-w-4xl', className)}>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-7 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="text-ink-subtle">{icon}</div>}
      <div>
        <div className="text-[15px] font-medium">{title}</div>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
      {children}
    </h2>
  )
}
