export const CH = {
  info: 'app:info',

  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsReset: 'settings:reset',

  progressGet: 'progress:get',
  progressSet: 'progress:set',
  progressReset: 'progress:reset',

  contentList: 'content:list',
  contentLesson: 'content:lesson',
  contentTest: 'content:test',
  contentCorpus: 'content:corpus',
  contentAssetUrl: 'content:asset-url',

  packImportFolder: 'packs:import-folder',
  packImportArchive: 'packs:import-archive',
  packRemove: 'packs:remove',
  packReveal: 'packs:reveal',

  dataExport: 'data:export',
  dataImport: 'data:import',
  dataBackups: 'data:backups',
  dataRestore: 'data:restore',
  dataOpenFolder: 'data:open-folder',

  winMinimize: 'win:minimize',
  winToggleMaximize: 'win:toggle-maximize',
  winClose: 'win:close',
  winIsMaximized: 'win:is-maximized',
  winMaximizeChanged: 'win:maximize-changed',

  openExternal: 'sys:open-external',
  setThemeSource: 'sys:set-theme-source',
  nativeThemeChanged: 'sys:native-theme-changed'
} as const
