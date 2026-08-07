import type { AttachmentKind, PendingAttachment } from './types'

/**
 * Attachment rules, shared by the main process (native file dialog) and the
 * renderer (clipboard paste + drag & drop). Both entry points must agree, so
 * the limits and the validator live here rather than being duplicated.
 */

export const MAX_ATTACHMENTS_PER_MESSAGE = 8

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_TEXT_BYTES = 200 * 1024
/** The API caps a request at 32 MB; leave room for the lesson body and history. */
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024

/** Claude Opus 5's high-resolution ceiling. Larger images cost tokens for nothing. */
export const MAX_IMAGE_EDGE = 2576

export const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number]

/** Extensions read as UTF-8 and inlined as fenced code rather than uploaded. */
const TEXT_EXTENSIONS = [
  'txt',
  'md',
  'markdown',
  'json',
  'jsonc',
  'csv',
  'tsv',
  'log',
  'yml',
  'yaml',
  'toml',
  'ini',
  'env',
  'xml',
  'html',
  'css',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'cs',
  'php',
  'sh',
  'bash',
  'ps1',
  'sql',
  'tf',
  'dockerfile',
  'conf'
] as const

/** Language hint for the fenced block we wrap text attachments in. */
const FENCE_LANGUAGE: Record<string, string> = {
  md: 'markdown',
  markdown: 'markdown',
  jsonc: 'json',
  yml: 'yaml',
  ps1: 'powershell',
  sh: 'bash',
  bash: 'bash',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  cs: 'csharp',
  tf: 'hcl',
  dockerfile: 'dockerfile'
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function fenceLanguageFor(name: string): string {
  const ext = extensionOf(name)
  return FENCE_LANGUAGE[ext] ?? ext
}

export function isImageMediaType(mediaType: string): mediaType is ImageMediaType {
  return (IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType)
}

export function isTextFile(name: string, mediaType: string): boolean {
  if (mediaType.startsWith('text/')) return true
  if (mediaType === 'application/json') return true
  return (TEXT_EXTENSIONS as readonly string[]).includes(extensionOf(name))
}

/** `null` when the file is not a type we accept. */
export function kindFor(name: string, mediaType: string): AttachmentKind | null {
  if (isImageMediaType(mediaType)) return 'image'
  if (mediaType === 'application/pdf' || extensionOf(name) === 'pdf') return 'pdf'
  if (isTextFile(name, mediaType)) return 'text'
  return null
}

export function maxBytesFor(kind: AttachmentKind): number {
  if (kind === 'image') return MAX_IMAGE_BYTES
  if (kind === 'pdf') return MAX_PDF_BYTES
  return MAX_TEXT_BYTES
}

/** Native file-dialog filters, kept in sync with `kindFor`. */
export const DIALOG_FILTERS = [
  {
    name: 'Images, PDFs and text files',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', ...TEXT_EXTENSIONS]
  },
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
  { name: 'PDF', extensions: ['pdf'] },
  { name: 'All files', extensions: ['*'] }
]

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface AttachmentRejection {
  name: string
  reason: string
}

export interface ValidationResult {
  accepted: PendingAttachment[]
  rejected: AttachmentRejection[]
}

/**
 * Filters candidates against the per-file and whole-message limits.
 *
 * `existing` is what is already staged, so counts and the total-size budget
 * carry across successive pastes.
 */
export function validateAttachments(
  candidates: PendingAttachment[],
  existing: PendingAttachment[] = []
): ValidationResult {
  const accepted: PendingAttachment[] = []
  const rejected: AttachmentRejection[] = []

  let count = existing.length
  let total = existing.reduce((sum, a) => sum + a.sizeBytes, 0)

  for (const candidate of candidates) {
    if (count >= MAX_ATTACHMENTS_PER_MESSAGE) {
      rejected.push({
        name: candidate.name,
        reason: `only ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`
      })
      continue
    }

    const limit = maxBytesFor(candidate.kind)
    if (candidate.sizeBytes > limit) {
      rejected.push({
        name: candidate.name,
        reason: `too large — ${candidate.kind} files are limited to ${formatBytes(limit)}`
      })
      continue
    }

    if (total + candidate.sizeBytes > MAX_TOTAL_BYTES) {
      rejected.push({
        name: candidate.name,
        reason: `would exceed the ${formatBytes(MAX_TOTAL_BYTES)} total limit`
      })
      continue
    }

    accepted.push(candidate)
    count += 1
    total += candidate.sizeBytes
  }

  return { accepted, rejected }
}
