import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Command,
  Contrast,
  FileQuestion,
  Home,
  Layers,
  Library,
  Moon,
  Palette,
  Search,
  Settings,
  Sun
} from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useContent } from '@/stores/content'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'

interface Action {
  id: string
  label: string
  hint?: string
  group: string
  icon: React.ReactNode
  run: () => void
}

export function CommandPalette(): React.JSX.Element {
  const open = useUi((s) => s.paletteOpen)
  const setOpen = useUi((s) => s.setPaletteOpen)
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  const navigate = useNavigate()
  const index = useContent((s) => s.index)
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)

  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const actions = useMemo<Action[]>(() => {
    const close = (fn: () => void) => () => {
      setOpen(false)
      fn()
    }

    const navigation: Action[] = [
      { id: 'nav-home', label: 'Go to Home', group: 'Navigate', icon: <Home size={15} />, run: close(() => navigate('/')) },
      { id: 'nav-library', label: 'Go to Library', group: 'Navigate', icon: <Library size={15} />, run: close(() => navigate('/library')) },
      { id: 'nav-bookmarks', label: 'Go to Bookmarks', group: 'Navigate', icon: <BookMarked size={15} />, run: close(() => navigate('/bookmarks')) },
      { id: 'nav-flashcards', label: 'Go to Flashcards', group: 'Navigate', icon: <Layers size={15} />, run: close(() => navigate('/flashcards')) },
      { id: 'nav-stats', label: 'Go to Statistics', group: 'Navigate', icon: <BarChart3 size={15} />, run: close(() => navigate('/stats')) },
      { id: 'nav-settings', label: 'Open Settings', hint: 'Ctrl ,', group: 'Navigate', icon: <Settings size={15} />, run: close(() => navigate('/settings')) },
      { id: 'search', label: 'Search all lessons', hint: 'Ctrl F', group: 'Navigate', icon: <Search size={15} />, run: close(() => setSearchOpen(true)) }
    ]

    const appearance: Action[] = [
      { id: 'theme-light', label: 'Theme: Light', group: 'Appearance', icon: <Sun size={15} />, run: close(() => void update({ theme: 'light' })) },
      { id: 'theme-dark', label: 'Theme: Dark', group: 'Appearance', icon: <Moon size={15} />, run: close(() => void update({ theme: 'dark' })) },
      { id: 'theme-system', label: 'Theme: Match system', group: 'Appearance', icon: <Contrast size={15} />, run: close(() => void update({ theme: 'system' })) },
      {
        id: 'focus',
        label: settings.focusMode ? 'Turn off focus mode' : 'Turn on focus mode',
        group: 'Appearance',
        icon: <Palette size={15} />,
        run: close(() => void update({ focusMode: !settings.focusMode }))
      },
      {
        id: 'sidebar',
        label: settings.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar',
        hint: 'Ctrl B',
        group: 'Appearance',
        icon: <Palette size={15} />,
        run: close(() => void update({ sidebarCollapsed: !settings.sidebarCollapsed }))
      }
    ]

    const courses: Action[] = index.courses.flatMap((pack) => [
      {
        id: `course-${pack.manifest.id}`,
        label: pack.manifest.title,
        hint: 'Course',
        group: 'Courses',
        icon: <BookOpen size={15} />,
        run: close(() => navigate(`/course/${pack.manifest.id}`))
      },
      ...pack.manifest.chapters
        .filter((c) => c.test)
        .map((chapter) => ({
          id: `test-${pack.manifest.id}-${chapter.test!.id}`,
          label: chapter.test!.title,
          hint: pack.manifest.title,
          group: 'Tests',
          icon: <FileQuestion size={15} />,
          run: close(() => navigate(`/course/${pack.manifest.id}/test/${chapter.test!.id}`))
        })),
      ...(pack.manifest.finalExam
        ? [
            {
              id: `exam-${pack.manifest.id}`,
              label: pack.manifest.finalExam.title,
              hint: pack.manifest.title,
              group: 'Tests',
              icon: <FileQuestion size={15} />,
              run: close(() =>
                navigate(`/course/${pack.manifest.id}/test/${pack.manifest.finalExam!.id}`)
              )
            }
          ]
        : [])
    ])

    const lessons: Action[] = index.courses.flatMap((pack) =>
      pack.manifest.chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => ({
          id: `lesson-${pack.manifest.id}-${chapter.id}-${lesson.id}`,
          label: lesson.title,
          hint: `${pack.manifest.title} · ${chapter.title}`,
          group: 'Lessons',
          icon: <BookOpen size={15} />,
          run: close(() =>
            navigate(`/course/${pack.manifest.id}/lesson/${chapter.id}/${lesson.id}`)
          )
        }))
      )
    )

    return [...navigation, ...appearance, ...courses, ...lessons]
  }, [index, navigate, setOpen, setSearchOpen, settings.focusMode, settings.sidebarCollapsed, update])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions.filter((a) => a.group !== 'Lessons').slice(0, 24)
    return actions
      .filter((a) => `${a.label} ${a.hint ?? ''}`.toLowerCase().includes(q))
      .slice(0, 40)
  }, [actions, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => setCursor(0), [query])

  let lastGroup = ''

  return (
    <Modal open={open} onClose={() => setOpen(false)} top>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Command size={16} className="shrink-0 text-ink-subtle" />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-subtle"
          placeholder="Type a command or jump to a lesson…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(filtered.length - 1, c + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(0, c - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              filtered[cursor]?.run()
            }
          }}
        />
      </div>

      <div className="scroll-area max-h-[55vh] py-1">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-subtle">Nothing matches.</p>
        ) : (
          filtered.map((action, i) => {
            const showGroup = action.group !== lastGroup
            lastGroup = action.group
            return (
              <div key={action.id}>
                {showGroup && (
                  <div className="px-4 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
                    {action.group}
                  </div>
                )}
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13.5px]"
                  style={i === cursor ? { background: 'var(--surface-2)' } : undefined}
                  onMouseEnter={() => setCursor(i)}
                  onClick={action.run}
                >
                  <span className="shrink-0 text-ink-subtle">{action.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{action.label}</span>
                  {action.hint && (
                    <span className="shrink-0 truncate text-[11px] text-ink-subtle">{action.hint}</span>
                  )}
                </button>
              </div>
            )
          })
        )}
      </div>
    </Modal>
  )
}
