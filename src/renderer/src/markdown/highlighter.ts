import type { HighlighterCore } from 'shiki/core'

/**
 * Fine-grained Shiki bundle. Importing from `shiki` directly would pull every
 * grammar Shiki ships (~20 MB of chunks); listing the languages the courses
 * actually use keeps the build lean.
 */
export const LANGS = [
  'sql',
  'python',
  'bash',
  'powershell',
  'json',
  'yaml',
  'docker',
  'javascript',
  'typescript',
  'csharp',
  'ini',
  'diff',
  'xml',
  'html',
  'css',
  'markdown',
  'hcl'
] as const

export const THEMES = { light: 'github-light', dark: 'github-dark-dimmed' } as const

let highlighterPromise: Promise<HighlighterCore> | null = null

export function getHighlighter(): Promise<HighlighterCore> {
  return (highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createOnigurumaEngine }] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/oniguruma')
    ])

    return createHighlighterCore({
      themes: [
        import('shiki/themes/github-light.mjs'),
        import('shiki/themes/github-dark-dimmed.mjs')
      ],
      langs: [
        import('shiki/langs/sql.mjs'),
        import('shiki/langs/python.mjs'),
        import('shiki/langs/bash.mjs'),
        import('shiki/langs/powershell.mjs'),
        import('shiki/langs/json.mjs'),
        import('shiki/langs/yaml.mjs'),
        import('shiki/langs/docker.mjs'),
        import('shiki/langs/javascript.mjs'),
        import('shiki/langs/typescript.mjs'),
        import('shiki/langs/csharp.mjs'),
        import('shiki/langs/ini.mjs'),
        import('shiki/langs/diff.mjs'),
        import('shiki/langs/xml.mjs'),
        import('shiki/langs/html.mjs'),
        import('shiki/langs/css.mjs'),
        import('shiki/langs/markdown.mjs'),
        import('shiki/langs/hcl.mjs')
      ],
      engine: createOnigurumaEngine(import('shiki/wasm'))
    })
  })())
}

const ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  ps: 'powershell',
  ps1: 'powershell',
  pwsh: 'powershell',
  tsql: 'sql',
  py: 'python',
  yml: 'yaml',
  dockerfile: 'docker',
  js: 'javascript',
  ts: 'typescript',
  cs: 'csharp',
  terraform: 'hcl',
  env: 'ini',
  cfg: 'ini'
}

/** Maps a fence language to a loaded grammar, falling back to plain text. */
export function resolveLang(lang: string | undefined): string {
  const key = (lang ?? '').toLowerCase()
  const mapped = ALIASES[key] ?? key
  return (LANGS as readonly string[]).includes(mapped) ? mapped : 'text'
}
