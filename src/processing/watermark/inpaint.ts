import { fallbackEdgeDirectedFill } from './fallbackFill'

export interface PixelBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Deterministic, non-generative content-aware fill for the watermark region.
 *
 * Unlike reverse-alpha (which assumes a known watermark color/alpha and can
 * clamp to black when the underlying area is darker than the assumed
 * watermark), this reconstructs the masked pixels purely from the surrounding
 * real content:
 *
 *   1. Seed every masked ("hole") pixel with an inverse-distance interpolation
 *      of the nearest known pixels in the four cardinal directions.
 *   2. Relax that seed toward a smooth solution of Laplace's equation
 *      (Gauss-Seidel diffusion) with the known surrounding pixels as fixed
 *      boundary conditions.
 *
 * The result is a seamless continuation of the background around the mark. No
 * content is invented — only propagated and smoothed from adjacent real
 * pixels — so it is fully deterministic and never hallucinates detail.
 *
 * Returns the number of pixels reconstructed.
 */
export function inpaintRegion(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Float32Array,
  bounds: PixelBounds,
  peakAlpha: number,
  iterations: number,
): number {
  const eps = Math.max(1e-4, peakAlpha * 0.03)
  const { minX, minY, maxX, maxY } = bounds

  const holes: number[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * width + x
      if (mask[idx] > eps) holes.push(idx)
    }
  }
  if (holes.length === 0) return 0

  const holeArr = Uint32Array.from(holes)

  // 1. Initial guess: edge-directed inverse-distance fill from known pixels.
  fallbackEdgeDirectedFill(pixels, width, height, holeArr, bounds)

  // 2. Gauss-Seidel diffusion. Each hole pixel relaxes toward the average of
  //    its 4 neighbors; neighbors that lie outside the hole are fixed real
  //    pixels, so the solution stays anchored to the surrounding content and
  //    directional seams from the initial guess are smoothed away.
  const iters = Math.max(0, iterations | 0)
  for (let it = 0; it < iters; it++) {
    for (let h = 0; h < holeArr.length; h++) {
      const idx = holeArr[h]
      const x = idx % width
      const y = (idx / width) | 0
      const o = idx * 4
      const left = x > 0 ? o - 4 : o
      const right = x < width - 1 ? o + 4 : o
      const up = y > 0 ? o - width * 4 : o
      const down = y < height - 1 ? o + width * 4 : o
      pixels[o] = (pixels[left] + pixels[right] + pixels[up] + pixels[down] + 2) >> 2
      pixels[o + 1] = (pixels[left + 1] + pixels[right + 1] + pixels[up + 1] + pixels[down + 1] + 2) >> 2
      pixels[o + 2] = (pixels[left + 2] + pixels[right + 2] + pixels[up + 2] + pixels[down + 2] + 2) >> 2
      // Alpha channel is left untouched.
    }
  }

  return holeArr.length
}
