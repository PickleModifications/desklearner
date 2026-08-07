# DeskLearner

A modern way to learn on your desktop.

An offline-first desktop course reader. Courses are folders of GitBook-flavoured
Markdown organised into **chapters, lessons and tests**. Progress, notes,
bookmarks, settings and test attempts are stored as JSON files on your own
machine — there is no account, no server and no telemetry.

Ships with a complete six-week course, **Cloud Support Engineering**: 37 written
lessons, 6 chapter tests and a 40-question final exam.

---

## What it does

| | |
|---|---|
| **Reading** | Chapter/lesson sidebar, scroll-spy table of contents, prev/next navigation, reading-position restore, focus mode, adjustable font, line height and content width |
| **Rich Markdown** | Callouts, tabs, collapsibles, step lists, cards, YouTube embeds, Mermaid diagrams, KaTeX maths, Shiki-highlighted code with copy buttons, inline knowledge checks, persistent task lists |
| **Tests** | Seven question types, shuffling, optional time limits, flag-for-review, scoring with per-question explanations, retakes and full attempt history |
| **Progress** | Per-lesson status, resume where you left off, daily streak, XP, time-on-lesson, per-chapter progress rings, a 26-week activity heatmap |
| **Study tools** | Full-text search across every lesson, command palette (<kbd>Ctrl</kbd>+<kbd>K</kbd>), bookmarks, per-lesson Markdown notes, flashcards generated from lesson key terms |
| **Themes** | Light, dark or follow-system, eight accent colours, compact density, reduced motion. Code blocks, diagrams and maths all follow the theme |
| **Teacher AI** *(optional)* | A tutor you can open on any lesson (<kbd>Ctrl</kbd>+<kbd>/</kbd>) that already has the lesson and your reading position as context. Select text to ask about it, paste screenshots or attach files, and get your wrong test answers explained. Off by default — see below |
| **Your data** | Export/import everything as JSON, automatic rolling backups, reset progress, open the data folder. Import additional course packs from a folder or `.zip` |

Everything works with the network cable unplugged. The only outbound requests
the app can make are a YouTube embed you explicitly press play on, links you
choose to open in your browser, and the optional Teacher AI.

### About the Teacher AI

The Teacher is the one feature that talks to the internet, and it is **off until
you turn it on**. It is bring-your-own-key: add an Anthropic API key under
**Settings → Teacher AI** and usage is billed to your own account. The key is
encrypted by your operating system's credential store (`safeStorage`) and never
written to `settings.json` or included in an export.

When you ask a question, the lesson text, your message and anything you attach
are sent to Anthropic's API to produce the answer. Nothing else is sent, and no
network request happens at all until you add a key. Conversations are stored
per-lesson on your machine and can be cleared from the same settings pane.

---

## Running it

```bash
npm install
npm run dev            # hot-reloading development build
```

Other scripts:

| Command | Does |
|---|---|
| `npm run dev` | Development with hot reload |
| `npm run build` | Type-check and build to `out/` |
| `npm start` | Build then run the production bundle |
| `npm run typecheck` | Type-check main, preload and renderer |
| `npm run validate:packs` | Validate every bundled course pack — manifests, frontmatter, balanced directives, test answer keys |
| `npm run smoke` | Launch the app and assert 28 behaviours end to end, against a throwaway data directory |
| `npm run check` | typecheck + validate:packs + smoke |
| `npm run icon` | Regenerate `build/icon.png` and `build/icon.ico` |
| `npm run package` | Build a Windows NSIS installer and portable exe into `release/` |

The smoke run drives the real app: it opens the library, a lesson, a test, the
stats, settings and flashcards pages; asserts that Shiki, Mermaid, callouts,
tabs, quizzes and task lists all rendered; runs a full-text search; marks a
lesson complete; reloads; and confirms progress and settings survived.

---

## Keyboard shortcuts

| Keys | Action |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>K</kbd> | Command palette |
| <kbd>Ctrl</kbd>+<kbd>F</kbd> | Search all lessons |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> | Toggle sidebar |
| <kbd>Ctrl</kbd>+<kbd>,</kbd> | Settings |
| <kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>Alt</kbd>+<kbd>→</kbd> | Back / forward |

---

## Writing a course pack

A pack is a plain folder. Drop it in the courses folder (Settings → Content →
Open courses folder) or import it, then press Rescan.

```text
my-course/
├── course.json          manifest
├── lessons/*.md         one file per lesson, YAML frontmatter
├── tests/*.json         one file per test
└── assets/              images, referenced as dl-asset:// URLs
```

### `course.json`

```json
{
  "id": "my-course",
  "title": "My Course",
  "subtitle": "One line under the title",
  "description": "Markdown is allowed here.",
  "version": "1.0.0",
  "author": "You",
  "tags": ["SQL", "Python"],
  "color": "#2a72d4",
  "estimatedHours": 12,
  "chapters": [
    {
      "id": "chapter-1",
      "title": "Getting Started",
      "summary": "Shown under the chapter heading.",
      "lessons": [
        { "id": "lesson-1", "title": "First Lesson", "file": "lessons/lesson-1.md", "minutes": 30 }
      ],
      "test": { "id": "test-1", "title": "Chapter 1 Test", "file": "tests/test-1.json" }
    }
  ],
  "finalExam": { "id": "final", "title": "Final Exam", "file": "tests/final.json" }
}
```

Manifests are validated with Zod on load. A malformed pack shows a readable
error in Settings → Content rather than breaking the app.

### Lesson frontmatter

