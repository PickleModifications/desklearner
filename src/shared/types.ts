/**
 * Types shared between the Electron main process, the preload bridge and the renderer.
 * Everything the app persists lives under the user's `userData` directory — no network, ever.
 */

/* ------------------------------------------------------------------ *
 * Course packs
 * ------------------------------------------------------------------ */

export interface LessonRef {
  id: string
  title: string
  /** Path to the markdown file, relative to the pack root. */
  file: string
  /** Rough reading/working time in minutes. */
  minutes?: number
}

export interface TestRef {
  id: string
  title: string
  /** Path to the test JSON file, relative to the pack root. */
  file: string
}

export interface ChapterRef {
  id: string
  title: string
  summary?: string
  lessons: LessonRef[]
  test?: TestRef
}

export interface CourseManifest {
  id: string
  title: string
  subtitle?: string
  description?: string
  version: string
  author?: string
  tags?: string[]
  /** Hex colour used as the course accent in the library. */
  color?: string
  estimatedHours?: number
  chapters: ChapterRef[]
  /** Optional course-wide final exam. */
  finalExam?: TestRef
}

export type PackSource = 'bundled' | 'user'

export interface CoursePack {
  manifest: CourseManifest
  /** Absolute path to the pack directory on disk. */
  root: string
  source: PackSource
}

/** A pack that failed to load, surfaced in Settings -> Content rather than crashing. */
export interface BrokenPack {
  root: string
  source: PackSource
  error: string
}

export interface ContentIndex {
  courses: CoursePack[]
  broken: BrokenPack[]
}

export interface LessonFrontmatter {
  title?: string
  summary?: string
  minutes?: number
  objectives?: string[]
  keyTerms?: Array<{ term: string; definition: string }>
  resources?: Array<{ label: string; url: string }>
}

