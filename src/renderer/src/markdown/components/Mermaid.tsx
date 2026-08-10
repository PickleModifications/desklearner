import { useEffect, useId, useState } from 'react'
import { useNearViewport } from '@/hooks/useNearViewport'
import { useUi } from '@/stores/ui'

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null

async function loadMermaid(): Promise<typeof import('mermaid').default> {
  mermaidPromise ??= import('mermaid').then((m) => m.default)
  return mermaidPromise
}

/**
 * Flattens any CSS colour — including `color-mix()` and `oklab()` — to a plain
 * sRGB `rgb()` string by rasterising a single pixel.
 *
 * Mermaid's colour library only understands legacy notations, and
 * getComputedStyle happily hands back modern ones, so this conversion is what
 * keeps themed diagrams from failing to render at all.
 */
function toRgb(value: string, fallback: string): string {
  if (!value) return fallback
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return fallback
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  } catch {
    return fallback
  }
}

/** Reads the current theme tokens so diagrams match the rest of the app. */
function themeVariables(isDark: boolean): Record<string, string> {
  const css = getComputedStyle(document.documentElement)
  const probe = document.createElement('span')
  probe.style.display = 'none'
  document.body.appendChild(probe)

  const v = (name: string): string => {
    const raw = css.getPropertyValue(name).trim()
    if (!raw) return isDark ? '#14171d' : '#ffffff'
    // Let the browser resolve var()/color-mix(), then flatten to sRGB.
    probe.style.color = ''
    probe.style.color = raw
    const computed = getComputedStyle(probe).color
    return toRgb(computed || raw, isDark ? '#14171d' : '#ffffff')
  }

  const variables = {
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

  probe.remove()
  return variables
}

/**
 * Mermaid sizes its SVG with `width="100%"` and an inline `max-width` in px.
 * A percentage width is immune to the reader's CSS zoom — the diagram would
 * stay exactly the same size while the text around it grew — so we drop both
 * and let the stylesheet size the diagram from its viewBox instead.
 */
function unlockSvgSize(svg: string): string {
  return svg.replace(/<svg\b[^>]*?>/, (tag) => {
    const intrinsic = /max-width:\s*([\d.]+)px/.exec(tag)?.[1]
    if (!intrinsic) return tag
    return tag
      .replace(/max-width:\s*[^;"]*;?/, '')
      .replace(/\swidth="100%"/, ` width="${Math.round(Number(intrinsic))}"`)
  })
}

export function Mermaid({ chart }: { chart: string }): React.JSX.Element {
  const isDark = useUi((s) => s.isDark)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reactId = useId()
  const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`
  // Rendering every diagram in a lesson at once loads Mermaid and lays out each
  // SVG before the reader has seen a word; hold off until one is nearly in view.
  const { ref, near } = useNearViewport()

  useEffect(() => {
    if (!near) return
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
          setSvg(unlockSvgSize(out))
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chart, isDark, id, near])

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

  // Until the diagram exists, hold roughly the space it will take so scrolling
  // past an un-rendered one does not shunt the text below it.
  const placeholder = Math.min(420, 90 + chart.split('\n').length * 26)

  return (
    <figure
      ref={ref}
      className="mermaid-figure"
      style={svg ? undefined : { minHeight: placeholder }}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="Diagram"
    />
  )
}
