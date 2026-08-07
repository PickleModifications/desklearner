import { useEffect, useState } from 'react'
import {
  Contrast,
  Database,
  FolderOpen,
  FolderPlus,
  HardDriveDownload,
  HardDriveUpload,
  Info,
  Monitor,
  Moon,
  Package,
  Palette,
  RotateCcw,
  Sun,
  Trash2,
  Type
} from 'lucide-react'
import type { AccentName, AppInfo, BackupFile, ReaderFont, ThemeMode } from '@shared/types'
import { Page, PageHeader } from '@/components/Page'
import { useContent } from '@/stores/content'
import { useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import { invalidateSearchIndex } from '@/features/search/useSearchIndex'
import { Markdown } from '@/markdown/Markdown'
import { cn, formatBytes, formatDateTime } from '@/lib/utils'

type Tab = 'appearance' | 'reading' | 'content' | 'data' | 'about'

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { id: 'reading', label: 'Reading', icon: <Type size={15} /> },
  { id: 'content', label: 'Content', icon: <Package size={15} /> },
  { id: 'data', label: 'Data', icon: <Database size={15} /> },
  { id: 'about', label: 'About', icon: <Info size={15} /> }
]

const ACCENTS: AccentName[] = ['indigo', 'violet', 'blue', 'teal', 'emerald', 'amber', 'rose', 'slate']

export function SettingsPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>(() => {
    const hash = window.location.hash.split('#')[2]
    return (TABS.find((t) => t.id === hash)?.id ?? 'appearance') as Tab
  })

  return (
    <Page wide>
      <PageHeader title="Settings" subtitle="Nothing here leaves this machine" />

      <div className="grid gap-6 md:grid-cols-[176px_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                tab === t.id ? 'font-medium' : 'text-ink-muted hover:bg-[var(--surface-2)]'
              )}
              style={tab === t.id ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' } : undefined}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {tab === 'appearance' && <AppearancePane />}
          {tab === 'reading' && <ReadingPane />}
          {tab === 'content' && <ContentPane />}
          {tab === 'data' && <DataPane />}
          {tab === 'about' && <AboutPane />}
        </div>
      </div>
    </Page>
  )
}

/* ---------------------------------------------------------------- shared */

