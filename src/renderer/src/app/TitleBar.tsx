import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Minus,
  Search,
  Square,
  Copy,
  X
} from 'lucide-react'
import { useUi } from '@/stores/ui'

export function TitleBar(): React.JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const setSearchOpen = useUi((s) => s.setSearchOpen)

  useEffect(() => {
    void window.desklearner.window.isMaximized().then(setMaximized)
    return window.desklearner.window.onMaximizeChange(setMaximized)
  }, [])

  return (
    <header
      className="drag flex h-10 shrink-0 items-center gap-1 border-b border-line px-2"
      style={{ background: 'var(--bg-elevated)' }}
    >
      <div className="no-drag flex items-center gap-1 pl-1">
        <button
          className="btn btn-ghost h-7 w-7 !px-0"
          onClick={() => navigate(-1)}
          title="Back (Alt+Left)"
          aria-label="Back"
        >
          <ArrowLeft size={15} />
        </button>
        <button
          className="btn btn-ghost h-7 w-7 !px-0"
          onClick={() => navigate(1)}
          title="Forward (Alt+Right)"
          aria-label="Forward"
        >
          <ArrowRight size={15} />
        </button>
      </div>

      <div className="ml-1 flex items-center gap-1.5">
        <GraduationCap size={16} style={{ color: 'var(--accent)' }} />
        <span className="text-[13px] font-semibold tracking-tight">DeskLearner</span>
      </div>

      <div className="flex flex-1 justify-center px-4">
        <button
          className="no-drag flex h-6.5 w-full max-w-96 items-center gap-2 rounded-md border
            border-line px-2.5 text-[12px] text-ink-subtle transition-colors hover:border-line-strong"
          style={{ background: 'var(--surface-2)' }}
          onClick={() => setSearchOpen(true)}
        >
          <Search size={12} />
          <span className="truncate">Search all lessons…</span>
          <kbd className="ml-auto rounded border border-line px-1 text-[10px]">Ctrl F</kbd>
        </button>
      </div>

      <div className="no-drag flex items-center">
        <WindowButton onClick={() => window.desklearner.window.minimize()} label="Minimise">
          <Minus size={14} />
        </WindowButton>
        <WindowButton
          onClick={() => window.desklearner.window.toggleMaximize()}
          label={maximized ? 'Restore' : 'Maximise'}
        >
          {maximized ? <Copy size={12} /> : <Square size={11} />}
        </WindowButton>
        <WindowButton onClick={() => window.desklearner.window.close()} label="Close" danger>
          <X size={15} />
        </WindowButton>
      </div>

      <span className="sr-only">{location.pathname}</span>
    </header>
  )
}

function WindowButton({
  children,
  onClick,
  label,
  danger
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-10 w-11 items-center justify-center text-ink-muted transition-colors ${
        danger ? 'hover:bg-[#e81123] hover:text-white' : 'hover:bg-[var(--surface-2)]'
      }`}
    >
      {children}
    </button>
  )
}
