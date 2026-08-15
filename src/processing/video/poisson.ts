export interface PixelBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Gradient-domain (Poisson) blend of a retrieved fill into a frame, over the
 * covered hole pixels, in place.
 *
 * Pixels borrowed from a distant frame carry that frame's exposure/white
 * balance, so a correctly-shaped patch lands at slightly the wrong brightness.
 * Poisson blending solves for values that match the *gradients* of the borrowed
 * fill while matching the *values* of the hole boundary, erasing the seam
 * without smoothing away detail (unlike a plain feather or a global gain/offset,
 * which fails when the lighting gradient differs across the hole).
 *
 * `covered[i] === 1` marks hole pixels that received a retrieved value in
 * `fill`; boundary pixels (covered 0) act as Dirichlet constraints using the
 * frame's own values. Jacobi iteration — enough for a small region.
 */
export function poissonBlend(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  fill: Float32Array, // per-channel retrieved values, length width*height*3
  covered: Uint8Array,
  bounds: PixelBounds,
  iterations = 60,
): void {
  const { minX, minY, maxX, maxY } = bounds
  const holes: number[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (covered[y * width + x]) holes.push(y * width + x)
    }
  }
  if (holes.length === 0) return

  // u holds the current solution per channel; initialise from the retrieved fill.
  const u = new Float32Array(holes.length * 3)
  for (let h = 0; h < holes.length; h++) {
    const g = holes[h] * 3
    u[h * 3] = fill[g]
    u[h * 3 + 1] = fill[g + 1]
    u[h * 3 + 2] = fill[g + 2]
  }
  const slot = new Int32Array(width * height).fill(-1)
  for (let h = 0; h < holes.length; h++) slot[holes[h]] = h

  const neighborVal = (
    idx: number,
    ch: number,
    self: number,
  ): { boundary: number; grad: number; isCovered: boolean } => {
    const s = slot[idx]
    const g = fill[idx * 3 + ch]
    if (s >= 0) {
      // covered neighbor: contributes current u and a gradient term (self - g_neighbor)
      return { boundary: u[s * 3 + ch], grad: self - g, isCovered: true }
    }
    // boundary neighbor: Dirichlet with the frame's own value, no gradient term
    return { boundary: pixels[idx * 4 + ch], grad: 0, isCovered: false }
  }

  for (let it = 0; it < iterations; it++) {
    for (let h = 0; h < holes.length; h++) {
      const idx = holes[h]
      const x = idx % width
      const y = (idx / width) | 0
      for (let ch = 0; ch < 3; ch++) {
        const gSelf = fill[idx * 3 + ch]
        let sum = 0
        let count = 0
        let gradSum = 0
        if (x > 0) {
          const n = neighborVal(idx - 1, ch, gSelf)
          sum += n.boundary
          gradSum += n.grad
          count++
        }
        if (x < width - 1) {
          const n = neighborVal(idx + 1, ch, gSelf)
          sum += n.boundary
          gradSum += n.grad
          count++
        }
        if (y > 0) {
          const n = neighborVal(idx - width, ch, gSelf)
          sum += n.boundary
          gradSum += n.grad
          count++
        }
        if (y < height - 1) {
          const n = neighborVal(idx + width, ch, gSelf)
          sum += n.boundary
          gradSum += n.grad
          count++
        }
        if (count > 0) u[h * 3 + ch] = (sum + gradSum) / count
      }
    }
  }

  for (let h = 0; h < holes.length; h++) {
    const o = holes[h] * 4
    pixels[o] = Math.max(0, Math.min(255, u[h * 3]))
    pixels[o + 1] = Math.max(0, Math.min(255, u[h * 3 + 1]))
    pixels[o + 2] = Math.max(0, Math.min(255, u[h * 3 + 2]))
  }
}
