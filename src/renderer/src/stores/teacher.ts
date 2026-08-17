import { create } from 'zustand'
import {
  EMPTY_CHATS,
  type AiKeyStatus,
  type ChatState,
  type CourseBrief,
  type PendingAttachment,
  type TeacherContext,
  type TeacherMessage,
  type TeacherThread,
  type ThreadKey
} from '@shared/types'

/** How many prior messages ride along as conversation history. */
const HISTORY_LIMIT = 20

export interface StreamingState {
  requestId: string
  threadKey: ThreadKey
  text: string
  thinking: string
  /** True until the first token of either kind arrives. */
  waiting: boolean
  /** A course the Teacher offered mid-turn; attached to the finished message. */
  proposal?: CourseBrief
}

interface TeacherStore {
  state: ChatState
  loaded: boolean
  keyStatus: AiKeyStatus
  /** The thread the panel is currently showing. */
  activeKey: ThreadKey | null
  activeTitle: string
  /**
   * Prompt context for the active thread, published by the page the learner is
   * on and refreshed as they scroll.
   */
  context: TeacherContext | null
  /** Text the panel should drop into the composer on next open (selection-to-ask). */
  draft: string
  streaming: StreamingState | null

  load: () => Promise<void>
  refreshKeyStatus: () => Promise<void>
  openFor: (key: ThreadKey, title: string, draft?: string) => void
  setContext: (context: TeacherContext | null) => void
  setDraft: (draft: string) => void
  send: (prompt: string, attachments: PendingAttachment[]) => Promise<void>
  abort: () => void
  clearThread: (key: ThreadKey) => void
  clearAll: () => Promise<void>
  handleStreamEvent: (event: import('@shared/types').TeacherStreamEvent) => void
}

let flushTimer: ReturnType<typeof setTimeout> | null = null
function persist(state: ChatState): void {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void window.desklearner.chats.set(state), 400)
}

function newId(): string {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function threadKeyForLesson(
  courseId: string,
  chapterId: string,
  lessonId: string
): ThreadKey {
  return `${courseId}/${chapterId}/${lessonId}`
}

export function threadKeyForTest(courseId: string, testId: string): ThreadKey {
  return `${courseId}/test/${testId}`
}

export function getThread(state: ChatState, key: ThreadKey | null): TeacherThread | null {
  if (!key) return null
  return state.threads[key] ?? null
}

function upsertThread(
  state: ChatState,
  key: ThreadKey,
  title: string,
  fn: (messages: TeacherMessage[]) => TeacherMessage[]
): ChatState {
  const existing = state.threads[key]
  const thread: TeacherThread = {
    key,
    title: existing?.title ?? title,
    messages: fn(existing?.messages ?? []),
    updatedAt: new Date().toISOString()
  }
  return { threads: { ...state.threads, [key]: thread } }
}

export const useTeacher = create<TeacherStore>((set, get) => ({
  state: EMPTY_CHATS,
  loaded: false,
  keyStatus: { configured: false, encryptionAvailable: true },
  activeKey: null,
  activeTitle: '',
  context: null,
  draft: '',
  streaming: null,

  load: async () => {
    const [state, keyStatus] = await Promise.all([
      window.desklearner.chats.get(),
      window.desklearner.ai.keyStatus()
    ])
    set({ state: state ?? EMPTY_CHATS, keyStatus, loaded: true })
  },

  refreshKeyStatus: async () => {
    set({ keyStatus: await window.desklearner.ai.keyStatus() })
  },

  openFor: (key, title, draft) => {
    set((prev) => ({
      activeKey: key,
      activeTitle: title,
      draft: draft ?? prev.draft
    }))
  },

  setContext: (context) => set({ context }),

  setDraft: (draft) => set({ draft }),

  send: async (prompt, attachments) => {
    const { activeKey, activeTitle, context, state, loaded, streaming } = get()
    if (!activeKey || !context || streaming) return
    // Never write before the store has loaded — the same guard the progress
    // store uses, so a slow disk read cannot clobber saved threads.
    if (!loaded) return

    const requestId = newId()
    const history = (state.threads[activeKey]?.messages ?? []).slice(-HISTORY_LIMIT)

    // Show the learner's turn immediately; attachment descriptors are filled in
    // once the main process has written the bytes.
    const userMessage: TeacherMessage = {
      id: newId(),
      role: 'user',
      text: prompt,
      createdAt: new Date().toISOString()
    }

    set({
      state: upsertThread(state, activeKey, activeTitle, (messages) => [...messages, userMessage]),
      draft: '',
      streaming: { requestId, threadKey: activeKey, text: '', thinking: '', waiting: true }
    })

    const result = await window.desklearner.ai.send({
      requestId,
      threadKey: activeKey,
      context,
      history,
      prompt,
      attachments
    })

    if (!result.ok) {
      get().handleStreamEvent({
        requestId,
        type: 'error',
        message: result.error ?? 'Could not send the message.'
      })
      return
    }

    if (result.attachments?.length) {
      set((prev) => ({
        state: upsertThread(prev.state, activeKey, activeTitle, (messages) =>
          messages.map((m) =>
            m.id === userMessage.id ? { ...m, attachments: result.attachments } : m
          )
        )
      }))
    }

    persist(get().state)
  },

  abort: () => {
    const { streaming } = get()
    if (!streaming) return
    void window.desklearner.ai.abort(streaming.requestId)
  },

  clearThread: (key) => {
    const { state } = get()
    const threads = { ...state.threads }
    delete threads[key]
    const next = { threads }
    set({ state: next })
    persist(next)
  },

  clearAll: async () => {
    const next = await window.desklearner.chats.clear()
    set({ state: next ?? EMPTY_CHATS })
  },

  handleStreamEvent: (event) => {
    const { streaming } = get()
    // Ignore anything from a request we are no longer tracking (aborted, or a
    // stale window that outlived its panel).
    if (!streaming || streaming.requestId !== event.requestId) return

    if (event.type === 'text-delta') {
      set({ streaming: { ...streaming, text: streaming.text + event.text, waiting: false } })
      return
    }

    if (event.type === 'thinking-delta') {
      set({
        streaming: { ...streaming, thinking: streaming.thinking + event.text, waiting: false }
      })
      return
    }

    if (event.type === 'course-proposal') {
      set({ streaming: { ...streaming, proposal: event.proposal, waiting: false } })
      return
    }

    const { state, activeTitle } = get()
    const message: TeacherMessage = {
      id: newId(),
      role: 'assistant',
      text: streaming.text,
      thinking: streaming.thinking.trim() || undefined,
      proposal: streaming.proposal,
      createdAt: new Date().toISOString(),
      error: event.type === 'error' ? event.message : undefined
    }

    // A stopped generation keeps whatever arrived; an error with nothing
    // streamed still needs a bubble so the learner sees what went wrong.
    if (event.type === 'done' && !message.text.trim() && !message.thinking && !message.proposal) {
      set({ streaming: null })
      return
    }

    const next = upsertThread(state, streaming.threadKey, activeTitle, (messages) => [
      ...messages,
      message
    ])
    set({ state: next, streaming: null })
    persist(next)
  }
}))
