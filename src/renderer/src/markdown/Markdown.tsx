import { createContext, useContext, useMemo } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import { ExternalLink, Link2 } from 'lucide-react'
import { remarkDeskLearner } from './remarkDeskLearner'
import { CourseLink } from './CourseLinks'
import { parseCourseLink } from './courseLinkResolver'
import { CodeBlock } from './components/CodeBlock'
import { Mermaid } from './components/Mermaid'
import { InlineQuiz } from './components/InlineQuiz'
import { Hint } from './components/Hint'
import { Tab, Tabs } from './components/Tabs'
import { Details } from './components/Details'
import { YouTube } from './components/YouTube'
import { Card, Cards, Checklist, Columns, Kbd, Steps, Term } from './components/Blocks'

/* --------------------------------------------------------------- context */

interface TaskState {
  values: Record<string, boolean>
  onChange: (key: string, value: boolean) => void
}

const TaskContext = createContext<TaskState | null>(null)

/* ------------------------------------------------------------ primitives */

function nodeText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(nodeText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return nodeText((children as React.ReactElement<{ children?: React.ReactNode }>).props.children)
  }
  return ''
}

function courseAwareUrlTransform(url: string): string {
  return parseCourseLink(url) ? url : defaultUrlTransform(url)
}

function Anchor({
  href,
  children
}: {
  href?: string
  children?: React.ReactNode
}): React.JSX.Element {
  // `lesson:day-12` / `test:test-week-4` become in-app pills.
  if (href && parseCourseLink(href)) {
    return <CourseLink href={href}>{children}</CourseLink>
  }

  const external = !!href && /^(https?:|mailto:)/i.test(href)
  if (external) {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault()
          void window.desklearner.system.openExternal(href)
        }}
      >
        {children}
        <ExternalLink size={11} className="ml-0.5 inline align-baseline opacity-60" />
      </a>
    )
  }
  return <a href={href}>{children}</a>
}

function Heading({
  level,
  id,
  children
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6
  id?: string
  children?: React.ReactNode
}): React.JSX.Element {
  const Tag = `h${level}` as const
  return (
    <Tag id={id}>
      {id && (
        <a className="heading-anchor" href={`#${id}`} aria-hidden tabIndex={-1}>
          <Link2 size={13} />
        </a>
      )}
      {children}
    </Tag>
  )
}

function TaskListItem({
  taskKey,
  defaultChecked,
  children
}: {
  taskKey: string
  defaultChecked: boolean
  children?: React.ReactNode
}): React.JSX.Element {
  const ctx = useContext(TaskContext)
  const checked = ctx?.values[taskKey] ?? defaultChecked
  // The `<input>` markdown already produced is dropped; we render our own.
  const content = Array.isArray(children)
    ? children.filter((c) => !(c && typeof c === 'object' && 'type' in c && c.type === 'input'))
    : children

  return (
    <li className="task-list-item">
      <input
        type="checkbox"
        checked={checked}
        disabled={!ctx}
        onChange={(e) => ctx?.onChange(taskKey, e.target.checked)}
      />
      <span className={checked ? 'text-ink-subtle line-through' : undefined}>{content}</span>
    </li>
  )
}

/* --------------------------------------------------------------- renderer */

export interface MarkdownProps {
  children: string
  /** Persisted checkbox state for GFM task lists in this document. */
  taskState?: Record<string, boolean>
  onTaskChange?: (key: string, value: boolean) => void
  className?: string
  style?: React.CSSProperties
}

export function Markdown({
  children,
  taskState,
  onTaskChange,
  className,
  style
}: MarkdownProps): React.JSX.Element {
  const task = useMemo<TaskState | null>(
    () => (onTaskChange ? { values: taskState ?? {}, onChange: onTaskChange } : null),
    [taskState, onTaskChange]
  )

  const components = useMemo(
    () =>
      ({
        a: ({ href, children: c }) => <Anchor href={href}>{c}</Anchor>,
        h1: ({ id, children: c }) => (
          <Heading level={1} id={id}>
            {c}
          </Heading>
        ),
        h2: ({ id, children: c }) => (
          <Heading level={2} id={id}>
            {c}
          </Heading>
        ),
        h3: ({ id, children: c }) => (
          <Heading level={3} id={id}>
            {c}
          </Heading>
        ),
        h4: ({ id, children: c }) => (
          <Heading level={4} id={id}>
            {c}
          </Heading>
        ),

        table: ({ children: c }) => (
          <div className="table-wrap">
            <table>{c}</table>
          </div>
        ),

        li: (props) => {
          const raw = props as { 'data-task-index'?: string; 'data-task-default'?: string }
          const index = raw['data-task-index']
          if (index !== undefined) {
            return (
              <TaskListItem taskKey={index} defaultChecked={raw['data-task-default'] === 'true'}>
                {props.children}
              </TaskListItem>
            )
          }
          return <li>{props.children}</li>
        },

        pre: ({ children: c }) => <>{c}</>,

        code: (props) => {
          const { className: cls, children: c } = props as {
            className?: string
            children?: React.ReactNode
          }
          const match = /language-(\w[\w+-]*)/.exec(cls ?? '')
          const raw = nodeText(c).replace(/\n$/, '')

          // Inline code has no language class and no newlines.
          if (!match && !raw.includes('\n')) return <code>{c}</code>

          const lang = match?.[1]
          if (lang === 'mermaid') return <Mermaid chart={raw} />
          if (lang === 'quiz') return <InlineQuiz source={raw} />

          const meta = (props as { node?: { data?: { meta?: string } } }).node?.data?.meta
          const title = /title="([^"]+)"/.exec(meta ?? '')?.[1]
          return <CodeBlock code={raw} lang={lang} title={title} />
        },

        'dl-hint': Hint,
        'dl-tabs': Tabs,
        'dl-tab': Tab,
        'dl-details': Details,
        'dl-steps': Steps,
        'dl-checklist': Checklist,
        'dl-cards': Cards,
        'dl-card': Card,
        'dl-columns': Columns,
        'dl-youtube': YouTube,
        'dl-kbd': Kbd,
        'dl-term': Term
      }) as Components,
    []
  )

  return (
    <TaskContext.Provider value={task}>
      <div className={className ? `markdown ${className}` : 'markdown'} style={style}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkDirective, remarkDeskLearner, remarkMath]}
          rehypePlugins={[rehypeSlug, rehypeKatex]}
          // react-markdown only trusts http(s)/mailto/irc/xmpp and rewrites
          // everything else to an empty href, which would silently swallow our
          // `lesson:` / `test:` links. Let those through; everything else keeps
          // the default sanitising behaviour.
          urlTransform={courseAwareUrlTransform}
          components={components}
        >
          {children}
        </ReactMarkdown>
      </div>
    </TaskContext.Provider>
  )
}
