/** Small presentational directive wrappers: steps, checklist, cards, columns, kbd, term. */

export function Steps({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <div className="dl-steps my-5">{children}</div>
}

export function Checklist({
  children,
  ...props
}: {
  children?: React.ReactNode
  'data-title'?: string
}): React.JSX.Element {
  return (
    <div
      className="my-5 rounded-lg border border-line px-4 py-3"
      style={{ background: 'var(--surface-2)' }}
    >
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
        {props['data-title'] ?? 'Checklist'}
      </div>
      <div className="[&>*:last-child]:mb-0">{children}</div>
    </div>
  )
}

export function Cards({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <div className="my-5 grid gap-3 sm:grid-cols-2">{children}</div>
}

export function Card({
  children,
  ...props
}: {
  children?: React.ReactNode
  'data-title'?: string
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-line px-4 py-3" style={{ background: 'var(--surface)' }}>
      {props['data-title'] && (
        <div className="mb-1.5 text-[14px] font-semibold">{props['data-title']}</div>
      )}
      <div className="text-[0.95em] text-ink-muted [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </div>
  )
}

export function Columns({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <div className="my-5 grid gap-5 md:grid-cols-2">{children}</div>
}

export function Kbd({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return (
    <kbd
      className="mx-0.5 rounded border border-line-strong px-1.5 py-0.5 text-[0.78em] font-medium"
      style={{ background: 'var(--surface-2)', boxShadow: '0 1px 0 var(--border-strong)' }}
    >
      {children}
    </kbd>
  )
}

export function Term({
  children,
  ...props
}: {
  children?: React.ReactNode
  'data-def'?: string
}): React.JSX.Element {
  return (
    <span
      title={props['data-def']}
      className="cursor-help font-medium underline decoration-dotted underline-offset-3"
      style={{ textDecorationColor: 'var(--accent)' }}
    >
      {children}
    </span>
  )
}
