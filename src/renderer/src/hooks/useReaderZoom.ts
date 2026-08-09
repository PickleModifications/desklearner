import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '@/stores/settings'

export const ZOOM_MIN = 0.6
export const ZOOM_MAX = 2.5
const ZOOM_STEP = 0.1

/** Discrete stops used by the +/- buttons, so clicking always lands on round values. */
const STOPS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2, 2.25, 2.5]

function clamp(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100))
}

interface ReaderZoom {
  zoom: number
  setZoom: (value: number) => void
  zoomBy: (delta: number) => void
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
}

/**
 * Reader zoom for lesson content. The value lives in local state so wheel
 * gestures stay smooth; writing it back to disk is debounced.
 */
export function useReaderZoom(scrollEl: HTMLElement | null): ReaderZoom {
  const stored = useSettings((s) => s.settings.readerZoom)
  const update = useSettings((s) => s.update)

  const [zoom, setLocal] = useState(() => clamp(stored || 1))
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  // Keep a ref so wheel/keyboard handlers never close over a stale value.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  // Adopt external changes (settings reset, another window) unless we are mid-gesture.
  useEffect(() => {
    if (!dirty.current) setLocal(clamp(stored || 1))
  }, [stored])

  const setZoom = useCallback(
    (value: number) => {
      const next = clamp(value)
      setLocal(next)
      dirty.current = true
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        dirty.current = false
        void update({ readerZoom: next })
      }, 350)
    },
    [update]
  )

  const zoomBy = useCallback((delta: number) => setZoom(zoomRef.current + delta), [setZoom])

  const step = useCallback(
    (direction: 1 | -1) => {
      const current = zoomRef.current
      const next =
        direction === 1
          ? STOPS.find((s) => s > current + 0.001)
          : [...STOPS].reverse().find((s) => s < current - 0.001)
      setZoom(next ?? current)
    },
    [setZoom]
  )

  const zoomIn = useCallback(() => step(1), [step])
  const zoomOut = useCallback(() => step(-1), [step])
  const reset = useCallback(() => setZoom(1), [setZoom])

  useEffect(() => () => clearTimeout(timer.current), [])

  /* -------------------------------------------------------- ctrl + scroll */

  useEffect(() => {
    if (!scrollEl) return
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom(zoomRef.current + delta)
    }
    scrollEl.addEventListener('wheel', onWheel, { passive: false })
    return () => scrollEl.removeEventListener('wheel', onWheel)
  }, [scrollEl, setZoom])

  /* ------------------------------------------------------ ctrl +/- / ctrl 0 */

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        reset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomIn, zoomOut, reset])

  return { zoom, setZoom, zoomBy, zoomIn, zoomOut, reset }
}
