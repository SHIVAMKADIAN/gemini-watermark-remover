import { CLEANUP_MODES, type CleanupMode } from '../types'
import type { WatermarkSource } from '../profiles/types'
import { cn } from '../utils/cn'

interface SourceOption {
  id: WatermarkSource
  label: string
}

const SOURCE_OPTIONS: SourceOption[] = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'omni', label: 'Gemini Omni' },
  { id: 'veo', label: 'Google Flow / Veo' },
]

interface CleanupControlsProps {
  source: WatermarkSource
  onSourceChange: (source: WatermarkSource) => void
  mode: CleanupMode
  onModeChange: (mode: CleanupMode) => void
  showMask: boolean
  onShowMaskChange: (show: boolean) => void
  detectMark: boolean
  onDetectMarkChange: (detect: boolean) => void
  onCalibrate: () => void
  sourceOptions?: SourceOption[]
}

export function CleanupControls({
  source,
  onSourceChange,
  mode,
  onModeChange,
  showMask,
  onShowMaskChange,
  detectMark,
  onDetectMarkChange,
  onCalibrate,
  sourceOptions = SOURCE_OPTIONS,
}: CleanupControlsProps) {
  return (
    <section aria-label="Cleanup controls" className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <h2 className="mb-4 text-sm font-medium text-text-primary">Cleanup controls</h2>

      <fieldset className="mb-5">
        <legend className="mb-2 text-xs text-text-muted">Watermark source</legend>
        <div className="flex flex-wrap gap-2">
          {sourceOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSourceChange(opt.id)}
              aria-pressed={source === opt.id}
              className={cn(
                'focus-ring rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                source === opt.id
                  ? 'border-accent bg-accent-soft text-text-primary'
                  : 'border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="mb-2 text-xs text-text-muted">Cleanup strength</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {CLEANUP_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              aria-pressed={mode === m.id}
              className={cn(
                'focus-ring flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors',
                mode === m.id
                  ? 'border-accent bg-accent-soft'
                  : 'border-border-subtle bg-surface-2 hover:border-border-strong',
              )}
            >
              <span className="text-sm font-semibold text-text-primary">{m.label}</span>
              <span className="text-xs leading-snug text-text-secondary">{m.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3 border-t border-border-subtle pt-4">
        <label className="flex cursor-pointer items-start gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={detectMark}
            onChange={(e) => onDetectMarkChange(e.target.checked)}
            className="focus-ring mt-0.5 h-4 w-4 rounded border-border-strong bg-surface-2 accent-accent"
          />
          <span>
            Detect mark inside region
            <span className="block text-xs text-text-muted">
              Reconstruct only the bright watermark pixels found in the region, keeping surrounding detail. Turn off to
              rebuild the whole region box.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={showMask}
              onChange={(e) => onShowMaskChange(e.target.checked)}
              className="focus-ring h-4 w-4 rounded border-border-strong bg-surface-2 accent-accent"
            />
            Show processing mask
          </label>
          <button
            type="button"
            onClick={onCalibrate}
            className="focus-ring rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Adjust watermark region…
          </button>
        </div>
      </div>
    </section>
  )
}
