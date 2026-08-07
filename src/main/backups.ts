import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { BackupFile, ExportBundle, ProgressState, Settings } from '@shared/types'

const MAX_BACKUPS = 15

export function backupsDir(): string {
  return path.join(app.getPath('userData'), 'backups')
}

/** Writes a timestamped snapshot and prunes to the most recent {@link MAX_BACKUPS}. */
export async function writeBackup(settings: Settings, progress: ProgressState): Promise<void> {
  const dir = backupsDir()
  await fs.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const bundle: ExportBundle = {
    kind: 'desklearner-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    progress
  }
  await fs.writeFile(path.join(dir, `backup-${stamp}.json`), JSON.stringify(bundle), 'utf8')

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort()
  for (const stale of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) {
    await fs.rm(path.join(dir, stale), { force: true })
  }
}

export async function listBackups(): Promise<BackupFile[]> {
  const dir = backupsDir()
  try {
    const names = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'))
    const out = await Promise.all(
      names.map(async (name) => {
        const full = path.join(dir, name)
        const stat = await fs.stat(full)
        return {
          name,
          path: full,
          createdAt: stat.mtime.toISOString(),
          sizeBytes: stat.size
        }
      })
    )
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    return []
  }
}

export function isExportBundle(value: unknown): value is ExportBundle {
  const v = value as ExportBundle
  return !!v && v.kind === 'desklearner-backup' && !!v.settings && !!v.progress
}
