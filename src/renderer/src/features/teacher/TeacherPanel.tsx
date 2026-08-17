import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, KeyRound, Trash2, Upload, X } from 'lucide-react'
import type { PendingAttachment, TeacherAttachment } from '@shared/types'
import { Modal } from '@/components/Modal'
import { CourseLinkProvider } from '@/markdown/CourseLinks'
import { buildCourseLinkResolver } from '@/markdown/courseLinkResolver'
import { findCoursePack, useContent } from '@/stores/content'
import { useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { getThread, useTeacher } from '@/stores/teacher'
import { useUi } from '@/stores/ui'
import { cn } from '@/lib/utils'
import { QUICK_ACTIONS } from './prompts'
import { StreamingBubble, TeacherBubble } from './TeacherBubble'
import { TeacherComposer } from './TeacherComposer'
import { filesFromTransfer, stageFiles } from './staging'

/** Shown until the learner has supplied an API key. */
function NoKeyState(): React.JSX.Element {
  const navigate = useNavigate()
  const setOpen = useUi((s) => s.setTeacherOpen)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
      >
        <KeyRound size={19} />
      </span>
      <div>
        <p className="text-[13px] font-semibold">Teacher AI is off</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-subtle">
          Add your own Anthropic API key to ask questions about whatever you are reading. Your key
          stays encrypted on this machine.
        </p>
      </div>
      <button
        className="btn btn-primary h-7 text-[12px]"
        onClick={() => {
          setOpen(false)
          navigate('/settings#teacher')
        }}
      >
        Add your API key
      </button>
    </div>
  )
}