export interface LessonDocument {
  courseId: string
  chapterId: string
  lessonId: string
  frontmatter: LessonFrontmatter
  markdown: string
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

export type QuestionType =
  'single' | 'multi' | 'boolean' | 'short' | 'ordering' | 'matching' | 'fill-blank'

interface BaseQuestion {
  id: string
  type: QuestionType
  prompt: string
  /** Shown in review mode after submitting. */
  explanation?: string
  points?: number
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: 'single'
  options: string[]
  /** Index into `options`. */
  answer: number
}

export interface MultiChoiceQuestion extends BaseQuestion {
  type: 'multi'
  options: string[]
  /** Indices into `options`; all must be selected and nothing else. */
  answer: number[]
}

export interface BooleanQuestion extends BaseQuestion {
  type: 'boolean'
  answer: boolean
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short'
  /** Case-insensitive, whitespace-normalised comparison. */
  accepted: string[]
  /** Optional regular expression (evaluated case-insensitively) as an alternative match. */
  pattern?: string
  placeholder?: string
}

export interface OrderingQuestion extends BaseQuestion {
  type: 'ordering'
  /** Items presented shuffled; `answer` holds them in the correct order. */
  items: string[]
  answer: string[]
}

export interface MatchingQuestion extends BaseQuestion {
  type: 'matching'
  pairs: Array<{ left: string; right: string }>
}

export interface FillBlankQuestion extends BaseQuestion {
  type: 'fill-blank'
  /** Text containing `{{0}}`, `{{1}}` … placeholders. */
  text: string
  /** One entry per placeholder; each entry lists acceptable answers. */
  blanks: string[][]
}

export type Question =
  | SingleChoiceQuestion
  | MultiChoiceQuestion
  | BooleanQuestion
  | ShortAnswerQuestion
  | OrderingQuestion
  | MatchingQuestion
  | FillBlankQuestion

export interface TestDocument {
  id: string
  title: string
  description?: string
  /** Percentage (0-100) required to pass. */
  passingScore: number
  shuffle?: boolean
  timeLimitMinutes?: number
  questions: Question[]
}

/** Answer payloads keyed by question id. */
export type AnswerValue = number | number[] | boolean | string | string[] | Record<string, string>

export interface QuestionResult {
  questionId: string
  correct: boolean
  points: number
  maxPoints: number
  given: AnswerValue | undefined
}

export interface TestAttempt {
  id: string
  courseId: string
  testId: string
  /** ISO timestamp. */
  startedAt: string
  finishedAt: string
  durationSeconds: number
  score: number
  maxScore: number
  percent: number
  passed: boolean
  results: QuestionResult[]
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export type ThemeMode = 'light' | 'dark' | 'system'
export type AccentName =
  'indigo' | 'violet' | 'blue' | 'teal' | 'emerald' | 'amber' | 'rose' | 'slate'
export type Density = 'comfortable' | 'compact'
export type ReaderFont = 'sans' | 'serif' | 'mono'

export interface Settings {
  theme: ThemeMode
  accent: AccentName
  density: Density
  reducedMotion: boolean
  readerFont: ReaderFont
  fontSize: number
  lineHeight: number
  contentWidth: number
  /** Reader zoom multiplier for lesson content (Ctrl+scroll or the header control). */
  readerZoom: number
  focusMode: boolean
  sidebarCollapsed: boolean
  showLessonNumbers: boolean
  confirmBeforeReset: boolean
  autoBackup: boolean
  dailyGoalMinutes: number
  /** Master switch for the Teacher AI. Off until the learner adds an API key. */
  aiEnabled: boolean
  /** Show the model's summarised reasoning above each answer. */
  aiShowThinking: boolean
  lastCourseId?: string
  lastLessonPath?: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'indigo',
  density: 'comfortable',
  reducedMotion: false,
  readerFont: 'sans',
  fontSize: 16,
  lineHeight: 1.7,
  contentWidth: 760,
  readerZoom: 1,
  focusMode: false,
  sidebarCollapsed: false,
  showLessonNumbers: true,
  confirmBeforeReset: true,
  autoBackup: true,
  dailyGoalMinutes: 30,
  aiEnabled: false,
  aiShowThinking: true
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

export type LessonStatus = 'not-started' | 'in-progress' | 'complete'

export interface LessonProgress {
  status: LessonStatus
  /** Seconds spent with the lesson open and the window focused. */
  secondsSpent: number
  /** 0-1 fraction of the document scrolled, used to restore reading position. */
  scroll: number
  lastOpenedAt?: string
  completedAt?: string
  bookmarked?: boolean
  /** Persisted `:::checklist` state, keyed by checklist item index. */
  checklist?: Record<string, boolean>
  notes?: string
}

export interface CourseProgress {
  lessons: Record<string, LessonProgress>
  attempts: TestAttempt[]
  startedAt?: string
  lastOpenedAt?: string
  /** `chapterId/lessonId` of the last lesson opened in this course. */
  lastLesson?: string
}

export interface ActivityDay {
  /** YYYY-MM-DD in local time. */
  date: string
  minutes: number
  lessonsCompleted: number
  testsPassed: number
  xp: number
}

export interface ProgressState {
  courses: Record<string, CourseProgress>
  activity: Record<string, ActivityDay>
  xp: number
  streak: number
  longestStreak: number
  lastActiveDate?: string
}

export const EMPTY_PROGRESS: ProgressState = {
  courses: {},
  activity: {},
  xp: 0,
  streak: 0,
  longestStreak: 0
}

/* ------------------------------------------------------------------ *
 * Teacher AI
 * ------------------------------------------------------------------ */

export type TeacherRole = 'user' | 'assistant'
export type AttachmentKind = 'image' | 'pdf' | 'text'

/**
 * A saved attachment. Only the descriptor lives in `chats.json`; the bytes are
 * written to `<userData>/chat-attachments/` so the store stays small.
 */
export interface TeacherAttachment {
  id: string
  kind: AttachmentKind
  name: string
  mediaType: string
  sizeBytes: number
  /** File name relative to `<userData>/chat-attachments/`. */
  file: string
  /** Small data URI used by the composer tray and message bubbles. Images only. */
  thumb?: string
}

/** Staged in the composer but not yet sent. Carries the bytes. */
export interface PendingAttachment {
  id: string
  kind: AttachmentKind
  name: string
  mediaType: string
  sizeBytes: number
  /** base64, without a `data:` prefix. */
  data: string
  thumb?: string
}

export interface TeacherMessage {
  id: string
  role: TeacherRole
  text: string
  /** Summarised reasoning, when the model produced any. */
  thinking?: string
  attachments?: TeacherAttachment[]
  /** A course the Teacher offered to build, rendered as a card under the answer. */
  proposal?: CourseBrief
  createdAt: string
  error?: string
}

/** `courseId/chapterId/lessonId` for lessons, `courseId/test/testId` for tests. */
export type ThreadKey = string

export interface TeacherThread {
  key: ThreadKey
  title: string
  messages: TeacherMessage[]
  updatedAt: string
}

export interface ChatState {
  threads: Record<ThreadKey, TeacherThread>
}

export const EMPTY_CHATS: ChatState = { threads: {} }

/** Everything the main process needs to build the prompt for one turn. */
/** One entry in the course map the Teacher is given. */
export interface OutlineLesson {
  id: string
  title: string
  done: boolean
  /** True for the lesson the learner currently has open. */
  current?: boolean
}

export interface OutlineChapter {
  id: string
  title: string
  lessons: OutlineLesson[]
  testId?: string
  testTitle?: string
  /** Best percentage scored on this chapter's test, if it has been attempted. */
  testBest?: number
}

/**
 * A compact map of the whole course — titles only, no bodies — so the Teacher
 * can place the current lesson in the syllabus: what has already been covered,
 * what is still ahead, and where a topic actually belongs.
 */
export interface CourseOutline {
  subtitle?: string
  description?: string
  chapters: OutlineChapter[]
  lessonsCompleted: number
  lessonsTotal: number
}

export interface TeacherContext {
  kind: 'lesson' | 'test'
  courseId: string
  courseTitle: string
  chapterTitle?: string
  lessonTitle: string
  /** Lesson markdown, or a digest of the questions the learner missed. */
  body: string
  objectives?: string[]
  keyTerms?: Array<{ term: string; definition: string }>
  /** The whole syllabus, so answers can reference other lessons. */
  outline?: CourseOutline
  /** Nearest heading to the viewport, so the AI knows where the learner is. */
  currentHeading?: string
  scrollPercent?: number
}

export interface TeacherSendRequest {
  requestId: string
  threadKey: ThreadKey
  context: TeacherContext
  /** Prior turns, already trimmed by the renderer. */
  history: TeacherMessage[]
  prompt: string
  /** Staged in the composer; all sent together as a single user turn. */
  attachments: PendingAttachment[]
}

export interface TeacherSendResult {
  ok: boolean
  error?: string
  /** Descriptors for the attachments that were persisted for this turn. */
  attachments?: TeacherAttachment[]
}

export type TeacherStreamEvent =
  | { requestId: string; type: 'thinking-delta'; text: string }
  | { requestId: string; type: 'text-delta'; text: string }
  | { requestId: string; type: 'course-proposal'; proposal: CourseBrief }
  | { requestId: string; type: 'done'; stopReason: string | null; model: string }
  | { requestId: string; type: 'error'; message: string }

/* ------------------------------------------------------------------ *
 * AI course authoring
 * ------------------------------------------------------------------ */

export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced'

/** What the learner asked for. The whole course is derived from this. */
export interface CourseBrief {
  topic: string
  /** Who the course is for, and what they already know. */
  audience?: string
  /** What the learner wants to be able to do at the end. */
  goals?: string
  difficulty: CourseDifficulty
  chapters: number
  lessonsPerChapter: number
  minutesPerLesson: number
  includeTests: boolean
  includeFinalExam: boolean
}

export const DEFAULT_COURSE_BRIEF: CourseBrief = {
  topic: '',
  difficulty: 'intermediate',
  chapters: 4,
  lessonsPerChapter: 5,
  minutesPerLesson: 45,
  includeTests: true,
  includeFinalExam: true
}

export interface CoursePlanLesson {
  id: string
  title: string
  /** One or two sentences telling the lesson writer what this lesson covers. */
  summary: string
}

export interface CoursePlanChapter {
  id: string
  title: string
  summary: string
  lessons: CoursePlanLesson[]
}

/** The outline the model produced, reviewable and editable before anything is written. */
export interface CoursePlan {
  id: string
  title: string
  subtitle?: string
  description?: string
  tags?: string[]
  color?: string
  chapters: CoursePlanChapter[]
}

export interface CoursePlanResult {
  ok: boolean
  plan?: CoursePlan
  error?: string
}

export interface CourseBuildRequest {
  jobId: string
  plan: CoursePlan
  brief: CourseBrief
}

export type CourseGenEvent =
  | { jobId: string; type: 'progress'; done: number; total: number; label: string }
  | { jobId: string; type: 'done'; courseId: string; title: string }
  | { jobId: string; type: 'error'; message: string }

export interface AiKeyStatus {
  configured: boolean
  lastFour?: string
  /** False when the OS has no credential store; the key cannot be persisted. */
  encryptionAvailable: boolean
}

/* ------------------------------------------------------------------ *
 * IPC surface
 * ------------------------------------------------------------------ */

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  userDataPath: string
  coursesPath: string
}

export interface ImportResult {
  ok: boolean
  courseId?: string
  error?: string
}

export interface BackupFile {
  name: string
  path: string
  createdAt: string
  sizeBytes: number
}

export interface ExportBundle {
  kind: 'desklearner-backup'
  version: 1
  exportedAt: string
  settings: Settings
  progress: ProgressState
}

export interface DeskLearnerApi {
  info(): Promise<AppInfo>
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
    reset(): Promise<Settings>
  }
  progress: {
    get(): Promise<ProgressState>
    set(next: ProgressState): Promise<void>
    reset(): Promise<ProgressState>
  }
  content: {
    list(): Promise<ContentIndex>
    lesson(courseId: string, chapterId: string, lessonId: string): Promise<LessonDocument>
    test(courseId: string, testId: string): Promise<TestDocument>
    /** Every lesson's plain text, used to build the search index. */
    searchCorpus(): Promise<
      Array<{
        id: string
        courseId: string
        courseTitle: string
        chapterId: string
        chapterTitle: string
        lessonId: string
        title: string
        text: string
      }>
    >
    /** Resolves a pack-relative asset to a `dl-asset://` URL. */
    assetUrl(courseId: string, relativePath: string): Promise<string>
  }
  packs: {
    importFolder(): Promise<ImportResult>
    importArchive(): Promise<ImportResult>
    remove(courseId: string): Promise<{ ok: boolean; error?: string }>
    revealCourses(): Promise<void>
  }
  data: {
    export(): Promise<{ ok: boolean; path?: string; error?: string }>
    import(): Promise<{ ok: boolean; error?: string }>
    listBackups(): Promise<BackupFile[]>
    restoreBackup(path: string): Promise<{ ok: boolean; error?: string }>
    openFolder(): Promise<void>
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizeChange(cb: (maximized: boolean) => void): () => void
  }
  ai: {
    keyStatus(): Promise<AiKeyStatus>
    setKey(key: string): Promise<AiKeyStatus & { error?: string }>
    clearKey(): Promise<AiKeyStatus>
    send(request: TeacherSendRequest): Promise<TeacherSendResult>
    abort(requestId: string): Promise<void>
    pickAttachments(): Promise<{ accepted: PendingAttachment[]; rejected: string[] }>
    readAttachment(file: string): Promise<string | null>
    onStreamEvent(cb: (event: TeacherStreamEvent) => void): () => void
  }
  courseGen: {
    /** One call: turns a brief into a reviewable outline. */
    plan(brief: CourseBrief): Promise<CoursePlanResult>
    /** Fire and forget — progress arrives on `onEvent`. */
    build(request: CourseBuildRequest): Promise<{ ok: boolean; error?: string }>
    abort(jobId: string): Promise<void>
    onEvent(cb: (event: CourseGenEvent) => void): () => void
  }
  chats: {
    get(): Promise<ChatState>
    set(next: ChatState): Promise<void>
    clear(): Promise<ChatState>
  }
  system: {
    openExternal(url: string): Promise<void>
    setThemeSource(mode: ThemeMode): Promise<boolean>
    onNativeThemeChange(cb: (isDark: boolean) => void): () => void
  }
}
