import { createContext, useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, FileQuestion } from 'lucide-react'
import {
  parseCourseLink,
  type CourseLinkResolver,
  type ResolvedCourseLink
} from './courseLinkResolver'

/**
 * Renders `lesson:` / `test:` markdown links as pills, so the Teacher can point
 * at the source of an answer and the learner can click straight through.
 *
 * Falls back to plain text when there is no provider or the id does not
 * resolve — a hallucinated id must never produce a dead link.
 */

interface CourseLinkValue {
  resolve: CourseLinkResolver
  /** Lets the host dismiss itself when the learner follows a link. */
  onNavigate?: () => void
}

const CourseLinkContext = createContext<CourseLinkValue | null>(null)

export function CourseLinkProvider({
  resolver,
  onNavigate,
  children
}: {
  resolver: CourseLinkResolver | null
  onNavigate?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const value = useMemo(
    () => (resolver ? { resolve: resolver, onNavigate } : null),
    [resolver, onNavigate]
  )
  return <CourseLinkContext.Provider value={value}>{children}</CourseLinkContext.Provider>
}

export function useCourseLinks(): CourseLinkValue | null {
  return useContext(CourseLinkContext)
}

export function CourseLinkPill({
  link,
  label,
  onNavigate
}: {
  link: ResolvedCourseLink
  label?: React.ReactNode
  onNavigate?: () => void
}): React.JSX.Element {
  const Icon = link.kind === 'lesson' ? BookOpen : FileQuestion

  return (
    <Link to={link.to} onClick={onNavigate} className="course-pill" title={`Go to ${link.title}`}>
      <Icon size={11} className="shrink-0" />
      <span>{label ?? link.title}</span>
      {link.done && <Check size={11} className="shrink-0 opacity-70" />}
    </Link>
  )
}

/** Used by the markdown `a` renderer once an href has been recognised. */
export function CourseLink({
  href,
  children
}: {
  href: string
  children?: React.ReactNode
}): React.JSX.Element {
  const links = useCourseLinks()
  const parsed = parseCourseLink(href)
  const link = links && parsed ? links.resolve(parsed.kind, parsed.id) : null

  // `[day-12](lesson:day-12)` reads better as the lesson's real title.
  const label =
    typeof children === 'string' && parsed && children.trim() === parsed.id ? undefined : children

  // Unknown id: show the text, never a link that goes nowhere.
  if (!link) return <>{children}</>

  return <CourseLinkPill link={link} label={label} onNavigate={links?.onNavigate} />
}
