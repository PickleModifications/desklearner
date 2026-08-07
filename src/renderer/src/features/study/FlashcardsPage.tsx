import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Layers, RotateCcw, Shuffle, X } from 'lucide-react'
import { EmptyState, Page, PageHeader } from '@/components/Page'
import { ProgressBar } from '@/components/ProgressRing'
import { useContent } from '@/stores/content'
import { seededShuffle } from '@/lib/utils'

interface Flashcard {
  term: string
  definition: string
  courseId: string
  chapterId: string
  lessonId: string
  lessonTitle: string
}

export function FlashcardsPage(): React.JSX.Element {
  const index = useContent((s) => s.index)
  const [courseId, setCourseId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [cards, setCards] = useState<Flashcard[] | null>(null)
  const [deck, setDeck] = useState<Flashcard[]>([])
  const [at, setAt] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!courseId && index.courses[0]) setCourseId(index.courses[0].manifest.id)
  }, [index, courseId])

  const pack = index.courses.find((c) => c.manifest.id === courseId)

  /* Key terms live in lesson frontmatter, so the deck is assembled by reading
     every lesson in the selected course once. */
  useEffect(() => {
    if (!pack) return
    let cancelled = false
    setCards(null)
    void (async () => {
      const collected: Flashcard[] = []
      for (const chapter of pack.manifest.chapters) {
        for (const lesson of chapter.lessons) {
          try {
            const doc = await window.desklearner.content.lesson(
              pack.manifest.id,
              chapter.id,
              lesson.id
            )
            for (const term of doc.frontmatter.keyTerms ?? []) {
              collected.push({
                ...term,
                courseId: pack.manifest.id,
                chapterId: chapter.id,
                lessonId: lesson.id,
                lessonTitle: lesson.title
              })
            }
          } catch {
            /* skip unreadable lessons */
          }
        }
      }
      if (!cancelled) setCards(collected)
    })()
    return () => {
      cancelled = true
    }
  }, [pack])

  const filtered = useMemo(
    () => (cards ?? []).filter((c) => !chapterId || c.chapterId === chapterId),
    [cards, chapterId]
  )

  useEffect(() => {
    setDeck(filtered)
    setAt(0)
    setFlipped(false)
    setKnown(new Set())
  }, [filtered])

  const card = deck[at]
  const shuffle = (): void => {
    setDeck(seededShuffle(filtered, Date.now().toString()))
    setAt(0)
    setFlipped(false)
  }

  const advance = (delta: number): void => {
    setFlipped(false)
    setAt((prev) => Math.min(deck.length - 1, Math.max(0, prev + delta)))
  }

  const mark = (isKnown: boolean): void => {
    if (!card) return
    setKnown((prev) => {
      const next = new Set(prev)
      isKnown ? next.add(card.term) : next.delete(card.term)
      return next
    })
    if (at < deck.length - 1) advance(1)
  }

  return (
    <Page>
      <PageHeader
        title="Flashcards"
        subtitle="Generated automatically from the key terms in each lesson"
        actions={
          deck.length > 0 && (
            <button className="btn" onClick={shuffle}>
              <Shuffle size={14} /> Shuffle
            </button>
          )
        }
      />

      {index.courses.length === 0 ? (
        <EmptyState
          icon={<Layers size={30} />}
          title="No courses installed"
          description="Flashcards are built from course content."
          action={
            <Link to="/library" className="btn btn-primary">
              Open library
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            <select
              className="input max-w-64"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value)
                setChapterId('')
              }}
            >
              {index.courses.map((c) => (
                <option key={c.manifest.id} value={c.manifest.id}>
                  {c.manifest.title}
                </option>
              ))}
            </select>
            <select
              className="input max-w-64"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
            >
              <option value="">All chapters</option>
              {pack?.manifest.chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </div>

          {cards === null ? (
            <div className="text-sm text-ink-subtle">Building deck…</div>
          ) : deck.length === 0 ? (
            <EmptyState
              icon={<Layers size={30} />}
              title="No key terms here"
              description="This selection has no `keyTerms` defined in its lesson frontmatter."
            />
          ) : (
            <>
              <div className="mb-3">
                <ProgressBar value={(at + 1) / deck.length} />
                <div className="mt-1.5 flex justify-between text-[11.5px] text-ink-subtle">
                  <span>
                    Card {at + 1} of {deck.length}
                  </span>
                  <span>{known.size} marked as known</span>
                </div>
              </div>

              <button
                className="card mb-4 flex min-h-64 w-full flex-col items-center justify-center gap-3 px-8 py-10 text-center transition-shadow hover:shadow-e2"
                onClick={() => setFlipped(!flipped)}
              >
                {flipped ? (
                  <>
                    <div className="text-[11px] uppercase tracking-wider text-ink-subtle">
                      Definition
                    </div>
                    <p className="max-w-xl text-[15px] leading-relaxed">{card?.definition}</p>
                    <Link
                      to={`/course/${card?.courseId}/lesson/${card?.chapterId}/${card?.lessonId}`}
                      className="mt-2 text-[11.5px] text-ink-subtle underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {card?.lessonTitle}
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] uppercase tracking-wider text-ink-subtle">Term</div>
                    <p className="text-[24px] font-semibold">{card?.term}</p>
                    <span className="mt-2 text-[11.5px] text-ink-subtle">Click to reveal</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between gap-2">
                <button className="btn" onClick={() => advance(-1)} disabled={at === 0}>
                  <ArrowLeft size={14} /> Previous
                </button>

                <div className="flex gap-2">
                  <button className="btn btn-danger" onClick={() => mark(false)}>
                    <X size={14} /> Still learning
                  </button>
                  <button
                    className="btn"
                    onClick={() => mark(true)}
                    style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                  >
                    <Check size={14} /> I know this
                  </button>
                </div>

                <button className="btn" onClick={() => advance(1)} disabled={at >= deck.length - 1}>
                  Next <ArrowRight size={14} />
                </button>
              </div>

              {at >= deck.length - 1 && (
                <div className="mt-6 text-center">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setAt(0)
                      setFlipped(false)
                    }}
                  >
                    <RotateCcw size={14} /> Start over
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Page>
  )
}
