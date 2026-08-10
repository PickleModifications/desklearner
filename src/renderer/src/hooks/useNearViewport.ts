import { useEffect, useState } from 'react'

/**
 * Latches to `true` once the element comes within `margin` of the scroll
 * viewport, and never flips back.
 *
 * Used to keep expensive work — syntax highlighting, diagram rendering — out of
 * the initial render of a long lesson. Elements inside a `content-visibility`
 * chunk that the browser has skipped have no layout, so they simply report as
 * not intersecting until the chunk itself becomes relevant; the generous margin
 * means the work still finishes before the block is scrolled into view.
 */
export function useNearViewport(margin = '900px'): {
  ref: (el: HTMLElement | null) => void
  near: boolean
} {
  const [el, ref] = useState<HTMLElement | null>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    if (near || !el) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    // The margin has to be measured against the scroll container the element
    // actually lives in: with the default root, an ancestor scroller still clips
    // the intersection, so nothing would ever be seen as coming *before* it is
    // on screen — which is the entire point of the margin.
    const root = el.closest('.scroll-area')
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { root, rootMargin: margin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [el, near, margin])

  return { ref, near }
}