function Group({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="card mb-4 px-5 py-4">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Row({
  label,
  hint,
  control
}: {
  label: string
  hint?: string
  control: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[13px]">{label}</div>
        {hint && <div className="text-[11.5px] text-ink-subtle">{hint}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-5.5 w-10 rounded-full transition-colors"
      style={{ background: checked ? 'var(--accent)' : 'var(--surface-3)' }}
    >
      <span
        className="absolute top-0.5 h-4.5 w-4.5 rounded-full shadow-e1 transition-all"
        style={{ background: '#fff', left: checked ? '1.25rem' : '0.125rem' }}
      />
    </button>
  )
}

function Slider({
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange
}: {
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-44"
        style={{ accentColor: 'var(--accent)' }}
      />
      <span className="w-14 text-right text-[12px] tabular-nums text-ink-muted">
        {value}
        {suffix}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------ appearance */

function AppearancePane(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)

  const themes: Array<{ id: ThemeMode; label: string; icon: React.ReactNode }> = [
    { id: 'light', label: 'Light', icon: <Sun size={15} /> },
    { id: 'dark', label: 'Dark', icon: <Moon size={15} /> },
    { id: 'system', label: 'System', icon: <Monitor size={15} /> }
  ]

  return (
    <>
      <Group title="Theme" description="Choose a fixed appearance or follow the operating system.">
        <div className="grid grid-cols-3 gap-2">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => void update({ theme: theme.id })}
              className="flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-[12.5px] transition-colors"
              style={{
                borderColor: settings.theme === theme.id ? 'var(--accent)' : 'var(--border)',
                background: settings.theme === theme.id ? 'var(--accent-soft)' : 'var(--surface)'
              }}
            >
              {theme.icon}
              {theme.label}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Accent colour">
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((accent) => (
            <button
              key={accent}
              onClick={() => void update({ accent })}
              title={accent}
              aria-label={accent}
              className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
              data-accent={accent}
              style={{
                background: `var(--accent)`,
                borderColor: settings.accent === accent ? 'var(--text)' : 'transparent'
              }}
            />
          ))}
        </div>
      </Group>

      <Group title="Interface">
        <Row
          label="Density"
          hint="Compact tightens list spacing."
          control={
            <div className="flex gap-1">
              {(['comfortable', 'compact'] as const).map((density) => (
                <button
                  key={density}
                  className="btn h-7 text-[12px] capitalize"
                  onClick={() => void update({ density })}
                  style={
                    settings.density === density
                      ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)' }
                      : undefined
                  }
                >
                  {density}
                </button>
              ))}
            </div>
          }
        />
        <Row
          label="Reduce motion"
          hint="Disables transitions and animations."
          control={
            <Toggle
              checked={settings.reducedMotion}
              onChange={(v) => void update({ reducedMotion: v })}
              label="Reduce motion"
            />
          }
        />
        <Row
          label="Show lesson numbers"
          control={
            <Toggle
              checked={settings.showLessonNumbers}
              onChange={(v) => void update({ showLessonNumbers: v })}
              label="Show lesson numbers"
            />
          }
        />
      </Group>
    </>
  )
}

/* --------------------------------------------------------------- reading */

const SAMPLE = `## Sample heading

Structured logs are just **schema-validated JSON**. Here is what that looks like when a support engineer greps for a failed payment:

\`\`\`sql title="failed-payments.sql"
SELECT TOP (10) t.TransactionId, t.Amount, t.FailureReason
FROM   dbo.Transactions AS t
WHERE  t.CustomerId = @CustomerId
  AND  t.Status = 'Failed'
ORDER BY t.CreatedAt DESC;
\`\`\`

:::hint{type=tip}
\`TOP\` is the T-SQL equivalent of \`LIMIT\`. It goes before the column list, not after the \`ORDER BY\`.
:::`

function ReadingPane(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)

  const fonts: Array<{ id: ReaderFont; label: string }> = [
    { id: 'sans', label: 'Sans' },
    { id: 'serif', label: 'Serif' },
    { id: 'mono', label: 'Mono' }
  ]

  return (
    <>
      <Group title="Typography" description="Applies to lesson content.">
        <Row
          label="Font"
          control={
            <div className="flex gap-1">
              {fonts.map((font) => (
                <button
                  key={font.id}
                  className="btn h-7 text-[12px]"
                  onClick={() => void update({ readerFont: font.id })}
                  style={
                    settings.readerFont === font.id
                      ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)' }
                      : undefined
                  }
                >
                  {font.label}
                </button>
              ))}
            </div>
          }
        />
        <Row
          label="Text size"
          control={
            <Slider
              value={settings.fontSize}
              min={13}
              max={22}
              suffix="px"
              onChange={(v) => void update({ fontSize: v })}
            />
          }
        />
        <Row
          label="Line height"
          control={
            <Slider
              value={settings.lineHeight}
              min={1.4}
              max={2.1}
              step={0.05}
              onChange={(v) => void update({ lineHeight: Number(v.toFixed(2)) })}
            />
          }
        />
        <Row
          label="Content width"
          control={
            <Slider
              value={settings.contentWidth}
              min={600}
              max={1100}
              step={20}
              suffix="px"
              onChange={(v) => void update({ contentWidth: v })}
            />
          }
        />
      </Group>

      <Group title="Behaviour">
        <Row
          label="Focus mode"
          hint="Hides the sidebar and table of contents while reading."
          control={
            <Toggle
              checked={settings.focusMode}
              onChange={(v) => void update({ focusMode: v })}
              label="Focus mode"
            />
          }
        />
        <Row
          label="Daily goal"
          hint="Drives the streak ring on the home page."
          control={
            <Slider
              value={settings.dailyGoalMinutes}
              min={5}
              max={180}
              step={5}
              suffix=" min"
              onChange={(v) => void update({ dailyGoalMinutes: v })}
            />
          }
        />
      </Group>

      <Group title="Preview">
        <div className="rounded-lg border border-line px-5 py-4" style={{ background: 'var(--surface)' }}>
          <Markdown
            style={{
              ['--reader-size' as string]: `${settings.fontSize}px`,
              ['--reader-leading' as string]: String(settings.lineHeight),
              ['--reader-width' as string]: `${settings.contentWidth}px`,
              fontFamily:
                settings.readerFont === 'serif'
                  ? 'var(--font-serif)'
                  : settings.readerFont === 'mono'
                    ? 'var(--font-mono)'
                    : 'var(--font-sans)'
            }}
          >
            {SAMPLE}
          </Markdown>
        </div>
      </Group>
    </>
  )
}

/* --------------------------------------------------------------- content */

