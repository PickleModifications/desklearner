import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'

type DirectiveNode = {
  type: 'containerDirective' | 'leafDirective' | 'textDirective'
  name: string
  attributes?: Record<string, string | null | undefined>
  data?: { hName?: string; hProperties?: Record<string, unknown> }
}

/** Container directives that become a custom element with `data-*` props. */
const CONTAINERS: Record<string, string> = {
  hint: 'dl-hint',
  tabs: 'dl-tabs',
  tab: 'dl-tab',
  details: 'dl-details',
  steps: 'dl-steps',
  checklist: 'dl-checklist',
  cards: 'dl-cards',
  card: 'dl-card',
  columns: 'dl-columns'
}

const LEAVES: Record<string, string> = {
  youtube: 'dl-youtube',
  embed: 'dl-embed',
  image: 'dl-image'
}

const TEXTS: Record<string, string> = {
  kbd: 'dl-kbd',
  term: 'dl-term'
}

function toProps(attrs: Record<string, string | null | undefined> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue
    // remark-directive folds `{type=warning}` shorthand differently from `{.foo}`;
    // both land here as plain string attributes.
    out[`data-${key.toLowerCase()}`] = value
  }
  return out
}

/**
 * Bridges remark-directive syntax onto custom elements the renderer maps to
 * React components, and tags GFM task-list items so their state can persist.
 */
export function remarkDeskLearner() {
  return (tree: Root): void => {
    let taskIndex = 0

    visit(tree, (node) => {
      const n = node as unknown as DirectiveNode

      if (n.type === 'containerDirective' && CONTAINERS[n.name]) {
        n.data ??= {}
        n.data.hName = CONTAINERS[n.name]
        n.data.hProperties = { ...toProps(n.attributes), 'data-directive': n.name }
      } else if (n.type === 'leafDirective' && LEAVES[n.name]) {
        n.data ??= {}
        n.data.hName = LEAVES[n.name]
        n.data.hProperties = { ...toProps(n.attributes), 'data-directive': n.name }
      } else if (n.type === 'textDirective' && TEXTS[n.name]) {
        n.data ??= {}
        n.data.hName = TEXTS[n.name]
        n.data.hProperties = toProps(n.attributes)
      }
    })

    visit(tree, 'listItem', (node) => {
      const item = node as unknown as {
        checked?: boolean | null
        data?: { hProperties?: Record<string, unknown> }
      }
      if (item.checked === null || item.checked === undefined) return
      item.data ??= {}
      item.data.hProperties = {
        ...(item.data.hProperties ?? {}),
        'data-task-index': String(taskIndex++),
        'data-task-default': item.checked ? 'true' : 'false'
      }
    })
  }
}
