/* ------------------------------------------------------------------ *
 * Splits a lesson's markdown into independently renderable sections so
 * the reader can skip the layout and paint of everything off screen.
 *
 * Splits happen only at top-level headings — never inside a fenced code
 * block, a `:::` directive container, a list or a paragraph — so every
 * chunk is still a self-contained, valid markdown document.
 * ------------------------------------------------------------------ */

export interface MarkdownChunk {
  /** Stable across re-renders of the same document. */
  key: string
  source: string
  /** Task-list index this chunk starts at, so persisted checkbox keys line up. */
  taskOffset: number
  /** Rough rendered height in px, used as the placeholder size while skipped. */
  estimate: number
}

const HEADING = /^ {0,3}#{1,6}\s/
const FENCE = /^ {0,3}(`{3,}|~{3,})/
const DIRECTIVE_OPEN = /^ {0,3}:{3,}[A-Za-z]/
const DIRECTIVE_CLOSE = /^ {0,3}:{3,}\s*$/
const TASK_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/
const FOOTNOTE_DEF = /^ {0,3}\[\^[^\]]+\]:/
const LINK_DEF = /^ {0,3}\[[^^\]][^\]]*\]:\s+\S/
const TABLE_ROW = /^ {0,3}\|/

/** Below this the document renders in one piece — chunking would only add overhead. */
const MIN_DOCUMENT_LINES = 140
/** A chunk must reach this before a heading is allowed to start the next one. */
const MIN_CHUNK_LINES = 20
/** Fewer than this and there is nothing meaningful to skip. */
const MIN_CHUNKS = 3

/** Rough px cost of a source line, good enough to size a placeholder. */
function lineHeight(line: string, inCode: boolean): number {
  if (inCode) return 22
  const trimmed = line.trim()
  if (!trimmed) return 8
  if (HEADING.test(line)) return /^ {0,3}#{1,2}\s/.test(line) ? 56 : 42
  if (TABLE_ROW.test(line)) return 38
  // Prose wraps at roughly 90 characters in the default reader width.
  return Math.max(1, Math.ceil(trimmed.length / 90)) * 27
}

/**
 * @returns the chunks, or `null` when the document should be rendered whole —
 * either because it is short, or because it uses a construct (footnotes) whose
 * definitions cannot be split without changing what renders.
 */
export function chunkMarkdown(markdown: string): MarkdownChunk[] | null {
  const lines = markdown.split('\n')
  if (lines.length < MIN_DOCUMENT_LINES) return null

  type Draft = { lines: string[]; taskOffset: number; estimate: number }

  const chunks: Draft[] = []
  const linkDefs: string[] = []
  let current: Draft = { lines: [], taskOffset: 0, estimate: 0 }
  let tasks = 0

  let fence: string | null = null
  let directives = 0

  for (const line of lines) {
    const top = !fence && directives === 0

    if (top && FOOTNOTE_DEF.test(line)) return null

    if (top && HEADING.test(line) && current.lines.length >= MIN_CHUNK_LINES) {
      chunks.push(current)
      current = { lines: [], taskOffset: tasks, estimate: 0 }
    }

    current.lines.push(line)
    current.estimate += lineHeight(line, !!fence)

    if (fence) {
      if (line.trimStart().startsWith(fence)) fence = null
    } else {
      const opening = FENCE.exec(line)
      if (opening) {
        fence = opening[1]
      } else if (DIRECTIVE_CLOSE.test(line)) {
        directives = Math.max(0, directives - 1)
      } else if (DIRECTIVE_OPEN.test(line)) {
        directives += 1
      } else {
        if (TASK_ITEM.test(line)) tasks += 1
        if (top && LINK_DEF.test(line)) linkDefs.push(line.trim())
      }
    }
  }
  chunks.push(current)

  if (chunks.length < MIN_CHUNKS) return null

  // Reference-style link definitions live anywhere in the source but resolve
  // document-wide, so every chunk needs the full set. Repeating a definition is
  // harmless — the first one wins.
  const defs = linkDefs.length ? `\n\n${linkDefs.join('\n')}\n` : ''

  return chunks.map((chunk, i) => ({
    key: `c${i}`,
    source: chunk.lines.join('\n') + defs,
    taskOffset: chunk.taskOffset,
    estimate: Math.max(80, Math.round(chunk.estimate))
  }))
}
