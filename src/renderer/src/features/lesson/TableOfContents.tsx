import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export interface TocEntry {
  id: string
  text: string
  level: number
}

/** Extracts h2/h3 headings from the rendered lesson DOM. */
export function useHeadings(container: HTMLElement | null, deps: unknown): TocEntry[] {
  const [entries, setEntries] = useState<TocEntry[]>([])

  useEffect(() => {
    if (!container) return
    // The markdown renders asynchronously (Shiki, Mermaid), so re-read after paint.
    const read = (): void => {
      const nodes = container.querySelectorAll<HTMLElement>('h2[id], h3[id]')
      setEntries(
        Array.from(nodes).map((node) => ({
          id: node.id,
          text: node.textContent?.replace(/^#/, '').trim() ?? '',
          level: Number(node.tagName.slice(1))
        }))
      )
    }
    read()
    const timer = setTimeout(read, 300)
    return () => clearTimeout(timer)
  }, [container, deps])

  return entries
}

export function TableOfContents({
  entries,
  scrollRoot
}: {
  entries: TocEntry[]
  scrollRoot: HTMLElement | null
}): React.JSX.Element | null {
  const [activeId, setActiveId] = useState<string | null>(null)
  const ids = useMemo(() => entries.map((e) => e.id).join('|'), [entries])

  useEffect(() => {
    if (!scrollRoot || !entries.length) return
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { root: scrollRoot, rootMargin: '-72px 0px -70% 0px', threshold: 0 }
    )
    for (const entry of entries) {
      const el = document.getElementById(entry.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ids, scrollRoot, entries])

  if (entries.length < 2) return null

  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <div className="sticky top-0 py-8 pr-6">
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          On this page
        </div>
        <ul className="border-l border-line">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(entry.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={cn(
                  '-ml-px block border-l-2 py-1 text-[12px] leading-snug transition-colors',
                  entry.level === 3 ? 'pl-5' : 'pl-3',
                  activeId === entry.id
                    ? 'font-medium'
                    : 'border-transparent text-ink-subtle hover:text-ink'
                )}
                style={
                  activeId === entry.id
                    ? { borderColor: 'var(--accent)', color: 'var(--accent-text)' }
                    : undefined
                }
              >
                {entry.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
