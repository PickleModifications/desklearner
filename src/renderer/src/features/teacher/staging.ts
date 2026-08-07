import {
  MAX_IMAGE_EDGE,
  kindFor,
  validateAttachments,
  type AttachmentRejection
} from '@shared/attachments'
import type { PendingAttachment } from '@shared/types'

/**
 * Turns clipboard/drag-and-drop `File`s into staged attachments.
 *
 * The native file-dialog path does the equivalent work in `main/attachments.ts`;
 * both funnel through the shared validator so the limits cannot drift.
 */

const THUMB_EDGE = 128

function newId(): string {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function stripDataPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  return comma < 0 ? dataUrl : dataUrl.slice(comma + 1)
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode the image'))
    img.src = src
  })
}

function drawScaled(img: HTMLImageElement, maxEdge: number, mediaType: string): string | null {
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = longest > maxEdge ? maxEdge / longest : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))

  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // Canvas can only re-encode as PNG, JPEG or WebP; anything else (GIF) falls
  // back to the original bytes upstream.
  return canvas.toDataURL(mediaType === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.88)
}

async function stageImage(file: File, name: string, mediaType: string): Promise<PendingAttachment> {
  const original = await readAsDataUrl(file)

  // Animated GIFs would lose their animation on a canvas round-trip, so they
  // pass through untouched.
  if (mediaType === 'image/gif') {
    return {
      id: newId(),
      kind: 'image',
      name,
      mediaType,
      sizeBytes: file.size,
      data: stripDataPrefix(original),
      thumb: original
    }
  }

  try {
    const img = await loadImage(original)
    const encodedType = mediaType === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    const full = drawScaled(img, MAX_IMAGE_EDGE, encodedType)
    const thumb = drawScaled(img, THUMB_EDGE, encodedType)
    if (!full) throw new Error('no canvas')

    const data = stripDataPrefix(full)
    return {
      id: newId(),
      kind: 'image',
      name,
      // Re-encoding changes the type; the block we send must declare the truth.
      mediaType: encodedType,
      // base64 expands by 4/3, so this is the decoded byte count.
      sizeBytes: Math.round((data.length * 3) / 4),
      data,
      thumb: thumb ?? undefined
    }
  } catch {
    return {
      id: newId(),
      kind: 'image',
      name,
      mediaType,
      sizeBytes: file.size,
      data: stripDataPrefix(original),
      thumb: original
    }
  }
}

export interface StagingResult {
  accepted: PendingAttachment[]
  rejected: AttachmentRejection[]
}

export async function stageFiles(
  files: File[],
  existing: PendingAttachment[]
): Promise<StagingResult> {
  const candidates: PendingAttachment[] = []
  const rejected: AttachmentRejection[] = []

  for (const file of files) {
    // A pasted screenshot has no name; give it something readable.
    const name = file.name || `pasted-image-${Date.now()}.png`
    const mediaType = file.type || 'application/octet-stream'
    const kind = kindFor(name, mediaType)

    if (!kind) {
      rejected.push({ name, reason: 'unsupported file type' })
      continue
    }

    try {
      if (kind === 'image') {
        candidates.push(await stageImage(file, name, mediaType))
      } else {
        const dataUrl = await readAsDataUrl(file)
        candidates.push({
          id: newId(),
          kind,
          name,
          mediaType: kind === 'pdf' ? 'application/pdf' : mediaType || 'text/plain',
          sizeBytes: file.size,
          data: stripDataPrefix(dataUrl)
        })
      }
    } catch {
      rejected.push({ name, reason: 'could not be read' })
    }
  }

  const validated = validateAttachments(candidates, existing)
  return { accepted: validated.accepted, rejected: [...rejected, ...validated.rejected] }
}

/** Pulls `File`s out of a paste or drop event, ignoring plain-text payloads. */
export function filesFromTransfer(transfer: DataTransfer | null): File[] {
  if (!transfer) return []
  return Array.from(transfer.files ?? [])
}
