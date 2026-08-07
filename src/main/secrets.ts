import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import fsSync from 'node:fs'
import path from 'node:path'
import type { AiKeyStatus } from '@shared/types'

/**
 * Storage for the Anthropic API key.
 *
 * Deliberately not a `JsonStore`: that writes plaintext. The key is encrypted
 * with the OS credential store via `safeStorage` and lives in its own file, so
 * it never appears in `settings.json` or in an exported backup.
 */

const KEY_FILE = 'ai-key.dat'
const META_FILE = 'ai-key.meta.json'

interface KeyMeta {
  lastFour: string
}

/** Held in memory when the OS cannot encrypt, so the key at least lasts the session. */
let sessionKey: string | null = null

function keyPath(): string {
  return path.join(app.getPath('userData'), KEY_FILE)
}

function metaPath(): string {
  return path.join(app.getPath('userData'), META_FILE)
}

function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

async function writeAtomic(target: string, data: Buffer | string): Promise<void> {
  const tmp = `${target}.tmp`
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(tmp, data)
  await fs.rename(tmp, target)
}

function readMeta(): KeyMeta | null {
  try {
    return JSON.parse(fsSync.readFileSync(metaPath(), 'utf8')) as KeyMeta
  } catch {
    return null
  }
}

export function getKeyStatus(): AiKeyStatus {
  const available = encryptionAvailable()

  if (sessionKey) {
    return { configured: true, lastFour: sessionKey.slice(-4), encryptionAvailable: available }
  }

  if (!fsSync.existsSync(keyPath())) {
    return { configured: false, encryptionAvailable: available }
  }

  return {
    configured: true,
    lastFour: readMeta()?.lastFour,
    encryptionAvailable: available
  }
}

export async function setKey(plain: string): Promise<AiKeyStatus & { error?: string }> {
  const trimmed = plain.trim()
  if (!trimmed) return clearKey()

  sessionKey = trimmed

  if (!encryptionAvailable()) {
    // No OS credential store (common on a bare Linux desktop). Keep the key in
    // memory for this session rather than writing it to disk in the clear.
    return {
      configured: true,
      lastFour: trimmed.slice(-4),
      encryptionAvailable: false,
      error: 'This system has no secure credential store, so the key is kept for this session only.'
    }
  }

  try {
    await writeAtomic(keyPath(), safeStorage.encryptString(trimmed))
    await writeAtomic(metaPath(), JSON.stringify({ lastFour: trimmed.slice(-4) }, null, 2))
  } catch {
    return {
      configured: true,
      lastFour: trimmed.slice(-4),
      encryptionAvailable: true,
      error: 'Could not save the key to disk. It will be used for this session only.'
    }
  }

  return { configured: true, lastFour: trimmed.slice(-4), encryptionAvailable: true }
}

/**
 * Main-process only — never expose this over IPC. The renderer sees the key
 * status, never the key itself.
 */
export function readKey(): string | null {
  if (sessionKey) return sessionKey
  if (!encryptionAvailable()) return null

  try {
    const encrypted = fsSync.readFileSync(keyPath())
    const plain = safeStorage.decryptString(encrypted)
    sessionKey = plain
    return plain
  } catch {
    // Missing file, or the credential store changed under us (different user
    // profile, reinstalled OS). Treat as "no key" rather than crashing.
    return null
  }
}

export async function clearKey(): Promise<AiKeyStatus> {
  sessionKey = null
  await fs.rm(keyPath(), { force: true }).catch(() => undefined)
  await fs.rm(metaPath(), { force: true }).catch(() => undefined)
  return { configured: false, encryptionAvailable: encryptionAvailable() }
}
