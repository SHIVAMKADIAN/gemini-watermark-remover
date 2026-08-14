import type { ProcessingProgress } from '../types'

interface ProgressBarProps {
  progress: ProcessingProgress
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const pct = Math.round(progress.progress * 100)
  return (
    <div aria-live="polite" className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">{progress.message}</span>
        <span className="tabular-nums text-text-secondary">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress.totalFrames != null && progress.frameIndex != null && (
        <p className="mt-2 text-xs tabular-nums text-text-muted">
          Frame {progress.frameIndex.toLocaleString()} / {progress.totalFrames.toLocaleString()}
        </p>
      )}
    </div>
  )
}