function ContentPane(): React.JSX.Element {
  const { index, reload } = useContent()
  const toast = useUi((s) => s.toast)
  const [busy, setBusy] = useState(false)

  const afterChange = async (message: string): Promise<void> => {
    invalidateSearchIndex()
    await reload()
    toast(message, 'success')
  }

  const importFolder = async (): Promise<void> => {
    setBusy(true)
    const result = await window.desklearner.packs.importFolder()
    setBusy(false)
    if (result.ok) await afterChange(`Imported "${result.courseId}".`)
    else if (result.error) toast(result.error, 'error')
  }

  const importArchive = async (): Promise<void> => {
    setBusy(true)
    const result = await window.desklearner.packs.importArchive()
    setBusy(false)
    if (result.ok) await afterChange(`Imported "${result.courseId}".`)
    else if (result.error) toast(result.error, 'error')
  }

  const remove = async (courseId: string, title: string): Promise<void> => {
    if (!confirm(`Remove "${title}"? The course files will be deleted. Your progress data is kept.`))
      return
    const result = await window.desklearner.packs.remove(courseId)
    if (result.ok) await afterChange(`Removed "${title}".`)
    else if (result.error) toast(result.error, 'error')
  }

  return (
    <>
      <Group
        title="Installed courses"
        description="Course packs are plain folders of markdown. Built-in courses ship with the app and cannot be removed."
      >
        <div className="flex flex-col gap-2">
          {index.courses.map((pack) => (
            <div
              key={pack.manifest.id}
              className="flex items-center gap-3 rounded-lg border border-line px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium">{pack.manifest.title}</span>
                  <span className="chip">{pack.source === 'bundled' ? 'Built in' : 'Imported'}</span>
                  <span className="chip">v{pack.manifest.version}</span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-ink-subtle" title={pack.root}>
                  {pack.manifest.chapters.length} chapters ·{' '}
                  {pack.manifest.chapters.reduce((n, c) => n + c.lessons.length, 0)} lessons
                </div>
              </div>
              {pack.source === 'user' && (
                <button
                  className="btn btn-danger h-7 !px-2 text-[12px]"
                  onClick={() => void remove(pack.manifest.id, pack.manifest.title)}
                >
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>
          ))}
          {index.courses.length === 0 && (
            <p className="text-[13px] text-ink-subtle">No courses installed.</p>
          )}
        </div>

        {index.broken.length > 0 && (
          <div
            className="rounded-lg border px-3.5 py-2.5 text-[12.5px]"
            style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}
          >
            <div className="font-medium">Packs that failed to load</div>
            <ul className="mt-1 space-y-0.5 text-ink-muted">
              {index.broken.map((b) => (
                <li key={b.root}>
                  <code className="text-[11.5px]">{b.root}</code> — {b.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => void importFolder()} disabled={busy}>
            <FolderPlus size={14} /> Import from folder
          </button>
          <button className="btn" onClick={() => void importArchive()} disabled={busy}>
            <Package size={14} /> Import .zip pack
          </button>
          <button className="btn" onClick={() => void window.desklearner.packs.revealCourses()}>
            <FolderOpen size={14} /> Open courses folder
          </button>
          <button className="btn" onClick={() => void afterChange('Courses reloaded.')}>
            <RotateCcw size={14} /> Rescan
          </button>
        </div>
      </Group>

      <Group title="Authoring a course pack">
        <Markdown style={{ ['--reader-size' as string]: '12.5px', ['--reader-width' as string]: 'none' }}>
          {`A pack is a folder containing a \`course.json\` manifest, a \`lessons/\` directory of markdown files and a \`tests/\` directory of JSON tests. Drop it into the courses folder above (or import it) and press Rescan.

Lessons support GitBook-style directives — \`:::hint\`, \`:::tabs\`, \`:::details\`, \`:::steps\`, \`::youtube{id=…}\` — plus \`\`\`mermaid diagrams, \`\`\`quiz knowledge checks, KaTeX math and syntax-highlighted code.`}
        </Markdown>
      </Group>
    </>
  )
}

/* ------------------------------------------------------------------ data */

function DataPane(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const resetSettings = useSettings((s) => s.reset)
  const progress = useProgress((s) => s.state)
  const loadProgress = useProgress((s) => s.load)
  const resetProgress = useProgress((s) => s.reset)
  const toast = useUi((s) => s.toast)
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [info, setInfo] = useState<AppInfo | null>(null)

  const refresh = (): void => {
    void window.desklearner.data.listBackups().then(setBackups)
  }

  useEffect(() => {
    refresh()
    void window.desklearner.info().then(setInfo)
  }, [])

  const attempts = Object.values(progress.courses).reduce((n, c) => n + c.attempts.length, 0)
  const lessons = Object.values(progress.courses).reduce(
    (n, c) => n + Object.keys(c.lessons).length,
    0
  )

  return (
    <>
      <Group title="Where your data lives" description="DeskLearner never talks to a server.">
        <div className="rounded-lg border border-line px-3.5 py-3 text-[12.5px]">
          <code className="break-all text-[11.5px] text-ink-muted">{info?.userDataPath}</code>
          <div className="mt-2 text-ink-muted">
            {lessons} lesson records · {attempts} test attempts · {Object.keys(progress.activity).length}{' '}
            days of activity
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => void window.desklearner.data.openFolder()}>
            <FolderOpen size={14} /> Open data folder
          </button>
        </div>
      </Group>

      <Group title="Export & import" description="Move your progress between machines as a single JSON file.">
        <div className="flex flex-wrap gap-2">
          <button
            className="btn"
            onClick={async () => {
              const result = await window.desklearner.data.export()
              if (result.ok) toast('Exported.', 'success')
              else if (result.error) toast(result.error, 'error')
            }}
          >
            <HardDriveDownload size={14} /> Export everything
          </button>
          <button
            className="btn"
            onClick={async () => {
              if (!confirm('Importing replaces your current settings and progress. Continue?')) return
              const result = await window.desklearner.data.import()
              if (result.ok) {
                await Promise.all([loadProgress(), useSettings.getState().load()])
                refresh()
                toast('Import complete.', 'success')
              } else if (result.error) toast(result.error, 'error')
            }}
          >
            <HardDriveUpload size={14} /> Import a backup
          </button>
        </div>
        <Row
          label="Automatic backups"
          hint="Snapshots taken on launch and before any destructive action. Fifteen are kept."
          control={
            <Toggle
              checked={settings.autoBackup}
              onChange={(v) => void update({ autoBackup: v })}
              label="Automatic backups"
            />
          }
        />
      </Group>

      <Group title="Local backups">
        {backups.length === 0 ? (
          <p className="text-[13px] text-ink-subtle">No backups yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {backups.slice(0, 8).map((backup) => (
              <div
                key={backup.path}
                className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-[12.5px]"
              >
                <span className="flex-1">{formatDateTime(backup.createdAt)}</span>
                <span className="text-ink-subtle">{formatBytes(backup.sizeBytes)}</span>
                <button
                  className="btn h-6 !px-2 text-[11.5px]"
                  onClick={async () => {
                    if (!confirm('Restore this backup? Current progress will be replaced.')) return
                    const result = await window.desklearner.data.restoreBackup(backup.path)
                    if (result.ok) {
                      await Promise.all([loadProgress(), useSettings.getState().load()])
                      toast('Backup restored.', 'success')
                    } else if (result.error) toast(result.error, 'error')
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </Group>

      <Group title="Reset" description="These actions cannot be undone, but a backup is taken first.">
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (
                settings.confirmBeforeReset &&
                !confirm('Erase all lesson progress, notes, bookmarks and test attempts?')
              )
                return
              await resetProgress()
              refresh()
              toast('Progress reset.', 'success')
            }}
          >
            <Trash2 size={14} /> Reset all progress
          </button>
          <button
            className="btn"
            onClick={async () => {
              await resetSettings()
              toast('Settings restored to defaults.', 'success')
            }}
          >
            <RotateCcw size={14} /> Restore default settings
          </button>
        </div>
        <Row
          label="Confirm before resetting"
          control={
            <Toggle
              checked={settings.confirmBeforeReset}
              onChange={(v) => void update({ confirmBeforeReset: v })}
              label="Confirm before resetting"
            />
          }
        />
      </Group>
    </>
  )
}

/* ----------------------------------------------------------------- about */

function AboutPane(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.desklearner.info().then(setInfo)
  }, [])

  const shortcuts: Array<[string, string]> = [
    ['Ctrl K', 'Command palette'],
    ['Ctrl F', 'Search all lessons'],
    ['Ctrl B', 'Toggle sidebar'],
    ['Ctrl ,', 'Open settings'],
    ['Alt ←  /  Alt →', 'Back and forward']
  ]

  return (
    <>
      <Group title="DeskLearner">
        <div className="flex items-center gap-3">
          <Contrast size={28} style={{ color: 'var(--accent)' }} />
          <div>
            <div className="text-[15px] font-semibold">DeskLearner {info?.version}</div>
            <div className="text-[12px] text-ink-muted">
              A modern way to learn on your desktop — entirely offline.
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px]">
          {(
            [
              ['Electron', info?.electron],
              ['Chromium', info?.chrome],
              ['Node', info?.node],
              ['Platform', info?.platform]
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-line py-1">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="tabular-nums">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </Group>

      <Group title="Keyboard shortcuts">
        <dl className="flex flex-col gap-1.5 text-[12.5px]">
          {shortcuts.map(([keys, action]) => (
            <div key={keys} className="flex items-center justify-between">
              <dt className="text-ink-muted">{action}</dt>
              <dd>
                <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px]">{keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Group>

      <Group title="Privacy">
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          DeskLearner has no accounts, no telemetry and no sync. Progress, notes and settings are
          written to JSON files in your user data folder. The only network requests the app can make
          are YouTube embeds you explicitly press play on, and links you choose to open in your
          browser.
        </p>
      </Group>
    </>
  )
}
