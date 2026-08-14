import type { CleanupMode, Orientation, Resolution } from '../types'

export type WatermarkSource = 'gemini' | 'omni' | 'veo'

export type WatermarkAnchor =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'bottom-center'

/**
 * Mask geometry is expressed entirely as fractions of the media's actual
 * pixel dimensions, never fixed CSS pixels, so the same profile maps
 * correctly onto every supported resolution/orientation.
 */
export interface WatermarkGeometry {
  anchor: WatermarkAnchor
  /** Margin from the anchor edges, as a fraction of width/height. */
  marginXFrac: number
  marginYFrac: number
  /** Size of the watermark bounding box, as a fraction of width/height. */
  widthFrac: number
  heightFrac: number
  /** Corner radius of the mask shape, as a fraction of the box's min dimension. */
  cornerRadiusFrac: number
  /** Softness of the mask edge (feather), as a fraction of the box's min dimension. */
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

export type RestorationMethod = 'inpaint' | 'reverse-alpha'

export interface CleanupParams {
  /**
   * Restoration strategy for the masked region:
   * - `'inpaint'`: deterministic content-aware fill from surrounding pixels
   *   (robust default — works on any background, never clamps to black).
   * - `'reverse-alpha'`: invert the known watermark composite (best only when
   *   the area under the mark is bright, e.g. a translucent white badge on a
   *   light background).
   */
  method: RestorationMethod
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
  geometry: Record<Orientation, WatermarkGeometry | null>
  color: WatermarkColorProfile
  cleanupParams: Record<CleanupMode, CleanupParams>
}
