import { app, BrowserWindow, nativeTheme, net, protocol, shell } from 'electron'
import path from 'node:path'
import { rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { CH } from '@shared/channels'
import {
  collectAttachmentGarbage,
  createStores,
  flushStores,
  registerIpc,
  progressStore,
  settingsStore
} from './ipc'
import { abortAll } from './ai'
import { findCourse, resolveInPack } from './content'
import { writeBackup } from './backups'

protocol.registerSchemesAsPrivileged([
  { scheme: 'dl-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

// A smoke run writes progress and settings, so it gets a throwaway data
// directory, wiped each time so runs cannot influence each other. Must happen
// before the app is ready.
if (process.env['DESKLEARNER_SMOKE']) {
  const smokeDir = path.join(app.getPath('temp'), 'desklearner-smoke')
  rmSync(smokeDir, { recursive: true, force: true })
  app.setPath('userData', smokeDir)
}

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
      spellcheck: true,
      // The smoke run asserts on viewport-dependent rendering — lazily
      // highlighted code, sections the reader skips while off screen — which
      // Chromium stops updating as soon as the window is occluded by whatever
      // terminal the run was started from.
      backgroundThrottling: !process.env['DESKLEARNER_SMOKE']
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

  // Surface renderer errors in the terminal during development and smoke runs.
  if (is.dev || process.env['DESKLEARNER_SMOKE']) {
    mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
      if (level >= 2) console.error(`[renderer] ${source}:${line} ${message}`)
    })
  }

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

  if (process.env['DESKLEARNER_SMOKE']) void runSmokeTest(mainWindow)
}

/**
 * Headless self-check used by `npm run smoke`. Drives the renderer through the
 * main screens, reports what it found, and exits with a non-zero code on failure.
 */
async function runSmokeTest(win: BrowserWindow): Promise<void> {
  const results: Array<[string, boolean, string]> = []
  // innerText reflects CSS text-transform, so text assertions are case-insensitive.
  const hasText = (needle: string): string =>
    `document.body.innerText.toLowerCase().includes(${JSON.stringify(needle.toLowerCase())})`
  const check = async (name: string, script: string, expect: RegExp): Promise<void> => {
    try {
      const value = String(await win.webContents.executeJavaScript(script))
      results.push([name, expect.test(value), value.slice(0, 120)])
    } catch (err) {
      results.push([name, false, (err as Error).message])
    }
  }
  const goto = async (hash: string, waitMs = 900): Promise<void> => {
    await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`)
    await new Promise((r) => setTimeout(r, waitMs))
  }
  /** Polls an expression until it is truthy, so slow renders do not cause flakes. */
  const waitFor = async (script: string, attempts = 20): Promise<boolean> => {
    for (let i = 0; i < attempts; i++) {
      if (await win.webContents.executeJavaScript(`!!(${script})`)) return true
      await new Promise((r) => setTimeout(r, 400))
    }
    return false
  }

  await new Promise<void>((resolve) => win.webContents.once('did-finish-load', () => resolve()))
  await new Promise((r) => setTimeout(r, 1500))

  await check('home renders', 'document.body.innerText.length', /^[1-9]\d{2,}$/)
  await check('titlebar present', hasText('DeskLearner'), /true/)

  await goto('#/library')
  await check('course appears in library', hasText('Cloud Support Engineering'), /true/)

  await goto('#/course/cloud-support-engineering')
  await check('course page lists chapters', hasText('SQL Server & Git'), /true/)

  await goto('#/course/cloud-support-engineering/lesson/week-1/day-01', 2500)
  await check(
    'lesson body renders',
    'document.querySelector(".markdown")?.innerText.length ?? 0',
    /^[1-9]\d{3,}$/
  )
  await check('objectives block renders', hasText('By the end of this lesson'), /true/)

  // The reader only lays out and highlights what is near the viewport, so walk
  // down the lesson before asserting on content further in. This doubles as the
  // check that virtualised sections do materialise as they are scrolled to.
  for (let step = 1; step <= 12; step++) {
    const ratio = step / 12
    await win.webContents.executeJavaScript(
      `(() => {
        const el = [...document.querySelectorAll('.scroll-area')]
          .find((node) => node.querySelector('.markdown'))
        if (el) el.scrollTop = (el.scrollHeight - el.clientHeight) * ${ratio}
        return el ? el.scrollTop : -1
      })()`
    )
    await new Promise((r) => setTimeout(r, 350))
  }
  await waitFor(
    `document.querySelectorAll(".code-block").length ===
       document.querySelectorAll(".code-block .shiki").length`
  )
  await check(
    'shiki highlighted a code block',
    'document.querySelectorAll(".code-block .shiki").length',
    /^[1-9]/
  )
  await check(
    'every code block was highlighted after scrolling',
    `document.querySelectorAll(".code-block").length -
       document.querySelectorAll(".code-block .shiki").length`,
    /^0$/
  )
  await check('callout directive renders', 'document.querySelectorAll("aside").length', /^[1-9]/)
  await check(
    'tabs directive renders',
    'document.querySelectorAll(\'[role="tablist"]\').length',
    /^[1-9]/
  )
  // `textContent`, not `innerText`: a section the reader has skipped rendering
  // is still in the DOM, but contributes no laid-out text.
  await check(
    'inline quiz renders',
    'document.querySelector(".markdown")?.textContent.toLowerCase().includes("knowledge check") ?? false',
    /true/
  )
  await check(
    'task list checkboxes render',
    'document.querySelectorAll(".task-list-item input").length',
    /^[1-9]/
  )
  await check('headings have anchors', 'document.querySelectorAll("h2[id]").length', /^[1-9]/)
  await check(
    'teacher button shows on a lesson',
    'document.querySelectorAll(\'[aria-label="Ask the teacher"]\').length',
    /^1$/
  )
  await check(
    'teacher panel opens and closes',
    // React commits asynchronously, so give it a tick before reading the DOM.
    `(async () => {
      const fab = document.querySelector('[aria-label="Ask the teacher"]')
      if (!fab) return 'no-fab'
      fab.click()
      await new Promise((r) => setTimeout(r, 250))
      const opened = !!document.querySelector('[role="dialog"][aria-label="Teacher"]')
      document.querySelector('[aria-label="Close teacher"]')?.click()
      await new Promise((r) => setTimeout(r, 250))
      return opened ? 'ok' : 'did-not-open'
    })()`,
    /^ok$/
  )

  await goto('#/course/cloud-support-engineering/lesson/week-1/day-02', 6000)

  await check(
    'mermaid diagram renders',
    'document.querySelectorAll(".mermaid-figure svg").length',
    /^[1-9]/
  )
  await check(
    'no mermaid render errors',
    '[...document.querySelectorAll("pre")].map(p=>p.innerText).filter(t=>t.includes("Diagram error")).join(" | ") || "none"',
    /^none$/
  )

  // Theme switching must re-render Mermaid, whose colour parser rejects the
  // modern CSS notations the tokens are authored in.
  await win.webContents.executeJavaScript(`window.desklearner.settings.set({ theme: 'dark' })`)
  await new Promise((r) => setTimeout(r, 2500))
  await check('dark theme applies', 'document.documentElement.dataset.theme', /^dark$/)
  await check(
    'mermaid survives a theme switch',
    'document.querySelectorAll(".mermaid-figure svg").length',
    /^[1-9]/
  )
  await check(
    'no mermaid errors in dark theme',
    '[...document.querySelectorAll("pre")].map(p=>p.innerText).filter(t=>t.includes("Diagram error")).join(" | ") || "none"',
    /^none$/
  )
  await win.webContents.executeJavaScript(`window.desklearner.settings.set({ theme: 'light' })`)
  await new Promise((r) => setTimeout(r, 1200))
  await check('light theme applies', 'document.documentElement.dataset.theme', /^light$/)

  await goto('#/course/cloud-support-engineering/test/test-week-1', 1500)
  await check('test intro renders', hasText('Pass mark'), /true/)
  await check(
    'teacher button stays off tests',
    'document.querySelectorAll(\'[aria-label="Ask the teacher"]\').length',
    /^0$/
  )

  await goto('#/stats')
  await check('stats page renders', hasText('Current streak'), /true/)

  await goto('#/settings')
  await check('settings page renders', hasText('Accent colour'), /true/)

  await goto('#/flashcards', 2500)
  await check('flashcards build a deck', hasText('Card 1 of'), /true/)

  // Search index and full-text lookup.
  await goto('#/', 500)
  await win.webContents.executeJavaScript(
    `document.dispatchEvent(new KeyboardEvent('keydown', {key:'f', ctrlKey:true, bubbles:true})),
     window.dispatchEvent(new KeyboardEvent('keydown', {key:'f', ctrlKey:true, bubbles:true}))`
  )
  await new Promise((r) => setTimeout(r, 3000))
  await win.webContents.executeJavaScript(`(() => {
     const input = document.querySelector('input[placeholder*="Search every lesson"]');
     const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
     setter.call(input, 'SARGable');
     input.dispatchEvent(new Event('input', { bubbles: true }));
   })()`)
  await new Promise((r) => setTimeout(r, 1500))
  await check('full-text search finds a term', 'document.querySelectorAll("mark").length', /^[1-9]/)
  await win.webContents.executeJavaScript(
    `window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}))`
  )

  // Persistence: mark a lesson complete, reload from disk, confirm it survived.
  await goto('#/course/cloud-support-engineering/lesson/week-1/day-03', 1000)
  await waitFor(
    `[...document.querySelectorAll('button')].some(b => b.innerText.trim().toLowerCase().includes('mark complete'))`
  )
  await check(
    'mark-complete button clicked',
    `(() => {
       const btn = [...document.querySelectorAll('button')]
         .find(b => b.innerText.trim().toLowerCase().includes('mark complete'));
       if (!btn) return 'not-found: ' + [...document.querySelectorAll('button')]
         .map(b => b.innerText.trim()).filter(Boolean).join('|');
       btn.click();
       return 'clicked';
     })()`,
    /^clicked$/
  )
  await new Promise((r) => setTimeout(r, 1500))
  await check(
    'progress reached the main process before reload',
    `(async () => {
       const p = await window.desklearner.progress.get();
       return JSON.stringify(Object.keys(p.courses['cloud-support-engineering']?.lessons ?? {}));
     })()`,
    /day-03/
  )

  await win.webContents.reload()
  await new Promise<void>((resolve) => win.webContents.once('did-finish-load', () => resolve()))
  await new Promise((r) => setTimeout(r, 2000))
  await check(
    'progress survives a reload',
    `(async () => {
       const p = await window.desklearner.progress.get();
       return p.courses['cloud-support-engineering']?.lessons['week-1/day-03']?.status ?? 'missing';
     })()`,
    /^complete$/
  )
  await check(
    'xp was awarded',
    `(async () => (await window.desklearner.progress.get()).xp)()`,
    /^[1-9]/
  )
  await check(
    'settings round-trip through disk',
    `(async () => {
       await window.desklearner.settings.set({ accent: 'teal', fontSize: 19 });
       const s = await window.desklearner.settings.get();
       return s.accent + '/' + s.fontSize;
     })()`,
    /^teal\/19$/
  )

  const failed = results.filter(([, ok]) => !ok)
  for (const [name, ok, value] of results) {
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok ? '' : `  → got: ${value}`}`)
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)
  app.exit(failed.length ? 1 : 0)
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
    // Sweep attachment files orphaned by a previous crash or by pruning.
    collectAttachmentGarbage()

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

  app.on('before-quit', () => {
    abortAll()
    flushStores()
  })
}
