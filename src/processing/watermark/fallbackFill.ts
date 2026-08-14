import { clamp255 } from './reverseAlpha'

export interface PixelBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Deterministic, non-generative reconstruction for pixels where reverse-alpha
 * inversion is numerically unstable (alpha too close to 1). For each such
 * pixel, walks outward in the four cardinal directions to the nearest
 * already-resolved pixel (either untouched original or a reverse-alpha
 * corrected neighbor) and blends those by inverse distance. This is edge-
 * directed interpolation, not AI inpainting: no content is invented, only
 * propagated from immediately adjacent real pixels.
 */
export function fallbackEdgeDirectedFill(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  unstable: Uint32Array,
  bounds: PixelBounds,
): void {
  if (unstable.length === 0) return

  const isUnstable = new Uint8Array(width * height)
  for (const idx of unstable) isUnstable[idx] = 1

  const { minX, minY, maxX, maxY } = bounds
  const boxW = maxX - minX + 1
  const boxH = maxY - minY + 1
  const size = boxW * boxH

  const hR = new Float32Array(size)
  const hG = new Float32Array(size)
  const hB = new Float32Array(size)
  const hW = new Float32Array(size)
  const vR = new Float32Array(size)
  const vG = new Float32Array(size)
  const vB = new Float32Array(size)
  const vW = new Float32Array(size)

  for (let y = minY; y <= maxY; y++) {
    let haveL = false
    let lr = 0
    let lg = 0
    let lb = 0
    let ldist = 0
    for (let x = minX; x <= maxX; x++) {
      const idx = y * width + x
      const li = (y - minY) * boxW + (x - minX)
      if (!isUnstable[idx]) {
        haveL = true
        const o = idx * 4
        lr = pixels[o]
        lg = pixels[o + 1]
        lb = pixels[o + 2]
        ldist = 0
      } else if (haveL) {
        ldist++
        const w = 1 / ldist
        hR[li] += lr * w
        hG[li] += lg * w
        hB[li] += lb * w
        hW[li] += w
      }
    }

    let haveR = false
    let rr = 0
    let rg = 0
    let rb = 0
    let rdist = 0
    for (let x = maxX; x >= minX; x--) {
      const idx = y * width + x
      const li = (y - minY) * boxW + (x - minX)
      if (!isUnstable[idx]) {
        haveR = true
        const o = idx * 4
        rr = pixels[o]
        rg = pixels[o + 1]
        rb = pixels[o + 2]
        rdist = 0
      } else if (haveR) {
        rdist++
        const w = 1 / rdist
        hR[li] += rr * w
        hG[li] += rg * w
        hB[li] += rb * w
        hW[li] += w
      }
    }
  }

  for (let x = minX; x <= maxX; x++) {
    let haveU = false
    let ur = 0
    let ug = 0
    let ub = 0
    let udist = 0
    for (let y = minY; y <= maxY; y++) {
      const idx = y * width + x
      const li = (y - minY) * boxW + (x - minX)
      if (!isUnstable[idx]) {
        haveU = true
        const o = idx * 4
        ur = pixels[o]
        ug = pixels[o + 1]
        ub = pixels[o + 2]
        udist = 0
      } else if (haveU) {
        udist++
        const w = 1 / udist
        vR[li] += ur * w
        vG[li] += ug * w
        vB[li] += ub * w
        vW[li] += w
      }
    }

    let haveD = false
    let dr = 0
    let dg = 0
    let db = 0
    let ddist = 0
    for (let y = maxY; y >= minY; y--) {
      const idx = y * width + x
      const li = (y - minY) * boxW + (x - minX)
      if (!isUnstable[idx]) {
        haveD = true
        const o = idx * 4
        dr = pixels[o]
        dg = pixels[o + 1]
        db = pixels[o + 2]
        ddist = 0
      } else if (haveD) {
        ddist++
        const w = 1 / ddist
        vR[li] += dr * w
        vG[li] += dg * w
        vB[li] += db * w
        vW[li] += w
      }
    }
  }

  for (const idx of unstable) {
    const x = idx % width
    const y = (idx / width) | 0
    if (x < minX || x > maxX || y < minY || y > maxY) continue
    const li = (y - minY) * boxW + (x - minX)
    const totalW = hW[li] + vW[li]
    if (totalW <= 0) continue
    const o = idx * 4
    pixels[o] = clamp255((hR[li] + vR[li]) / totalW)
    pixels[o + 1] = clamp255((hG[li] + vG[li]) / totalW)
    pixels[o + 2] = clamp255((hB[li] + vB[li]) / totalW)
  }
}
