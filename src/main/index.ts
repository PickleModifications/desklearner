import { app, BrowserWindow, nativeTheme, net, protocol, shell } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { CH } from '@shared/channels'
import { createStores, flushStores, registerIpc, progressStore, settingsStore } from './ipc'
import { findCourse, resolveInPack } from './content'
import { writeBackup } from './backups'

protocol.registerSchemesAsPrivileged([
  { scheme: 'dl-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 940,
    minHeight: 620,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#f6f7f9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  const notifyMaximize = (): void =>
    mainWindow?.webContents.send(CH.winMaximizeChanged, mainWindow.isMaximized())
  mainWindow.on('maximize', notifyMaximize)
  mainWindow.on('unmaximize', notifyMaximize)

  // Anything that tries to open a new window goes to the OS browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? ''
    if (new URL(url).origin !== new URL(current).origin) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

/** Serves images and other files from inside a course pack, sandboxed to the pack root. */
function registerAssetProtocol(): void {
  protocol.handle('dl-asset', async (request) => {
    try {
      const url = new URL(request.url)
      const courseId = decodeURIComponent(url.hostname)
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const pack = await findCourse(courseId)
      const file = resolveInPack(pack, relative)
      return net.fetch(pathToFileURL(file).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.desklearner.app')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    createStores()
    nativeTheme.themeSource = settingsStore.get().theme
    registerAssetProtocol()
    registerIpc()

    nativeTheme.on('updated', () => {
      mainWindow?.webContents.send(CH.nativeThemeChanged, nativeTheme.shouldUseDarkColors)
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    if (settingsStore.get().autoBackup) {
      await writeBackup(settingsStore.get(), progressStore.get()).catch(() => undefined)
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => flushStores())
}
