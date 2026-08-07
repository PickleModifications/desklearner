import { Link } from 'react-router-dom'
import { BookMarked, NotebookPen } from 'lucide-react'
import { EmptyState, Page, PageHeader, SectionTitle } from '@/components/Page'
import { useContent } from '@/stores/content'
import { useProgress } from '@/stores/progress'

interface Row {
  courseId: string
  courseTitle: string
  chapterId: string
  chapterTitle: string
  lessonId: string
  lessonTitle: string
  notes?: string
}

export function BookmarksPage(): React.JSX.Element {
  const index = useContent((s) => s.index)
  const progress = useProgress((s) => s.state)

  const bookmarks: Row[] = []
  const notes: Row[] = []

  for (const pack of index.courses) {
    for (const chapter of pack.manifest.chapters) {
      for (const lesson of chapter.lessons) {
        const entry = progress.courses[pack.manifest.id]?.lessons[`${chapter.id}/${lesson.id}`]
        if (!entry) continue
        const row: Row = {
          courseId: pack.manifest.id,
          courseTitle: pack.manifest.title,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          notes: entry.notes
        }
        if (entry.bookmarked) bookmarks.push(row)
        if (entry.notes?.trim()) notes.push(row)
      }
    }
  }

  return (
    <Page>
      <PageHeader
        title="Bookmarks & notes"
        subtitle="Everything you have flagged or written down, across all courses"
      />

      {bookmarks.length === 0 && notes.length === 0 ? (
        <EmptyState
          icon={<BookMarked size={30} />}
          title="Nothing saved yet"
          description="Bookmark a lesson with the flag icon in the reader, or open the notes panel to write as you learn."
        />
      ) : (
        <>
          {bookmarks.length > 0 && (
            <section className="mb-8">
              <SectionTitle>Bookmarked lessons</SectionTitle>
              <div className="flex flex-col gap-2">
                {bookmarks.map((row) => (
                  <Link
                    key={`${row.courseId}/${row.chapterId}/${row.lessonId}`}
                    to={`/course/${row.courseId}/lesson/${row.chapterId}/${row.lessonId}`}
                    className="card flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <BookMarked size={15} className="shrink-0" style={{ color: 'var(--accent)' }} />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium">{row.lessonTitle}</div>
                      <div className="truncate text-[11.5px] text-ink-subtle">
                        {row.courseTitle} · {row.chapterTitle}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {notes.length > 0 && (
            <section>
              <SectionTitle>Lesson notes</SectionTitle>
              <div className="flex flex-col gap-2">
                {notes.map((row) => (
                  <Link
                    key={`${row.courseId}/${row.chapterId}/${row.lessonId}`}
                    to={`/course/${row.courseId}/lesson/${row.chapterId}/${row.lessonId}`}
                    className="card block px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <div className="flex items-center gap-2">
                      <NotebookPen size={14} className="shrink-0" style={{ color: 'var(--accent)' }} />
                      <span className="truncate text-[13.5px] font-medium">{row.lessonTitle}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-ink-subtle">
                        {row.courseTitle}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-muted">
                      {row.notes}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Page>
  )
}
