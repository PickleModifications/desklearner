export function ProgressRing({
  value,
  size = 40,
  stroke = 4,
  label
}: {
  /** 0-1 */
  value: number
  size?: number
  stroke?: number
  label?: string
}): React.JSX.Element {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, value))

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
        style={{ fontSize: size * 0.28 }}
      >
        {label ?? `${Math.round(clamped * 100)}`}
      </span>
    </div>
  )
}

export function ProgressBar({ value }: { value: number }): React.JSX.Element {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          background: 'var(--accent)',
          transition: 'width 400ms ease'
        }}
      />
    </div>
  )
}
