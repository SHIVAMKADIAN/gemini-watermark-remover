import type { CSSProperties } from 'react'
import type { MaskGeometryPixels } from '../workers/imageWorker.types'

interface MaskOverlayProps {
  geometry: MaskGeometryPixels | null
  mediaWidth: number
  mediaHeight: number
  label?: string
}

/**
 * Draws a dashed outline over exactly the pixel region the watermark
 * restoration touches. Positioned with percentages relative to the media's
 * own aspect ratio, so it stays aligned regardless of the preview's
 * rendered size — the underlying preview container must have its
 * `aspect-ratio` set to `mediaWidth / mediaHeight` with no letterboxing.
 */
export function MaskOverlay({ geometry, mediaWidth, mediaHeight, label }: MaskOverlayProps) {
  if (!geometry || !mediaWidth || !mediaHeight) return null

  const style: CSSProperties = {
    left: `${(geometry.x / mediaWidth) * 100}%`,
    top: `${(geometry.y / mediaHeight) * 100}%`,
    width: `${(geometry.width / mediaWidth) * 100}%`,
    height: `${(geometry.height / mediaHeight) * 100}%`,
  }

  return (
    <div
      aria-hidden="true"
      style={style}
      className="pointer-events-none absolute rounded-lg border-2 border-dashed border-accent bg-accent/15"
    >
      {label && (
        <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-text-primary">
          {label}
        </span>
      )}
    </div>
  )
}
