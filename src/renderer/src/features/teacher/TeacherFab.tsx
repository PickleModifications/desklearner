import { GraduationCap, X } from 'lucide-react'
import { useSettings } from '@/stores/settings'
import { useTeacher } from '@/stores/teacher'
import { useUi } from '@/stores/ui'
import { cn } from '@/lib/utils'

/**
 * The bottom-right entry point. Sits on a radial-gradient disc built from the
 * live accent token, so it follows the accent chosen in Settings.
 */
export function TeacherFab(): React.JSX.Element {
  const open = useUi((s) => s.teacherOpen)
  const setOpen = useUi((s) => s.setTeacherOpen)
  const reducedMotion = useSettings((s) => s.settings.reducedMotion)
  const streaming = useTeacher((s) => s.streaming)

  return (
    <button
      type="button"
      className={cn(
        'fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-e3 transition-transform',
        !reducedMotion && 'hover:scale-105 active:scale-95',
        // The halo doubles as a "still working" signal while a reply streams.
        !reducedMotion && !open && 'teacher-halo',
        !reducedMotion && Boolean(streaming) && 'teacher-halo-active'
      )}
      style={{
        background:
          'radial-gradient(circle at 32% 28%, color-mix(in oklab, var(--accent) 55%, white) 0%, var(--accent) 48%, color-mix(in oklab, var(--accent) 72%, black) 100%)',
        color: 'var(--accent-contrast)'
      }}
      onClick={() => setOpen(!open)}
      aria-label={open ? 'Close teacher' : 'Ask the teacher'}
      aria-expanded={open}
      title={open ? 'Close teacher' : 'Ask the teacher (Ctrl+/)'}
    >
      <span
        className={cn('teacher-fab-icon', !reducedMotion && 'teacher-fab-icon-animated')}
        data-open={open ? 'true' : 'false'}
      >
        <GraduationCap size={23} className="teacher-fab-open" />
        <X size={21} className="teacher-fab-close" />
      </span>
    </button>
  )
}
