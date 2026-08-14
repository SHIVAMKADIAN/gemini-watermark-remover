interface CompareDividerProps {
  position: number
  onPointerDown: (e: React.PointerEvent) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

export function CompareDivider({ position, onPointerDown, onKeyDown }: CompareDividerProps) {
  return (
    <div
      role="slider"
      aria-label="Comparison position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position * 100)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="focus-ring absolute top-0 bottom-0 z-20 flex w-8 -translate-x-1/2 cursor-ew-resize items-center justify-center"
      style={{ left: `${position * 100}%` }}
    >
      <div className="absolute top-0 bottom-0 w-0.5 bg-white/90" />
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-surface-2/90 shadow-lg">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-white">
          <path d="M8 6 5 10l3 4M12 6l3 4-3 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
