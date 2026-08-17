import { app, dialog, shell, type BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ImportResult } from '@shared/types'
import { courseManifestSchema, formatZodError } from './schema'
import { invalidateContentCache, listContent, userCoursesDir } from './content'
import { extractZip } from './unzip'

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/** A pack folder may be the manifest's own directory or a single wrapper folder. */
async function locatePackRoot(dir: string): Promise<string | null> {
  if (await exists(path.join(dir, 'course.json'))) return dir
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const dirs = entries.filter((e) => e.isDirectory())
  if (dirs.length === 1) {
    const nested = path.join(dir, dirs[0].name)
    if (await exists(path.join(nested, 'course.json'))) return nested
  }
  return null
}

/** Validates a staged pack directory and copies it into the user's course folder. */
export async function installPackFrom(sourceDir: string): Promise<ImportResult> {
  const root = await locatePackRoot(sourceDir)
  if (!root) return { ok: false, error: 'No course.json found in the selected folder' }

  let manifest
  try {
    const parsed = courseManifestSchema.safeParse(
      JSON.parse(await fs.readFile(path.join(root, 'course.json'), 'utf8'))
    )
    if (!parsed.success) {
      return { ok: false, error: `Invalid course.json — ${formatZodError(parsed.error)}` }
    }
    manifest = parsed.data
  } catch (err) {
    return { ok: false, error: `Could not read course.json — ${(err as Error).message}` }
  }

  const dest = path.join(userCoursesDir(), manifest.id)
  if (path.resolve(dest) === path.resolve(root)) {
    invalidateContentCache()
    return { ok: true, courseId: manifest.id }
  }

  await fs.mkdir(userCoursesDir(), { recursive: true })
  await fs.rm(dest, { recursive: true, force: true })
  await fs.cp(root, dest, { recursive: true })
  invalidateContentCache()
  return { ok: true, courseId: manifest.id }
}

export async function importPackFromFolder(win: BrowserWindow): Promise<ImportResult> {
  const picked = await dialog.showOpenDialog(win, {
    title: 'Select a course pack folder',
    properties: ['openDirectory']
  })
  if (picked.canceled || !picked.filePaths[0]) return { ok: false }
  try {
    return await installPackFrom(picked.filePaths[0])
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function importPackFromArchive(win: BrowserWindow): Promise<ImportResult> {
  const picked = await dialog.showOpenDialog(win, {
    title: 'Select a course pack archive',
    filters: [{ name: 'Course pack', extensions: ['zip', 'dlpack'] }],
    properties: ['openFile']
  })
  if (picked.canceled || !picked.filePaths[0]) return { ok: false }

  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'desklearner-pack-'))
  try {
    await extractZip(picked.filePaths[0], staging)
    return await installPackFrom(staging)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  } finally {
    await fs.rm(staging, { recursive: true, force: true })
  }
}

export async function removePack(courseId: string): Promise<{ ok: boolean; error?: string }> {
  const { courses } = await listContent()
  const pack = courses.find((c) => c.manifest.id === courseId)
  if (!pack) return { ok: false, error: 'Course not found' }
  if (pack.source === 'bundled') {
    return { ok: false, error: 'Built-in courses cannot be removed' }
  }
  await fs.rm(pack.root, { recursive: true, force: true })
  invalidateContentCache()
  return { ok: true }
}

export async function revealCoursesFolder(): Promise<void> {
  const dir = userCoursesDir()
  await fs.mkdir(dir, { recursive: true })
  await shell.openPath(dir)
}

export async function openDataFolder(): Promise<void> {
  await shell.openPath(app.getPath('userData'))
}
