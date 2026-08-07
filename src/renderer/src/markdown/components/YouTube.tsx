import { useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'

/**
 * Click-to-load YouTube embed. Nothing is requested from Google until the
 * learner presses play, which keeps a freshly-opened lesson fully offline.
 */
export function YouTube(props: {
  'data-id'?: string
  'data-title'?: string
  'data-start'?: string
}): React.JSX.Element | null {
  const id = props['data-id']
  const title = props['data-title'] ?? 'Video'
  const start = props['data-start']
  const [playing, setPlaying] = useState(false)

  if (!id) return null

  const params = new URLSearchParams({ rel: '0', modestbranding: '1', autoplay: '1' })
  if (start) params.set('start', start)
  const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`

  return (
    <figure className="my-5">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-lg border border-line"
        style={{ background: 'var(--surface-2)' }}
      >
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            className="group absolute inset-0 flex flex-col items-center justify-center gap-3"
            onClick={() => setPlaying(true)}
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full shadow-e2 transition-transform group-hover:scale-108"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              <Play size={22} fill="currentColor" className="ml-0.5" />
            </span>
            <span className="max-w-[80%] text-center text-[13px] font-medium text-ink-muted">
              {title}
            </span>
            <span className="text-[11px] text-ink-subtle">
              Loads from YouTube — requires an internet connection
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-1.5 flex items-center justify-between text-[12px] text-ink-subtle">
        <span className="truncate">{title}</span>
        <button
          className="inline-flex shrink-0 items-center gap-1 hover:text-ink-muted"
          onClick={() => void window.desklearner.system.openExternal(watchUrl)}
        >
          Open in browser <ExternalLink size={11} />
        </button>
      </figcaption>
    </figure>
  )
}
