import { NavLink } from 'react-router-dom'
import { BookMarked, BarChart3, Home, Layers, Library, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/bookmarks', label: 'Bookmarks', icon: BookMarked },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/stats', label: 'Statistics', icon: BarChart3 }
]

export function NavRail(): React.JSX.Element {
  return (
    <nav
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line py-3"
      style={{ background: 'var(--bg-elevated)' }}
    >
      {items.map((item) => (
        <RailLink key={item.to} {...item} />
      ))}
      <div className="flex-1" />
      <RailLink to="/settings" label="Settings" icon={Settings} />
    </nav>
  )
}

function RailLink({
  to,
  label,
  icon: Icon,
  end
}: {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}): React.JSX.Element {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
          isActive ? 'text-accent' : 'text-ink-subtle hover:text-ink'
        )
      }
      style={({ isActive }) => (isActive ? { background: 'var(--accent-soft)' } : undefined)}
    >
      {({ isActive }) => (
        <>
          <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
          <span
            className="pointer-events-none absolute left-12 z-50 hidden whitespace-nowrap rounded-md
              border border-line px-2 py-1 text-xs shadow-e2 group-hover:block"
            style={{ background: 'var(--surface)' }}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}