```yaml
---
title: First Lesson
summary: One or two sentences shown under the title.
minutes: 30
objectives:
  - What the reader will be able to do afterwards
keyTerms:
  - term: Idempotent
    definition: Doing it twice has the same effect as doing it once.
resources:
  - label: Further reading
    url: https://example.com
---
```

`keyTerms` become flashcards automatically.

### Markdown directives

| Syntax | Renders as |
|---|---|
| `:::hint{type=info\|tip\|warning\|danger\|success}` | Coloured callout |
| `:::tabs` containing `:::tab{title="…"}` | Tabbed panels |
| `:::details{summary="Show answer"}` | Collapsible block |
| `:::steps` around an ordered list | Numbered step timeline |
| `:::checklist{title="…"}` | Boxed checklist |
| `:::cards` containing `:::card{title="…"}` | Card grid |
| `:::columns` | Two-column layout |
| `::youtube{id=VIDEO_ID title="…" start=90}` | Click-to-load privacy-mode embed |
| `:kbd[Ctrl]` | Keycap |
| `:term[SARGable]{def="…"}` | Term with a hover definition |

Plus, as fenced code blocks:

- ` ```mermaid ` — theme-aware diagram
- ` ```quiz ` — inline knowledge check, authored as YAML:

  ````markdown
  ```quiz
  question: Which keyword limits rows in T-SQL?
  options: [LIMIT, TOP, ROWNUM]
  answer: 1
  explanation: T-SQL uses TOP; LIMIT is MySQL/PostgreSQL.
  ```
  ````

- ` ```sql title="query.sql" ` — titled, highlighted, with a copy button
- `$…$` and `$$…$$` — KaTeX maths
- GFM task lists — checkbox state persists per lesson

### Test format

```json
{
  "id": "test-1",
  "title": "Chapter 1 Test",
  "description": "Shown on the intro screen.",
  "passingScore": 75,
  "shuffle": true,
  "timeLimitMinutes": 30,
  "questions": [ … ]
}
```

Seven question types, each supporting `explanation` and an optional `points`:

| `type` | Shape |
|---|---|
| `single` | `options: string[]`, `answer: number` |
| `multi` | `options: string[]`, `answer: number[]` |
| `boolean` | `answer: boolean` |
| `short` | `accepted: string[]`, optional `pattern` regex, optional `placeholder` |
| `ordering` | `items: string[]` (shown shuffled), `answer: string[]` |
| `matching` | `pairs: [{ left, right }]` |
| `fill-blank` | `text` with `{{0}}` placeholders, `blanks: string[][]` |

Run `npm run validate:packs` to check a pack before shipping it — it verifies
manifests, frontmatter, balanced directives and code fences, duplicate ids,
answer indices in range, and that ordering answers match their items.

---

## Where your data lives

| Path | Contents |
|---|---|
| `%APPDATA%/DeskLearner/settings.json` | Appearance and reading preferences |
| `%APPDATA%/DeskLearner/progress.json` | Lesson progress, notes, bookmarks, attempts, activity |
| `%APPDATA%/DeskLearner/backups/` | Fifteen rolling snapshots |
| `%APPDATA%/DeskLearner/courses/` | Imported course packs |

On macOS this is `~/Library/Application Support/DeskLearner`; on Linux,
`~/.config/DeskLearner`. Settings → Data → Open data folder takes you there.

---

## Architecture

```text
src/
├── main/          Electron main process
│   ├── index.ts     window, custom protocol, smoke harness
│   ├── ipc.ts       typed IPC handlers
│   ├── store.ts     JSON store with atomic writes and debounced flush
│   ├── content.ts   pack discovery, validation, lesson/test loading
│   ├── packs.ts     import from folder or zip, remove, reveal
│   ├── unzip.ts     dependency-free zip reader with zip-slip guards
│   ├── backups.ts   rolling snapshots
│   └── schema.ts    Zod schemas for manifests and tests
├── preload/       contextBridge → window.desklearner
├── shared/        types and IPC channel names
└── renderer/src/
    ├── app/         titlebar, nav rail, toaster
    ├── features/    home · library · lesson · test · search · study · stats · settings
    ├── markdown/    renderer, directive plugin, directive components
    ├── stores/      Zustand slices
    └── styles/      theme tokens, Tailwind entry, prose styles
```

**Security.** `contextIsolation: true`, `nodeIntegration: false`, a strict CSP
that only permits framing `youtube-nocookie.com`, every external link routed
through `shell.openExternal`, and pack file access sandboxed to the pack root
(both `resolveInPack` and the `dl-asset://` handler reject path traversal).

**Storage.** Plain JSON with atomic write-and-rename. No native modules, so
`npm install` and packaging work without a compiler toolchain.

---

## The bundled course

**Cloud Support Engineering** — SQL Server, Python, JSON Schema, AWS, Azure and
the Microsoft stack. Six chapters, 37 lessons, ~74 hours.

| Chapter | Covers |
|---|---|
| 1 · SQL Server & Git | T-SQL, joins, aggregation, indexes, execution plans, rebase/merge, bisect, PR workflow |
| 2 · Python, JSON Schema & AWS | Log parsing, API clients, schema contracts, EC2, S3, VPC, IAM, Lambda, RDS |
| 3 · CI/CD & Logging | Pipelines, GitHub Actions, CodePipeline, structured logging, CloudWatch, tracing, incident response |
| 4 · Azure, Entra ID & Docker | Resource model, AWS↔Azure mapping, identity and sign-in triage, KQL, containers |
| 5 · Certification & Project | A ticket ingestion service built, deployed, monitored and documented |
| 6 · Portfolio | Repository presentation, résumé, honest self-assessment |

---

## Licence

MIT.
