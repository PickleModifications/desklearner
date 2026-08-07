import { Children, isValidElement, useState } from 'react'
import { cn } from '@/lib/utils'

interface TabChildProps {
  'data-title'?: string
  children?: React.ReactNode
}

export function Tabs({ children }: { children?: React.ReactNode }): React.JSX.Element {
  const tabs = Children.toArray(children).filter(
    (child): child is React.ReactElement<TabChildProps> =>
      isValidElement<TabChildProps>(child) && child.props['data-title'] !== undefined
  )
  const [active, setActive] = useState(0)

  if (!tabs.length) return <div>{children}</div>

  return (
    <div className="my-5 overflow-hidden rounded-lg border border-line">
      <div
        className="flex gap-0.5 overflow-x-auto border-b border-line px-1 pt-1"
        style={{ background: 'var(--surface-2)' }}
        role="tablist"
      >
        {tabs.map((tab, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={cn(
              'whitespace-nowrap rounded-t-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              active === i ? 'text-ink' : 'text-ink-subtle hover:text-ink-muted'
            )}
            style={active === i ? { background: 'var(--surface)' } : undefined}
          >
            {tab.props['data-title']}
          </button>
        ))}
      </div>
      <div
        className="px-4 py-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        style={{ background: 'var(--surface)' }}
        role="tabpanel"
      >
        {tabs[active]?.props.children}
      </div>
    </div>
  )
}

export function Tab({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <>{children}</>
}
