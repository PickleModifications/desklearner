import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
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

  useEffect(() => {
    void loadSettings()
    void loadProgress()
    void loadContent()
  }, [loadSettings, loadProgress, loadContent])

  useTheme()
  useGlobalShortcuts()

  if (!settingsLoaded) {
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
      <CommandPalette />
      <SearchDialog />
      <Toaster />
    </div>
  )
}
