import type { VideoEngine } from '../processing/video/pipeline'
import { cn } from '../utils/cn'

interface EngineSelectorProps {
  engine: VideoEngine
  onChange: (engine: VideoEngine) => void
}

const ENGINES: Array<{ id: VideoEngine; label: string; description: string }> = [
  {
    id: 'spatial',
    label: 'Spatial',
    description: 'Reconstructs each frame from its own surrounding pixels. Fast, and the safe default.',
  },
  {
    id: 'temporal',
    label: 'Temporal (reveal)',
    description:
      'Finds the real background behind the mark in other frames (revealed by motion/pan) and warps it in. Best when the scene or camera moves; slower. Falls back to spatial where nothing is revealed.',
  },
]

export function EngineSelector({ engine, onChange }: EngineSelectorProps) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-xs text-text-muted">Reconstruction engine</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {ENGINES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onChange(e.id)}
            aria-pressed={engine === e.id}
            className={cn(
              'focus-ring flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors',
              engine === e.id ? 'border-accent bg-accent-soft' : 'border-border-subtle bg-surface-2 hover:border-border-strong',
            )}
          >
            <span className="text-sm font-semibold text-text-primary">{e.label}</span>
            <span className="text-xs leading-snug text-text-secondary">{e.description}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
