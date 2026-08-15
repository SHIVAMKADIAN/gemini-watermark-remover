import { exemplarInpaint } from '../watermark/exemplarInpaint'
import { cumulativeTranslation, estimateTranslation, type Translation } from './motion'
import { poissonBlend, type PixelBounds } from './poisson'

export interface TemporalWindow {
  /** RGBA frame buffers, all width*height*4, in presentation order. */
  frames: Uint8ClampedArray[]
  width: number
  height: number
  /** Static removal mask (same for every frame): alpha>eps marks the hole. */
  mask: Float32Array
  bounds: PixelBounds
}

export interface TemporalOptions {
  /** Frame offsets to probe for a revealed source, nearest first. */
  probes?: number[]
  /** Poisson seam-blend iterations (0 disables). */
  poissonIterations?: number
  /** Max background translation (px) the motion search considers. */
  maxShift?: number
  /** Exemplar options for the spatial residual fallback. */
  exemplar?: { patchRadius: number; searchRadius: number; stride: number }
}

export interface TemporalFrameStats {
  holePixels: number
  temporalPixels: number
  residualPixels: number
}

const DEFAULT_PROBES = [1, -1, 2, -2, 4, -4, 8, -8, 16, -16, 24, -24]

function bilinear(frame: Uint8ClampedArray, width: number, height: number, x: number, y: number, ch: number): number {
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x > width - 1) x = width - 1
  if (y > height - 1) y = height - 1
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const a = frame[(y0 * width + x0) * 4 + ch]
  const b = frame[(y0 * width + x1) * 4 + ch]
  const c = frame[(y1 * width + x0) * 4 + ch]
  const d = frame[(y1 * width + x1) * 4 + ch]
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
}

/** True where a pixel is safe to match on for motion estimation (outside the hole). */
function usableMask(mask: Float32Array): Uint8Array {
  const u = new Uint8Array(mask.length)
  const eps = 1 / 255
  for (let i = 0; i < mask.length; i++) u[i] = mask[i] > eps ? 0 : 1
  return u
}

/**
 * Estimates per-adjacent-pair global translation across the window (background
 * motion), matching only on unmasked pixels.
 */
export function estimateWindowMotion(win: TemporalWindow, maxShift = 48): Translation[] {
  const usable = usableMask(win.mask)
  const pairs: Translation[] = []
  for (let i = 0; i < win.frames.length - 1; i++) {
    pairs.push(estimateTranslation(win.frames[i], win.frames[i + 1], win.width, win.height, usable, maxShift))
  }
  return pairs
}

/**
 * Fills every frame's hole by retrieving real background revealed in other
 * frames (retrieval-first, per the vidfill principle), then Poisson-blending
 * the seam, and finally spatially inpainting only the pixels no frame ever
 * revealed. Modifies `win.frames` in place. Returns per-frame coverage stats.
 */
export function temporalFillWindow(win: TemporalWindow, options: TemporalOptions = {}): TemporalFrameStats[] {
  const { frames, width, height, mask, bounds } = win
  const eps = 1 / 255
  const probes = options.probes ?? DEFAULT_PROBES
  const poissonIterations = options.poissonIterations ?? 60
  const exemplarOpts = options.exemplar ?? { patchRadius: 4, searchRadius: 44, stride: 3 }
  const n = frames.length

  const pairs = estimateWindowMotion(win, options.maxShift ?? 48)

  // Precompute the list of hole pixels once (static mask).
  const holeIdx: number[] = []
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (mask[y * width + x] > eps) holeIdx.push(y * width + x)
    }
  }

  // Snapshot originals: retrieval must sample untouched frames, not ones we've
  // already partially filled (sample-once from the real pixels).
  const originals = frames.map((f) => f.slice())

  const stats: TemporalFrameStats[] = []

  for (let t = 0; t < n; t++) {
    const frame = frames[t]
    const fill = new Float32Array(width * height * 3)
    const covered = new Uint8Array(width * height)
    let temporalCount = 0

    for (const idx of holeIdx) {
      const px = idx % width
      const py = (idx / width) | 0
      let filled = false
      for (const k of probes) {
        const s = t + k
        if (s < 0 || s >= n) continue
        const off = cumulativeTranslation(pairs, t, s)
        const sx = px + off.dx
        const sy = py + off.dy
        if (sx < 0 || sy < 0 || sx > width - 1 || sy > height - 1) continue
        // The revealed pixel must be OUTSIDE the (static) hole in the source frame.
        const si = Math.round(sy) * width + Math.round(sx)
        if (mask[si] > eps) continue
        const g = idx * 3
        fill[g] = bilinear(originals[s], width, height, sx, sy, 0)
        fill[g + 1] = bilinear(originals[s], width, height, sx, sy, 1)
        fill[g + 2] = bilinear(originals[s], width, height, sx, sy, 2)
        covered[idx] = 1
        temporalCount++
        filled = true
        break
      }
      void filled
    }

    // Seam-correct the retrieved pixels, then commit them to the frame.
    if (temporalCount > 0) {
      if (poissonIterations > 0) {
        poissonBlend(frame, width, height, fill, covered, bounds, poissonIterations)
      } else {
        for (const idx of holeIdx) {
          if (!covered[idx]) continue
          const o = idx * 4
          const g = idx * 3
          frame[o] = fill[g]
          frame[o + 1] = fill[g + 1]
          frame[o + 2] = fill[g + 2]
        }
      }
    }

    // Residual: pixels no frame revealed → spatial exemplar fill on this frame.
    let residualCount = 0
    const residualMask = new Float32Array(width * height)
    for (const idx of holeIdx) {
      if (!covered[idx]) {
        residualMask[idx] = 1
        residualCount++
      }
    }
    if (residualCount > 0) {
      exemplarInpaint(frame, width, height, residualMask, bounds, 1, exemplarOpts)
    }

    stats.push({ holePixels: holeIdx.length, temporalPixels: temporalCount, residualPixels: residualCount })
  }

  return stats
}
