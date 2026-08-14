import { getProfile, resolveGeometry, type ResolvedGeometry } from '../../profiles/registry'
import type { CleanupParams, WatermarkColorProfile, WatermarkProfile, WatermarkSource } from '../../profiles/types'
import type { CleanupMode, MediaKind, WatermarkRegionOverride } from '../../types'

export function defaultSourceForKind(kind: MediaKind): WatermarkSource {
  return kind === 'image' ? 'gemini' : 'omni'
}

/** Human-readable description of the restoration method a mode will use. */
export function methodNoteForMode(source: WatermarkSource, mode: CleanupMode): string {
  const method = getProfile(source).cleanupParams[mode].method
  return method === 'inpaint'
    ? 'Deterministic content-aware fill reconstructs the region from surrounding pixels — no generative AI, no covering patch.'
    : 'Reverse-alpha compositing recovers the pixels under a translucent mark — deterministic, no generative inpainting.'
}

export interface WatermarkResolution {
  profile: WatermarkProfile
  params: CleanupParams
  color: WatermarkColorProfile
  geometry: ResolvedGeometry | null
}

/**
 * Selects the watermark profile for a source, resolves its cleanup
 * parameters for the chosen mode, and computes the mask geometry in actual
 * pixel coordinates for this media's dimensions — or applies a manual
 * region override captured from the calibration UI instead of the profile
 * default.
 */
export function resolveWatermark(
  source: WatermarkSource,
  mode: CleanupMode,
  mediaWidth: number,
  mediaHeight: number,
  override?: WatermarkRegionOverride | null,
): WatermarkResolution {
  const profile = getProfile(source)
  const params = profile.cleanupParams[mode]

  if (override) {
    const width = override.widthFrac * mediaWidth
    const height = override.heightFrac * mediaHeight
    const minDim = Math.min(width, height)
    const geometry: ResolvedGeometry = {
      x: override.xFrac * mediaWidth,
      y: override.yFrac * mediaHeight,
      width,
      height,
      cornerRadius: minDim * 0.25,
      feather: minDim * 0.12,
    }
    return { profile, params, color: profile.color, geometry }
  }

  return { profile, params, color: profile.color, geometry: resolveGeometry(profile, mediaWidth, mediaHeight) }
}
