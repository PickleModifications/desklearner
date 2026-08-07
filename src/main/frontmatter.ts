import YAML from 'yaml'

export interface ParsedDocument<T> {
  data: T
  content: string
}

const FM = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Minimal YAML frontmatter splitter — `gray-matter` without the dependency weight. */
export function parseFrontmatter<T extends object>(raw: string): ParsedDocument<T> {
  const match = FM.exec(raw)
  if (!match) return { data: {} as T, content: raw }
  let data = {} as T
  try {
    data = (YAML.parse(match[1]) ?? {}) as T
  } catch {
    data = {} as T
  }
  return { data, content: raw.slice(match[0].length) }
}

/** Strips markdown syntax down to searchable prose. */
export function markdownToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/^:::.*$/gm, ' ')
    .replace(/^::\w+\{[^}]*\}$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
