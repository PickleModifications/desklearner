import { contextBridge, ipcRenderer } from 'electron'
import { CH } from '@shared/channels'
import type { DeskLearnerApi, ProgressState, Settings, ThemeMode } from '@shared/types'

const api: DeskLearnerApi = {
  info: () => ipcRenderer.invoke(CH.info),

  settings: {
    get: () => ipcRenderer.invoke(CH.settingsGet),
    set: (patch: Partial<Settings>) => ipcRenderer.invoke(CH.settingsSet, patch),
    reset: () => ipcRenderer.invoke(CH.settingsReset)
  },

  progress: {
    get: () => ipcRenderer.invoke(CH.progressGet),
    set: (next: ProgressState) => ipcRenderer.invoke(CH.progressSet, next),
    reset: () => ipcRenderer.invoke(CH.progressReset)
  },

  content: {
    list: () => ipcRenderer.invoke(CH.contentList),
    lesson: (courseId, chapterId, lessonId) =>
      ipcRenderer.invoke(CH.contentLesson, courseId, chapterId, lessonId),
    test: (courseId, testId) => ipcRenderer.invoke(CH.contentTest, courseId, testId),
    searchCorpus: () => ipcRenderer.invoke(CH.contentCorpus),
    assetUrl: (courseId, relativePath) =>
      ipcRenderer.invoke(CH.contentAssetUrl, courseId, relativePath)
  },

  packs: {
    importFolder: () => ipcRenderer.invoke(CH.packImportFolder),
    importArchive: () => ipcRenderer.invoke(CH.packImportArchive),
    remove: (courseId) => ipcRenderer.invoke(CH.packRemove, courseId),
    revealCourses: () => ipcRenderer.invoke(CH.packReveal)
  },

  data: {
    export: () => ipcRenderer.invoke(CH.dataExport),
    import: () => ipcRenderer.invoke(CH.dataImport),
    listBackups: () => ipcRenderer.invoke(CH.dataBackups),
    restoreBackup: (p) => ipcRenderer.invoke(CH.dataRestore, p),
    openFolder: () => ipcRenderer.invoke(CH.dataOpenFolder)
  },

  window: {
    minimize: () => ipcRenderer.send(CH.winMinimize),
    toggleMaximize: () => ipcRenderer.send(CH.winToggleMaximize),
    close: () => ipcRenderer.send(CH.winClose),
    isMaximized: () => ipcRenderer.invoke(CH.winIsMaximized),
    onMaximizeChange: (cb) => {
      const handler = (_e: unknown, maximized: boolean): void => cb(maximized)
      ipcRenderer.on(CH.winMaximizeChanged, handler)
      return () => ipcRenderer.removeListener(CH.winMaximizeChanged, handler)
    }
  },

  system: {
    openExternal: (url: string) => ipcRenderer.invoke(CH.openExternal, url),
    setThemeSource: (mode: ThemeMode) => ipcRenderer.invoke(CH.setThemeSource, mode),
    onNativeThemeChange: (cb) => {
      const handler = (_e: unknown, isDark: boolean): void => cb(isDark)
      ipcRenderer.on(CH.nativeThemeChanged, handler)
      return () => ipcRenderer.removeListener(CH.nativeThemeChanged, handler)
    }
  }
}

contextBridge.exposeInMainWorld('desklearner', api)
