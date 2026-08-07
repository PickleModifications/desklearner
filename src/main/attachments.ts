import { app, dialog, nativeImage, type BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import {
  DIALOG_FILTERS,
  MAX_IMAGE_EDGE,
  extensionOf,
  kindFor,
  validateAttachments
} from '@shared/attachments'
import type { PendingAttachment, TeacherAttachment } from '@shared/types'

/**
 * Everything file-shaped for chat attachments, so the renderer never touches
 * `fs`. Bytes live in `<userData>/chat-attachments/`; `chats.json` only ever
 * holds the descriptors returned by `saveAttachments`.
 */

const THUMB_EDGE = 128

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  json: 'application/json',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
  css: 'text/css',
  yml: 'text/yaml',
  yaml: 'text/yaml'
}

export function attachmentsDir(): string {
  return path.join(app.getPath('userData'), 'chat-attachments')
}

function mediaTypeFor(fileName: string): string {
  return MIME_BY_EXTENSION[extensionOf(fileName)] ?? 'text/plain'
}

/**
 * `nativeImage` handles PNG and JPEG everywhere. GIF and WebP are unreliable
 * across platforms, and resizing a GIF would drop its animation, so those pass
 * through untouched.
 */
function isResizable(mediaType: string): boolean {
  return mediaType === 'image/png' || mediaType === 'image/jpeg'
}

interface ProcessedImage {
  data: string
  sizeBytes: number
  thumb?: string
}

/**
 * Downscales to Claude Opus 5's 2576px high-resolution ceiling — anything
 * larger burns visual tokens for no accuracy gain — and renders a small
 * thumbnail for the composer tray.
 */
function processImage(buffer: Buffer, mediaType: string): ProcessedImage {
  if (!isResizable(mediaType)) {
    return { data: buffer.toString('base64'), sizeBytes: buffer.byteLength }
  }

  let image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) {
    return { data: buffer.toString('base64'), sizeBytes: buffer.byteLength }
  }

  const { width, height } = image.getSize()
  const longest = Math.max(width, height)

  if (longest > MAX_IMAGE_EDGE) {
    image =
      width >= height
        ? image.resize({ width: MAX_IMAGE_EDGE, quality: 'good' })
        : image.resize({ height: MAX_IMAGE_EDGE, quality: 'good' })
  }

  const encoded = mediaType === 'image/jpeg' ? image.toJPEG(88) : image.toPNG()
  const thumbEdge = Math.min(THUMB_EDGE, Math.max(image.getSize().width, image.getSize().height))
  const thumb = image.resize({
    ...(image.getSize().width >= image.getSize().height
      ? { width: thumbEdge }
      : { height: thumbEdge }),
    quality: 'good'
  })

  return {
    data: encoded.toString('base64'),
    sizeBytes: encoded.byteLength,
    thumb: thumb.isEmpty() ? undefined : thumb.toDataURL()
  }
}

/** Builds a staging-ready attachment from raw file bytes. */
export function toPending(fileName: string, buffer: Buffer): PendingAttachment | null {
  const name = path.basename(fileName)
  const mediaType = mediaTypeFor(name)
  const kind = kindFor(name, mediaType)
  if (!kind) return null

  if (kind === 'image') {
    const processed = processImage(buffer, mediaType)
    return {
      id: randomUUID(),
      kind,
      name,
      mediaType,
      sizeBytes: processed.sizeBytes,
      data: processed.data,
      thumb: processed.thumb
    }
  }

  return {
    id: randomUUID(),
    kind,
    name,
    mediaType,
    sizeBytes: buffer.byteLength,
    data: buffer.toString('base64')
  }
}

export async function pickAttachments(
  win: BrowserWindow | null
): Promise<{ accepted: PendingAttachment[]; rejected: string[] }> {
  const result = win
    ? await dialog.showOpenDialog(win, {
        title: 'Attach files',
        properties: ['openFile', 'multiSelections'],
        filters: DIALOG_FILTERS
      })
    : await dialog.showOpenDialog({
        title: 'Attach files',
        properties: ['openFile', 'multiSelections'],
        filters: DIALOG_FILTERS
      })

  if (result.canceled || result.filePaths.length === 0) {
    return { accepted: [], rejected: [] }
  }

  const candidates: PendingAttachment[] = []
  const rejected: string[] = []

  for (const filePath of result.filePaths) {
    const name = path.basename(filePath)
    try {
      const buffer = await fs.readFile(filePath)
      const pending = toPending(filePath, buffer)
      if (pending) candidates.push(pending)
      else rejected.push(`${name} — unsupported file type`)
    } catch {
      rejected.push(`${name} — could not be read`)
    }
  }

  const validated = validateAttachments(candidates)
  return {
    accepted: validated.accepted,
    rejected: [...rejected, ...validated.rejected.map((r) => `${r.name} — ${r.reason}`)]
  }
}

/**
 * Persists staged bytes and returns descriptors for `chats.json`. Called only
 * once a turn is actually sent, so abandoned drafts leave nothing behind.
 */
export async function saveAttachments(pending: PendingAttachment[]): Promise<TeacherAttachment[]> {
  if (pending.length === 0) return []

  const dir = attachmentsDir()
  await fs.mkdir(dir, { recursive: true })

  const saved: TeacherAttachment[] = []

  for (const item of pending) {
    const ext = extensionOf(item.name) || 'bin'
    const file = `${item.id}.${ext}`
    const target = path.join(dir, file)
    const tmp = `${target}.tmp`

    try {
      await fs.writeFile(tmp, Buffer.from(item.data, 'base64'))
      await fs.rename(tmp, target)
    } catch {
      // A file we cannot persist is dropped from the transcript rather than
      // leaving a descriptor pointing at nothing.
      continue
    }

    saved.push({
      id: item.id,
      kind: item.kind,
      name: item.name,
      mediaType: item.mediaType,
      sizeBytes: item.sizeBytes,
      file,
      thumb: item.thumb
    })
  }

  return saved
}

/** Reads a saved attachment back as base64, for replaying history. */
export async function readAttachment(file: string): Promise<string | null> {
  const safe = path.basename(file)
  try {
    const buffer = await fs.readFile(path.join(attachmentsDir(), safe))
    return buffer.toString('base64')
  } catch {
    return null
  }
}

/** Deletes attachment files no longer referenced by any thread. */
export async function gc(liveFiles: Set<string>): Promise<void> {
  const dir = attachmentsDir()
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return
  }

  await Promise.all(
    entries
      .filter((entry) => !liveFiles.has(entry))
      .map((entry) => fs.rm(path.join(dir, entry), { force: true }).catch(() => undefined))
  )
}
