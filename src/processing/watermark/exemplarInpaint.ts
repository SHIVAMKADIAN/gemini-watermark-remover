import { fallbackEdgeDirectedFill } from './fallbackFill'

export interface PixelBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ExemplarOptions {
  /** Half-size of the comparison/copy patch (patch is (2r+1)²). */
  patchRadius: number
  /** Half-size of the window (around each target) searched for source patches. */
  searchRadius: number
  /** Step between candidate source-patch centers (>=1; larger = faster, coarser). */
  stride: number
}

/**
 * Deterministic exemplar-based (Criminisi-style) inpainting.
 *
 * Instead of smoothing the hole (which blurs textured backgrounds), this fills
 * the watermark region by copying the best-matching real texture patches from
 * the surrounding, known area — onion-peeling inward from the boundary. Source
 * patches are always taken from the *original* known pixels (never from
 * already-synthesized ones), so real texture and detail are preserved: the
 * mark is removed, not blurred. Fully deterministic; no generative content.
 *
 * Returns the number of pixels reconstructed.
 */
export function exemplarInpaint(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Float32Array,
  bounds: PixelBounds,
  peakAlpha: number,
  opts: ExemplarOptions,
): number {
  const eps = Math.max(1e-4, peakAlpha * 0.03)
  const R = Math.max(1, opts.patchRadius | 0)
  const stride = Math.max(1, opts.stride | 0)
  const searchR = Math.max(R + 1, opts.searchRadius | 0)

  const rx0 = Math.max(0, bounds.minX - searchR)
  const ry0 = Math.max(0, bounds.minY - searchR)
  const rx1 = Math.min(width - 1, bounds.maxX + searchR)
  const ry1 = Math.min(height - 1, bounds.maxY + searchR)
  const rw = rx1 - rx0 + 1
  const rh = ry1 - ry0 + 1

  // filled: 1 = has a valid color (known or already reconstructed), 0 = hole.
  // originalKnown: 1 only for pixels that were known before inpainting — the
  // only pixels we ever copy FROM, so we never propagate synthesized content.
  const filled = new Uint8Array(rw * rh)
  const originalKnown = new Uint8Array(rw * rh)
  let holeCount = 0
  for (let y = ry0; y <= ry1; y++) {
    const row = (y - ry0) * rw
    for (let x = rx0; x <= rx1; x++) {
      const i = row + (x - rx0)
      if (mask[y * width + x] > eps) {
        holeCount++
      } else {
        filled[i] = 1
        originalKnown[i] = 1
      }
    }
  }
  const totalHole = holeCount
  if (totalHole === 0) return 0

  // Precompute the centers of all fully-original-known candidate source patches.
  const srcX: number[] = []
  const srcY: number[] = []
  for (let sy = ry0 + R; sy <= ry1 - R; sy += stride) {
    for (let sx = rx0 + R; sx <= rx1 - R; sx += stride) {
      let ok = true
      for (let dy = -R; dy <= R && ok; dy++) {
        const base = (sy + dy - ry0) * rw + (sx - R - rx0)
        for (let dx = 0; dx <= 2 * R; dx++) {
          if (!originalKnown[base + dx]) {
            ok = false
            break
          }
        }
      }
      if (ok) {
        srcX.push(sx)
        srcY.push(sy)
      }
    }
  }
  const nSrc = srcX.length

  let guard = totalHole * 2 + 32

  // Layered onion-peel: each outer pass fills the current boundary ring, most-
  // surrounded pixels first, then re-derives the next ring. This keeps boundary
  // recomputation to ~O(rings) passes instead of one per patch.
  while (holeCount > 0 && guard-- > 0) {
    const boundary: number[] = []
    const boundaryPri: number[] = []
    for (let y = ry0; y <= ry1; y++) {
      const row = (y - ry0) * rw
      for (let x = rx0; x <= rx1; x++) {
        const i = row + (x - rx0)
        if (filled[i]) continue
        const l = x > rx0 && filled[i - 1] ? 1 : 0
        const r = x < rx1 && filled[i + 1] ? 1 : 0
        const u = y > ry0 && filled[i - rw] ? 1 : 0
        const d = y < ry1 && filled[i + rw] ? 1 : 0
        const n = l + r + u + d
        if (n > 0) {
          boundary.push(i)
          boundaryPri.push(n)
        }
      }
    }
    if (boundary.length === 0) break

    // Fill most-surrounded boundary pixels first (4 → 1 known neighbors).
    for (let pri = 4; pri >= 1; pri--) {
      for (let b = 0; b < boundary.length; b++) {
        if (boundaryPri[b] !== pri) continue
        const i = boundary[b]
        if (filled[i]) continue
        const tx = (i % rw) + rx0
        const ty = ((i / rw) | 0) + ry0

        // Find the best-matching original-known source patch within searchR.
        let bestSSD = Infinity
        let bsx = -1
        let bsy = -1
        for (let k = 0; k < nSrc; k++) {
          const sx = srcX[k]
          const sy = srcY[k]
          if (sx < tx - searchR || sx > tx + searchR || sy < ty - searchR || sy > ty + searchR) continue
          let ssd = 0
          for (let dy = -R; dy <= R; dy++) {
            const ty2 = ty + dy
            if (ty2 < ry0 || ty2 > ry1) continue
            const trow = (ty2 - ry0) * rw
            const sy2 = sy + dy
            for (let dx = -R; dx <= R; dx++) {
              const tx2 = tx + dx
              if (tx2 < rx0 || tx2 > rx1) continue
              if (!filled[trow + (tx2 - rx0)]) continue // only match on known target pixels
              const to = (ty2 * width + tx2) * 4
              const so = (sy2 * width + sx + dx) * 4
              const dr = pixels[to] - pixels[so]
              const dg = pixels[to + 1] - pixels[so + 1]
              const db = pixels[to + 2] - pixels[so + 2]
              ssd += dr * dr + dg * dg + db * db
            }
            if (ssd >= bestSSD) break
          }
          if (ssd < bestSSD) {
            bestSSD = ssd
            bsx = sx
            bsy = sy
          }
        }

        if (bsx < 0) continue // no source yet; a later pass / fallback handles it

        // Copy the unknown target pixels from the chosen source patch.
        for (let dy = -R; dy <= R; dy++) {
          const ty2 = ty + dy
          if (ty2 < ry0 || ty2 > ry1) continue
          const trow = (ty2 - ry0) * rw
          const sy2 = bsy + dy
          for (let dx = -R; dx <= R; dx++) {
            const tx2 = tx + dx
            if (tx2 < rx0 || tx2 > rx1) continue
            const ti = trow + (tx2 - rx0)
            if (filled[ti]) continue
            const to = (ty2 * width + tx2) * 4
            const so = (sy2 * width + bsx + dx) * 4
            pixels[to] = pixels[so]
            pixels[to + 1] = pixels[so + 1]
            pixels[to + 2] = pixels[so + 2]
            filled[ti] = 1
            holeCount--
          }
        }
      }
    }
  }

  // Any pixels still unfilled (e.g. no source patch existed) get the
  // deterministic edge-directed interpolation so no raw watermark remains.
  if (holeCount > 0) {
    const leftover: number[] = []
    for (let y = ry0; y <= ry1; y++) {
      const row = (y - ry0) * rw
      for (let x = rx0; x <= rx1; x++) {
        if (!filled[row + (x - rx0)]) leftover.push(y * width + x)
      }
    }
    if (leftover.length > 0) {
      fallbackEdgeDirectedFill(pixels, width, height, Uint32Array.from(leftover), bounds)
    }
  }

  return totalHole
}