export function TeacherPanel(): React.JSX.Element | null {
  const open = useUi((s) => s.teacherOpen)
  const setOpen = useUi((s) => s.setTeacherOpen)
  const toast = useUi((s) => s.toast)

  const showThinking = useSettings((s) => s.settings.aiShowThinking)
  const reducedMotion = useSettings((s) => s.settings.reducedMotion)

  const state = useTeacher((s) => s.state)
  const activeKey = useTeacher((s) => s.activeKey)
  const activeTitle = useTeacher((s) => s.activeTitle)
  const keyStatus = useTeacher((s) => s.keyStatus)
  const streaming = useTeacher((s) => s.streaming)
  const draft = useTeacher((s) => s.draft)
  const setDraft = useTeacher((s) => s.setDraft)
  const send = useTeacher((s) => s.send)
  const abort = useTeacher((s) => s.abort)
  const clearThread = useTeacher((s) => s.clearThread)

  const context = useTeacher((s) => s.context)
  const index = useContent((s) => s.index)
  const progress = useProgress((s) => s.state)

  // Turns `lesson:` / `test:` links in an answer into clickable pills.
  const pack = findCoursePack(index, context?.courseId ?? '')
  const linkResolver = useMemo(() => buildCourseLinkResolver(pack, progress), [pack, progress])

  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [dragging, setDragging] = useState(false)
  const [lightbox, setLightbox] = useState<TeacherAttachment | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const thread = getThread(state, activeKey)
  const messages = thread?.messages ?? []

  // Keep the panel mounted through the close animation so it can play out.
  useEffect(() => {
    if (open) {
      setClosing(false)
      return
    }
    if (reducedMotion) return
    setClosing(true)
    const timer = setTimeout(() => setClosing(false), 140)
    return () => clearTimeout(timer)
  }, [open, reducedMotion])

  // Pin to the newest message as the answer streams in.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streaming?.text, streaming?.thinking, open])

  // Staged files belong to the thread the learner staged them in.
  useEffect(() => setAttachments([]), [activeKey])

  // The chip only holds a 128px thumbnail; the lightbox reads the real file.
  useEffect(() => {
    if (!lightbox) {
      setLightboxSrc(null)
      return
    }
    let cancelled = false
    setLightboxSrc(lightbox.thumb ?? null)
    void window.desklearner.ai.readAttachment(lightbox.file).then((data) => {
      if (!cancelled && data) setLightboxSrc(`data:${lightbox.mediaType};base64,${data}`)
    })
    return () => {
      cancelled = true
    }
  }, [lightbox])

  /**
   * Following a pill navigates to another lesson, which swaps the panel to that
   * lesson's own thread. Closing first keeps that from happening under the
   * learner's eyes — the conversation is still there when they come back.
   *
   * Must stay above the early return below: every hook has to run on every
   * render, open or closed.
   */
  const dismissForNavigation = useCallback(() => setOpen(false), [setOpen])

  if (!open && !closing) return null

  const isStreaming = Boolean(streaming)
  const disabled = !keyStatus.configured

  async function handleDrop(event: React.DragEvent): Promise<void> {
    event.preventDefault()
    setDragging(false)
    if (isStreaming || disabled) return

    const files = filesFromTransfer(event.dataTransfer)
    if (files.length === 0) return

    const { accepted, rejected } = await stageFiles(files, attachments)
    if (accepted.length) setAttachments((prev) => [...prev, ...accepted])
    for (const rejection of rejected) toast(`${rejection.name} — ${rejection.reason}`, 'error')
  }

  function handleSend(): void {
    const prompt = draft.trim()
    if (!prompt && attachments.length === 0) return
    const staged = attachments
    setAttachments([])
    void send(prompt, staged)
  }

  return (
    <>
      <div
        className={cn(
          'fixed right-5 bottom-24 z-40 flex flex-col overflow-hidden rounded-2xl border border-line shadow-e3',
          !reducedMotion && (open ? 'teacher-pop-in' : 'teacher-pop-out')
        )}
        style={{
          width: 'min(392px, calc(100vw - 2.5rem))',
          height: 'min(560px, calc(100vh - 11rem))',
          background: 'var(--bg-elevated)'
        }}
        role="dialog"
        aria-label="Teacher"
        onDragOver={(e) => {
          e.preventDefault()
          if (!isStreaming && !disabled) setDragging(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setDragging(false)
        }}
        onDrop={(e) => void handleDrop(e)}
      >
        <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
          >
            <GraduationCap size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">Teacher</div>
            <div className="truncate text-[11px] text-ink-subtle">
              {activeTitle || 'No lesson open'}
            </div>
          </div>
          {messages.length > 0 && (
            <button
              className="btn btn-ghost h-7 w-7 !px-0"
              onClick={() => activeKey && clearThread(activeKey)}
              aria-label="Clear this conversation"
              title="Clear this conversation"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            className="btn btn-ghost h-7 w-7 !px-0"
            onClick={() => setOpen(false)}
            aria-label="Close teacher"
          >
            <X size={14} />
          </button>
        </header>

        {disabled ? (
          <NoKeyState />
        ) : (
          <CourseLinkProvider resolver={linkResolver} onNavigate={dismissForNavigation}>
            <div ref={scrollRef} className="scroll-area flex-1 space-y-3 px-3 py-3">
              {messages.length === 0 && !isStreaming && (
                <div className="space-y-3 py-2">
                  <p className="text-[12.5px] leading-relaxed text-ink-muted">
                    Ask me anything about this lesson. I can see what you are reading, and you can
                    paste screenshots or attach files.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        className="rounded-full border border-line px-2.5 py-1 text-[11.5px] transition-colors hover:border-accent-border"
                        style={{ background: 'var(--surface)' }}
                        onClick={() => void send(action.prompt, [])}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <TeacherBubble key={message.id} message={message} onOpenImage={setLightbox} />
              ))}

              {streaming && (
                <StreamingBubble
                  text={streaming.text}
                  thinking={streaming.thinking}
                  waiting={streaming.waiting}
                  showThinking={showThinking}
                  proposal={streaming.proposal}
                />
              )}
            </div>

            <TeacherComposer
              value={draft}
              onChange={setDraft}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              onSend={handleSend}
              onStop={abort}
              streaming={isStreaming}
            />
          </CourseLinkProvider>
        )}

        {dragging && (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-[12.5px] font-medium"
            style={{
              background: 'color-mix(in oklab, var(--bg-elevated) 88%, transparent)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-text)'
            }}
          >
            <Upload size={20} />
            Drop to attach
          </div>
        )}
      </div>

      <Modal open={Boolean(lightbox)} onClose={() => setLightbox(null)}>
        {lightbox && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className="flex-1 truncate text-[12.5px] font-medium">{lightbox.name}</span>
              <button
                className="btn btn-ghost h-7 w-7 !px-0"
                onClick={() => setLightbox(null)}
                aria-label="Close image"
              >
                <X size={14} />
              </button>
            </div>
            {lightboxSrc ? (
              <img
                src={lightboxSrc}
                alt={lightbox.name}
                className="max-h-[70vh] w-full object-contain"
              />
            ) : (
              <p className="px-3 py-6 text-center text-[12.5px] text-ink-subtle">
                This attachment is no longer stored on disk.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
