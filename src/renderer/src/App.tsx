import { useEffect } from 'react'
import { Navigate, Route, Routes, useMatch } from 'react-router-dom'
import { TitleBar } from './app/TitleBar'
import { NavRail } from './app/NavRail'
import { Toaster } from './app/Toaster'
import { CommandPalette } from './features/search/CommandPalette'
import { SearchDialog } from './features/search/SearchDialog'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { useTheme } from './hooks/useTheme'
import { useContent } from './stores/content'
import { useProgress } from './stores/progress'
import { useSettings } from './stores/settings'
import { useTeacher } from './stores/teacher'
import { useUi } from './stores/ui'
import { TeacherFab } from './features/teacher/TeacherFab'
import { TeacherPanel } from './features/teacher/TeacherPanel'
import { HomePage } from './features/home/HomePage'
import { LibraryPage } from './features/library/LibraryPage'
import { CoursePage } from './features/library/CoursePage'
import { LessonPage } from './features/lesson/LessonPage'
import { TestPage } from './features/test/TestPage'
import { TestHistoryPage } from './features/test/TestHistoryPage'
import { BookmarksPage } from './features/study/BookmarksPage'
import { FlashcardsPage } from './features/study/FlashcardsPage'
import { StatsPage } from './features/stats/StatsPage'
import { SettingsPage } from './features/settings/SettingsPage'

export default function App(): React.JSX.Element {
  const loadSettings = useSettings((s) => s.load)
  const loadProgress = useProgress((s) => s.load)
  const loadContent = useContent((s) => s.load)
  const settingsLoaded = useSettings((s) => s.loaded)
  const progressLoaded = useProgress((s) => s.loaded)

  const loadTeacher = useTeacher((s) => s.load)
  const handleStreamEvent = useTeacher((s) => s.handleStreamEvent)
  const teacherConfigured = useTeacher((s) => s.keyStatus.configured)
  const teacherEnabled = useSettings((s) => s.settings.aiEnabled)
  const teacherOpen = useUi((s) => s.teacherOpen)
  const setTeacherOpen = useUi((s) => s.setTeacherOpen)

  // Before a key exists the button is still shown, as the way to discover the
  // feature. Once a key is set, the Settings toggle controls it.
  const teacherAvailable = !teacherConfigured || teacherEnabled

  // The floating button only belongs on lesson pages. The panel may also be
  // open on a test page, but only via the "Explain my mistakes" action there.
  const onLesson = Boolean(useMatch('/course/:courseId/lesson/:chapterId/:lessonId'))
  const onTest = Boolean(useMatch('/course/:courseId/test/:testId'))

  useEffect(() => {
    void loadSettings()
    void loadProgress()
    void loadContent()
    void loadTeacher()
  }, [loadSettings, loadProgress, loadContent, loadTeacher])

  // One subscription for the whole app; the store routes by request id.
  useEffect(() => window.desklearner.ai.onStreamEvent(handleStreamEvent), [handleStreamEvent])

  // Navigating away from course material — or turning the feature off — closes
  // the panel so it can't hover over an unrelated page.
  useEffect(() => {
    if (teacherOpen && (!teacherAvailable || (!onLesson && !onTest))) setTeacherOpen(false)
  }, [onLesson, onTest, teacherAvailable, teacherOpen, setTeacherOpen])

  useTheme()
  useGlobalShortcuts()

  // Nothing may render until stored state has arrived — a page that mounts and
  // records activity against an empty store would overwrite the user's progress.
  if (!settingsLoaded || !progressLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-subtle">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main className="min-w-0 flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/course/:courseId" element={<CoursePage />} />
            <Route
              path="/course/:courseId/lesson/:chapterId/:lessonId"
              element={<LessonPage />}
            />
            <Route path="/course/:courseId/test/:testId" element={<TestPage />} />
            <Route path="/course/:courseId/test/:testId/history" element={<TestHistoryPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      {onLesson && teacherAvailable && <TeacherFab />}
      {(onLesson || onTest) && teacherAvailable && <TeacherPanel />}
      <CommandPalette />
      <SearchDialog />
      <Toaster />
    </div>
  )
}
