import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useUi } from '@/stores/ui'
import { splitHighlights, useSearch } from './useSearchIndex'

export function SearchDialog(): React.JSX.Element {
  const open = useUi((s) => s.searchOpen)
  const setOpen = useUi((s) => s.setSearchOpen)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { hits, ready } = useSearch(query, open)

  useEffect(() => {
    if (open) {
      setCursor(0)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [open])

  useEffect(() => setCursor(0), [query])

  const go = (i: number): void => {
    const hit = hits[i]
    if (!hit) return
    setOpen(false)
    navigate(`/course/${hit.courseId}/lesson/${hit.chapterId}/${hit.lessonId}`)
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} top>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Search size={16} className="shrink-0 text-ink-subtle" />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-subtle"
          placeholder="Search every lesson…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(hits.length - 1, c + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(0, c - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              go(cursor)
            }
          }}
        />
        <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-subtle">
          Esc
        </kbd>
      </div>

      <div className="scroll-area max-h-[55vh]">
        {query.trim().length < 2 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-subtle">
            {ready ? 'Type at least two characters.' : 'Building search index…'}
          </p>
        ) : hits.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-subtle">
            No lessons match “{query}”.
          </p>
        ) : (
          <ul>
            {hits.map((hit, i) => (
              <li key={hit.id}>
                <button
                  className="block w-full border-b border-line px-4 py-2.5 text-left transition-colors last:border-b-0"
                  style={i === cursor ? { background: 'var(--surface-2)' } : undefined}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(i)}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-medium">{hit.title}</span>
                    <span className="truncate text-[11px] text-ink-subtle">
                      {hit.courseTitle} · {hit.chapterTitle}
                    </span>
                    {i === cursor && (
                      <CornerDownLeft size={12} className="ml-auto shrink-0 text-ink-subtle" />
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-muted">
                    {splitHighlights(hit.snippet, query).map((part, k) =>
                      part.match ? (
                        <mark
                          key={k}
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                        >
                          {part.text}
                        </mark>
                      ) : (
                        <span key={k}>{part.text}</span>
                      )
                    )}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-ink-subtle">
        <span>↑ ↓ to navigate</span>
        <span>↵ to open</span>
        <span className="ml-auto">{hits.length} result{hits.length === 1 ? '' : 's'}</span>
      </div>
    </Modal>
  )
}
