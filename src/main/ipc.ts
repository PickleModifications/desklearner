import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { CH } from '@shared/channels'
import {
  DEFAULT_SETTINGS,
  EMPTY_CHATS,
  EMPTY_PROGRESS,
  type AppInfo,
  type ChatState,
  type ExportBundle,
  type ProgressState,
  type Settings,
  type TeacherSendRequest,
  type ThemeMode
} from '@shared/types'
import { JsonStore } from './store'
import { abort as abortAiRequest, invalidateClient, streamTeacher } from './ai'
import { gc as gcAttachments, pickAttachments, readAttachment, saveAttachments } from './attachments'
import { clearKey, getKeyStatus, setKey } from './secrets'
import {
  buildSearchCorpus,
  findCourse,
  invalidateContentCache,
  listContent,
  loadLesson,
  loadTest,
  userCoursesDir
} from './content'
import {
  importPackFromArchive,
  importPackFromFolder,
  openDataFolder,
  removePack,
  revealCoursesFolder
} from './packs'
import { isExportBundle, listBackups, writeBackup } from './backups'

export let settingsStore: JsonStore<Settings>
export let progressStore: JsonStore<ProgressState>
export let chatsStore: JsonStore<ChatState>

/** Keeps `chats.json` bounded no matter how long a learner talks to the Teacher. */
const MAX_THREADS = 50
const MAX_MESSAGES_PER_THREAD = 40

export function createStores(): void {
  settingsStore = new JsonStore<Settings>('settings.json', DEFAULT_SETTINGS)
  progressStore = new JsonStore<ProgressState>('progress.json', EMPTY_PROGRESS)
  chatsStore = new JsonStore<ChatState>('chats.json', EMPTY_CHATS)
}

export function flushStores(): void {
  settingsStore?.flushSync()
  progressStore?.flushSync()
  chatsStore?.flushSync()
}

function pruneChats(next: ChatState): ChatState {
  const threads = Object.values(next.threads ?? {})
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, MAX_THREADS)

  const pruned: ChatState['threads'] = {}
  for (const thread of threads) {
    pruned[thread.key] = {
      ...thread,
      messages: thread.messages.slice(-MAX_MESSAGES_PER_THREAD)
    }
  }
  return { threads: pruned }
}

/** Every attachment file still referenced by a stored message. */
function liveAttachmentFiles(state: ChatState): Set<string> {
  const files = new Set<string>()
  for (const thread of Object.values(state.threads ?? {})) {
    for (const message of thread.messages) {
      for (const attachment of message.attachments ?? []) files.add(attachment.file)
    }
  }
  return files
}

/** Drops attachment files orphaned by pruning, a crash, or a manual clear. */
export function collectAttachmentGarbage(): void {
  void gcAttachments(liveAttachmentFiles(chatsStore.get())).catch(() => undefined)
}

