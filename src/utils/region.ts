import { resolveWatermark } from '../processing/watermark/detect'
import type { WatermarkSource } from '../profiles/types'
import type { CleanupMode, WatermarkRegionOverride } from '../types'

/**
 * Computes the profile's default watermark region as fractional coordinates,
 * suitable as the starting point for the manual region editor. Returns a
 * centered fallback box if the orientation has no profile geometry.
 */
export function defaultRegionOverride(
  source: WatermarkSource,
  mode: CleanupMode,
  width: number,
  height: number,
): WatermarkRegionOverride {
  const { geometry } = resolveWatermark(source, mode, width, height)
  if (!geometry) {
    return { xFrac: 0.7, yFrac: 0.85, widthFrac: 0.25, heightFrac: 0.1 }
  }
  return {
    xFrac: geometry.x / width,
    yFrac: geometry.y / height,
    widthFrac: geometry.width / width,
    heightFrac: geometry.height / height,
  }
}
