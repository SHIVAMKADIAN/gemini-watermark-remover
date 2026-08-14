import type { WatermarkColorProfile } from '../../profiles/types'

export function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/**
 * Inverts `observed = alpha*watermarkColor + (1-alpha)*original` per RGB
 * channel for every pixel whose mask alpha exceeds `epsilon`, in place.
 * Alpha (unstable) pixels are left untouched here — they are handled by the
 * fallback reconstruction pass — everything outside the mask is left
 * completely unmodified. Returns the list of pixel indices that were too
 * unstable to invert directly (alpha >= unstableThreshold).
 */
export function applyReverseAlpha(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Float32Array,
  color: WatermarkColorProfile,
  unstableThreshold: number,
  epsilon = 1 / 255,
): Uint32Array {
  const unstable: number[] = []
  const n = width * height
  for (let i = 0; i < n; i++) {
    const alpha = mask[i]
    if (alpha <= epsilon) continue
    if (alpha >= unstableThreshold) {
      unstable.push(i)
      continue
    }
    const o = i * 4
    const inv = 1 / (1 - alpha)
    pixels[o] = clamp255((pixels[o] - alpha * color.r) * inv)
    pixels[o + 1] = clamp255((pixels[o + 1] - alpha * color.g) * inv)
    pixels[o + 2] = clamp255((pixels[o + 2] - alpha * color.b) * inv)
    // Alpha channel (pixels[o+3]) is untouched — watermark is a color overlay,
    // not a transparency change to the underlying image.
  }
  return Uint32Array.from(unstable)
}
