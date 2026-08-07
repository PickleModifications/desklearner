import { app } from 'electron'
import { promises as fs } from 'node:fs'
import fsSync from 'node:fs'
import path from 'node:path'

/**
 * A tiny JSON-file store with atomic writes and debounced flushes.
 *
 * Deliberately dependency-free: no native modules means `npm install` and
 * `electron-builder` stay trouble-free on every platform.
 */
export class JsonStore<T extends object> {
  readonly filePath: string
  private readonly defaults: T
  private cache: T
  private timer: NodeJS.Timeout | null = null
  private writing: Promise<void> = Promise.resolve()

  constructor(fileName: string, defaults: T) {
    this.filePath = path.join(app.getPath('userData'), fileName)
    this.defaults = defaults
    this.cache = structuredClone(defaults)
    this.loadSync()
  }

  private loadSync(): void {
    try {
      const raw = fsSync.readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<T>
      this.cache = { ...structuredClone(this.defaults), ...parsed }
    } catch {
      // Missing or corrupt file: fall back to defaults and rewrite on first change.
      this.cache = structuredClone(this.defaults)
    }
  }

  get(): T {
    return this.cache
  }

  set(next: T): T {
    this.cache = next
    this.scheduleFlush()
    return this.cache
  }

  patch(patch: Partial<T>): T {
    this.cache = { ...this.cache, ...patch }
    this.scheduleFlush()
    return this.cache
  }

  reset(): T {
    this.cache = structuredClone(this.defaults)
    this.scheduleFlush()
    return this.cache
  }

  private scheduleFlush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), 250)
  }

  /** Write pending changes to disk. Safe to call at any time. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const snapshot = JSON.stringify(this.cache, null, 2)
    // Serialise writes so a fast burst of updates can never interleave.
    this.writing = this.writing.then(async () => {
      const tmp = `${this.filePath}.tmp`
      await fs.mkdir(path.dirname(this.filePath), { recursive: true })
      await fs.writeFile(tmp, snapshot, 'utf8')
      await fs.rename(tmp, this.filePath)
    })
    return this.writing
  }

  flushSync(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    try {
      fsSync.mkdirSync(path.dirname(this.filePath), { recursive: true })
      const tmp = `${this.filePath}.tmp`
      fsSync.writeFileSync(tmp, JSON.stringify(this.cache, null, 2), 'utf8')
      fsSync.renameSync(tmp, this.filePath)
    } catch {
      /* best effort on quit */
    }
  }
}
