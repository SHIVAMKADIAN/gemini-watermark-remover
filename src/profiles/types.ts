import type { CleanupMode, Orientation, Resolution } from '../types'

export type WatermarkSource = 'gemini' | 'omni' | 'veo'

export type WatermarkAnchor =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'bottom-center'

/**
 * The visible Gemini/Veo watermark is a fixed-size square logo inset from a
 * corner — NOT a fraction of the frame. Sizes/margins are therefore specified
 * in pixels, measured at a canonical export long-side, and scaled linearly to
 * the actual media's long side. This matches the reverse-engineered profiles
 * in allenk/GeminiWatermarkTool (Gemini logo 36/48/96 px, margins 32/64/192 px)
 * and keeps the mask small and correctly placed at any resolution.
 */
export interface WatermarkGeometry {
  anchor: WatermarkAnchor
  /** Long-side length (px) the measurements below were taken at. */
  canonicalLongSide: number
  /** Logo square edge length (px) at the canonical long-side. */
  logoSizePx: number
  /** Minimum logo edge (px) after down-scaling to smaller media. */
  minLogoPx: number
  /** Gap (px) between the logo and its anchored edges, at the canonical long-side. */
  marginPx: number
  /** Extra padding (px, canonical) added around the logo when building the mask. */
  paddingPx: number
  /** Corner radius of the mask box, as a fraction of its size. */
  cornerRadiusFrac: number
  /** Softness of the mask edge (feather), as a fraction of the box's size. */
  featherFrac: number
}

/**
 * Known or estimated compositing characteristics of the watermark overlay,
 * used to invert `observed = alpha*watermark + (1-alpha)*original`.
 */
export interface WatermarkColorProfile {
  r: number
  g: number
  b: number
  /** Peak alpha at the watermark's most opaque pixels, 0..1. */
  alpha: number
}

export type RestorationMethod = 'exemplar' | 'inpaint' | 'reverse-alpha'

export interface CleanupParams {
  /**
   * Restoration strategy for the masked region:
   * - `'exemplar'`: deterministic exemplar-based fill that copies real texture
   *   patches from nearby areas (default — removes the mark without blurring,
   *   preserves detailed/textured backgrounds).
   * - `'inpaint'`: diffusion-based content-aware fill (smooth; fast; best on
   *   flat backgrounds).
   * - `'reverse-alpha'`: invert the known watermark composite (best only when
   *   the area under the mark is bright, e.g. a translucent white badge on a
   *   light background).
   */
  method: RestorationMethod
  /**
   * When true (and not using reverse-alpha), detect the actual bright watermark
   * pixels inside the region and reconstruct only those, preserving surrounding
   * detail. Falls back to the whole region box on low-contrast areas.
   */
  detectWithinRegion: boolean
  /** Patch half-size for the `'exemplar'` method. */
  patchRadius: number
  /** Local search-window half-size for the `'exemplar'` method. */
  searchRadius: number
  /** Candidate stride for the `'exemplar'` method (larger = faster/coarser). */
  exemplarStride: number
  /** Diffusion smoothing iterations for the `'inpaint'` method. */
  inpaintIterations: number
  /** Multiplier applied to the profile's peak alpha before inversion. */
  alphaScale: number
  /** Whether to run the deterministic edge-directed fallback reconstruction. */
  useFallbackReconstruction: boolean
  /** Alpha value (post inversion-safety-clamp) above which the fallback kicks in. */
  fallbackAlphaThreshold: number
}

export interface WatermarkProfile {
  id: string
  name: string
  source: WatermarkSource
  description: string
  supportedResolutions: Resolution[]
  /** Aspect-ratio tolerance (relative) for matching non-exact resolutions. */
  aspectTolerance: number
  geometry: WatermarkGeometry
  /** Orientations this profile knows how to place its watermark for. */
  orientations: Orientation[]
  color: WatermarkColorProfile
  cleanupParams: Record<CleanupMode, CleanupParams>
}