function windowFrom(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerIpc(): void {
  /* --------------------------------------------------------------- info */
  ipcMain.handle(CH.info, (): AppInfo => {
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      userDataPath: app.getPath('userData'),
      coursesPath: userCoursesDir()
    }
  })

  /* ----------------------------------------------------------- settings */
  ipcMain.handle(CH.settingsGet, () => settingsStore.get())
  ipcMain.handle(CH.settingsSet, (_e, patch: Partial<Settings>) => {
    const next = settingsStore.patch(patch)
    if (patch.theme) nativeTheme.themeSource = patch.theme
    return next
  })
  ipcMain.handle(CH.settingsReset, () => {
    const next = settingsStore.reset()
    nativeTheme.themeSource = next.theme
    return next
  })

  /* ----------------------------------------------------------- progress */
  ipcMain.handle(CH.progressGet, () => progressStore.get())
  ipcMain.handle(CH.progressSet, (_e, next: ProgressState) => {
    progressStore.set(next)
  })
  ipcMain.handle(CH.progressReset, async () => {
    if (settingsStore.get().autoBackup) {
      await writeBackup(settingsStore.get(), progressStore.get()).catch(() => undefined)
    }
    return progressStore.reset()
  })

  /* ------------------------------------------------------------ content */
  ipcMain.handle(CH.contentList, () => listContent())
  ipcMain.handle(CH.contentLesson, (_e, courseId: string, chapterId: string, lessonId: string) =>
    loadLesson(courseId, chapterId, lessonId)
  )
  ipcMain.handle(CH.contentTest, (_e, courseId: string, testId: string) =>
    loadTest(courseId, testId)
  )
  ipcMain.handle(CH.contentCorpus, () => buildSearchCorpus())
  ipcMain.handle(CH.contentAssetUrl, async (_e, courseId: string, relative: string) => {
    await findCourse(courseId)
    const clean = relative.replace(/^[./\\]+/, '').replace(/\\/g, '/')
    return `dl-asset://${encodeURIComponent(courseId)}/${clean.split('/').map(encodeURIComponent).join('/')}`
  })

  /* --------------------------------------------------------- teacher ai */
  ipcMain.handle(CH.aiKeyStatus, () => getKeyStatus())

  // The `aiEnabled` setting is flipped by the renderer alongside these, so the
  // settings store keeps a single owner.
  ipcMain.handle(CH.aiKeySet, async (_e, key: string) => {
    const status = await setKey(key)
    invalidateClient()
    return status
  })

  ipcMain.handle(CH.aiKeyClear, async () => {
    const status = await clearKey()
    invalidateClient()
    return status
  })

  ipcMain.handle(CH.aiPickAttachments, async (e) => pickAttachments(windowFrom(e)))

  ipcMain.handle(CH.aiReadAttachment, (_e, file: string) => readAttachment(file))

  ipcMain.handle(CH.aiSend, async (e, request: TeacherSendRequest) => {
    const win = windowFrom(e)
    if (!win) return { ok: false, error: 'No window' }

    // Persist the staged bytes only now that the turn is actually being sent.
    const attachments = await saveAttachments(request.attachments ?? [])

    // Fire and forget: the answer arrives on the push channel, not here.
    void streamTeacher(win, request, request.attachments ?? [])

    return { ok: true, attachments }
  })

  ipcMain.handle(CH.aiAbort, (_e, requestId: string) => {
    abortAiRequest(requestId)
  })

  /* -------------------------------------------------------------- chats */
  ipcMain.handle(CH.chatsGet, () => chatsStore.get())
  ipcMain.handle(CH.chatsSet, (_e, next: ChatState) => {
    chatsStore.set(pruneChats(next))
    collectAttachmentGarbage()
  })
  ipcMain.handle(CH.chatsClear, () => {
    const next = chatsStore.reset()
    collectAttachmentGarbage()
    return next
  })

  /* -------------------------------------------------------------- packs */
  ipcMain.handle(CH.packImportFolder, async (e) => {
    const win = windowFrom(e)
    if (!win) return { ok: false, error: 'No window' }
    return importPackFromFolder(win)
  })
  ipcMain.handle(CH.packImportArchive, async (e) => {
    const win = windowFrom(e)
    if (!win) return { ok: false, error: 'No window' }
    return importPackFromArchive(win)
  })
  ipcMain.handle(CH.packRemove, (_e, courseId: string) => removePack(courseId))
  ipcMain.handle(CH.packReveal, () => revealCoursesFolder())

  /* --------------------------------------------------------------- data */
  ipcMain.handle(CH.dataExport, async (e) => {
    const win = windowFrom(e)
    if (!win) return { ok: false, error: 'No window' }
    const stamp = new Date().toISOString().slice(0, 10)
    const picked = await dialog.showSaveDialog(win, {
      title: 'Export DeskLearner data',
      defaultPath: path.join(app.getPath('documents'), `desklearner-backup-${stamp}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (picked.canceled || !picked.filePath) return { ok: false }
    const bundle: ExportBundle = {
      kind: 'desklearner-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: settingsStore.get(),
      progress: progressStore.get()
    }
    try {
      await fs.writeFile(picked.filePath, JSON.stringify(bundle, null, 2), 'utf8')
      return { ok: true, path: picked.filePath }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(CH.dataImport, async (e) => {
    const win = windowFrom(e)
    if (!win) return { ok: false, error: 'No window' }
    const picked = await dialog.showOpenDialog(win, {
      title: 'Import DeskLearner data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (picked.canceled || !picked.filePaths[0]) return { ok: false }
    return applyBundleFile(picked.filePaths[0])
  })

  ipcMain.handle(CH.dataBackups, () => listBackups())
  ipcMain.handle(CH.dataRestore, (_e, file: string) => applyBundleFile(file))
  ipcMain.handle(CH.dataOpenFolder, () => openDataFolder())

  /* ------------------------------------------------------------- window */
  ipcMain.on(CH.winMinimize, (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on(CH.winToggleMaximize, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on(CH.winClose, (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle(CH.winIsMaximized, (e) => windowFrom(e)?.isMaximized() ?? false)

  /* ------------------------------------------------------------- system */
  ipcMain.handle(CH.openExternal, async (_e, url: string) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) await shell.openExternal(url)
  })
  ipcMain.handle(CH.setThemeSource, (_e, mode: ThemeMode) => {
    nativeTheme.themeSource = mode
    return nativeTheme.shouldUseDarkColors
  })
}

async function applyBundleFile(file: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'))
    if (!isExportBundle(parsed)) return { ok: false, error: 'Not a DeskLearner backup file' }
    if (settingsStore.get().autoBackup) {
      await writeBackup(settingsStore.get(), progressStore.get()).catch(() => undefined)
    }
    settingsStore.set({ ...DEFAULT_SETTINGS, ...parsed.settings })
    progressStore.set({ ...EMPTY_PROGRESS, ...parsed.progress })
    await Promise.all([settingsStore.flush(), progressStore.flush()])
    nativeTheme.themeSource = settingsStore.get().theme
    invalidateContentCache()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
