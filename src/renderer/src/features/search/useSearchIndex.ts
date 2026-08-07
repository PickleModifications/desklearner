import { useEffect, useState } from 'react'
import MiniSearch from 'minisearch'

export interface CorpusEntry {
  id: string
  courseId: string
  courseTitle: string
  chapterId: string
  chapterTitle: string
  lessonId: string
  title: string
  text: string
}

export interface SearchHit extends CorpusEntry {
  snippet: string
}

interface BuiltIndex {
  mini: MiniSearch<CorpusEntry>
  byId: Map<string, CorpusEntry>
}

let indexPromise: Promise<BuiltIndex> | null = null

function buildIndex(): Promise<BuiltIndex> {
  return (indexPromise ??= window.desklearner.content.searchCorpus().then((entries) => {
    const mini = new MiniSearch<CorpusEntry>({
      fields: ['title', 'chapterTitle', 'courseTitle', 'text'],
      storeFields: ['id'],
      searchOptions: {
        boost: { title: 4, chapterTitle: 2 },
        prefix: true,
        fuzzy: 0.15
      }
    })
    mini.addAll(entries)
    return { mini, byId: new Map(entries.map((e) => [e.id, e])) }
  }))
}

export function invalidateSearchIndex(): void {
  indexPromise = null
}

/** Builds (once) and queries the lesson full-text index. */
export function useSearch(query: string, enabled: boolean): { hits: SearchHit[]; ready: boolean } {
  const [ready, setReady] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void buildIndex().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !ready) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setHits([])
      return
    }
    let cancelled = false
    void buildIndex().then(({ mini, byId }) => {
      if (cancelled) return
      const results = mini.search(trimmed).slice(0, 40)
      setHits(
        results.flatMap((r) => {
          const entry = byId.get(r.id as string)
          return entry ? [{ ...entry, snippet: makeSnippet(entry.text, trimmed) }] : []
        })
      )
    })
    return () => {
      cancelled = true
    }
  }, [query, enabled, ready])

  return { hits, ready }
}

function makeSnippet(text: string, query: string): string {
  const term = query.split(/\s+/)[0].toLowerCase()
  const at = text.toLowerCase().indexOf(term)
  if (at < 0) return text.slice(0, 160) + (text.length > 160 ? '…' : '')
  const start = Math.max(0, at - 70)
  const end = Math.min(text.length, at + 110)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

/** Splits text into alternating plain/matched runs for the search UI to render. */
export function splitHighlights(
  snippet: string,
  query: string
): Array<{ text: string; match: boolean }> {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!terms.length) return [{ text: snippet, match: false }]

  const exact = new RegExp(`^(${terms.join('|')})$`, 'i')
  return snippet
    .split(new RegExp(`(${terms.join('|')})`, 'gi'))
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: exact.test(part) }))
}
