import { useEffect, useId, useState } from 'react'
import { useUi } from '@/stores/ui'

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null

async function loadMermaid(): Promise<typeof import('mermaid').default> {
  mermaidPromise ??= import('mermaid').then((m) => m.default)
  return mermaidPromise
}

/** Reads the current theme tokens so diagrams match the rest of the app. */
function themeVariables(isDark: boolean): Record<string, string> {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string): string => css.getPropertyValue(name).trim()
  return {
    background: v('--surface'),
    primaryColor: v('--accent-soft'),
    primaryBorderColor: v('--accent'),
    primaryTextColor: v('--text'),
    secondaryColor: v('--surface-2'),
    tertiaryColor: v('--surface-3'),
    lineColor: v('--border-strong'),
    textColor: v('--text'),
    mainBkg: v('--surface-2'),
    nodeBorder: v('--border-strong'),
    clusterBkg: isDark ? v('--bg') : v('--surface-2'),
    clusterBorder: v('--border'),
    fontFamily: css.getPropertyValue('--font-sans').trim() || 'system-ui',
    fontSize: '14px'
  }
}

export function Mermaid({ chart }: { chart: string }): React.JSX.Element {
  const isDark = useUi((s) => s.isDark)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reactId = useId()
  const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const mermaid = await loadMermaid()
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          darkMode: isDark,
          themeVariables: themeVariables(isDark)
        })
        const { svg: out } = await mermaid.render(id, chart)
        if (!cancelled) {
          setSvg(out)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chart, isDark, id])

  if (error) {
    return (
      <pre
        className="my-4 overflow-x-auto rounded-lg border px-3 py-2 text-xs"
        style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
      >
        Diagram error: {error}
      </pre>
    )
  }

  return (
    <figure className="mermaid-figure" dangerouslySetInnerHTML={{ __html: svg }} aria-label="Diagram" />
  )
}
