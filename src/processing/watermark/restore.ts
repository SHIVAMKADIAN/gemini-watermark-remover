import type { ResolvedGeometry } from '../../profiles/registry'
import type { CleanupParams, WatermarkColorProfile } from '../../profiles/types'
import { fallbackEdgeDirectedFill } from './fallbackFill'
import { generateWatermarkMask, maskBounds } from './mask'
import { applyReverseAlpha } from './reverseAlpha'

export interface PreparedMask {
  mask: Float32Array
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  unstableThreshold: number
  pixelsModified: number
}

/**
 * Precomputes the per-pixel alpha mask for a given geometry once, so it can
 * be reused across every frame of a video without recomputing the (cheap
 * but non-trivial) rounded-rect distance field each time.
 */
export function prepareMask(
  geometry: ResolvedGeometry,
  color: WatermarkColorProfile,
  params: CleanupParams,
  width: number,
  height: number,
): PreparedMask {
  const peakAlpha = color.alpha * params.alphaScale
  const mask = generateWatermarkMask(width, height, geometry, peakAlpha)
  const bounds = maskBounds(width, height, geometry)
  const unstableThreshold = params.useFallbackReconstruction ? params.fallbackAlphaThreshold : 1

  let pixelsModified = 0
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (mask[y * width + x] > 1 / 255) pixelsModified++
    }
  }

  return { mask, bounds, unstableThreshold, pixelsModified }
}

/**
 * Applies a precomputed mask to a single RGBA frame, in place. Touches only
 * pixels inside the (feathered) watermark mask; everything else is left
 * byte-for-byte untouched.
 */
export function applyPreparedMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  prepared: PreparedMask,
  color: WatermarkColorProfile,
  params: CleanupParams,
): number {
  const unstable = applyReverseAlpha(pixels, width, height, prepared.mask, color, prepared.unstableThreshold)
  if (params.useFallbackReconstruction && unstable.length > 0) {
    fallbackEdgeDirectedFill(pixels, width, height, unstable, prepared.bounds)
  }
  return unstable.length
}

export interface RestoreResult {
  mask: Float32Array
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  pixelsModified: number
  fallbackPixels: number
}

/**
 * Applies deterministic watermark restoration to a single RGBA frame, in
 * place, touching only pixels inside the (feathered) watermark mask.
 * Convenience wrapper around {@link prepareMask} + {@link applyPreparedMask}
 * for one-off use (e.g. still images).
 */
export function restoreWatermarkRegion(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  geometry: ResolvedGeometry,
  color: WatermarkColorProfile,
  params: CleanupParams,
): RestoreResult {
  const prepared = prepareMask(geometry, color, params, width, height)
  const fallbackPixels = applyPreparedMask(pixels, width, height, prepared, color, params)
  return { mask: prepared.mask, bounds: prepared.bounds, pixelsModified: prepared.pixelsModified, fallbackPixels }
}
