/**
 * Global translational motion estimation between two frames, using only pixels
 * outside the removal mask. This is the browser-feasible stand-in for the dense
 * RAFT flow the vidfill spec assumes: no learned model, no GPU — just a
 * coarse-to-fine integer search for the camera pan/translation that best
 * explains the unmasked background. It nails the common cases (static camera →
 * ~0; slow pan → the pan vector) that make temporal retrieval possible.
 */
export interface Translation {
  dx: number
  dy: number
}

function luma(pixels: Uint8ClampedArray, i: number): number {
  const o = i * 4
  return 0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2]
}

/** Downsample a frame's luminance by an integer factor (box average). */
function downsampleLuma(pixels: Uint8ClampedArray, w: number, h: number, factor: number): { data: Float32Array; w: number; h: number } {
  const dw = Math.max(1, Math.floor(w / factor))
  const dh = Math.max(1, Math.floor(h / factor))
  const data = new Float32Array(dw * dh)
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let sum = 0
      let n = 0
      for (let sy = 0; sy < factor; sy++) {
        const yy = y * factor + sy
        if (yy >= h) break
        for (let sx = 0; sx < factor; sx++) {
          const xx = x * factor + sx
          if (xx >= w) break
          sum += luma(pixels, yy * w + xx)
          n++
        }
      }
      data[y * dw + x] = n > 0 ? sum / n : 0
    }
  }
  return { data, w: dw, h: dh }
}

/** Downsample a boolean "usable" mask (true where a pixel may be used). */
function downsampleUsable(usable: Uint8Array | null, w: number, h: number, factor: number): Uint8Array | null {
  if (!usable) return null
  const dw = Math.max(1, Math.floor(w / factor))
  const dh = Math.max(1, Math.floor(h / factor))
  const out = new Uint8Array(dw * dh)
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      // Usable only if the whole block is usable (avoids leaking masked pixels).
      let ok = 1
      for (let sy = 0; sy < factor && ok; sy++) {
        const yy = y * factor + sy
        if (yy >= h) break
        for (let sx = 0; sx < factor; sx++) {
          const xx = x * factor + sx
          if (xx >= w) break
          if (!usable[yy * w + xx]) {
            ok = 0
            break
          }
        }
      }
      out[y * dw + x] = ok
    }
  }
  return out
}

function ssdAt(
  a: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
  usable: Uint8Array | null,
  dx: number,
  dy: number,
  step: number,
): { cost: number; count: number } {
  let cost = 0
  let count = 0
  for (let y = 0; y < h; y += step) {
    const by = y + dy
    if (by < 0 || by >= h) continue
    for (let x = 0; x < w; x += step) {
      const bx = x + dx
      if (bx < 0 || bx >= w) continue
      const ai = y * w + x
      if (usable && !usable[ai]) continue
      const bi = by * w + bx
      if (usable && !usable[bi]) continue
      const d = a[ai] - b[bi]
      cost += d * d
      count++
    }
  }
  return { cost, count }
}

function searchLevel(
  a: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
  usable: Uint8Array | null,
  center: Translation,
  radius: number,
  step: number,
): Translation {
  let best = center
  let bestAvg = Infinity
  for (let dy = center.dy - radius; dy <= center.dy + radius; dy++) {
    for (let dx = center.dx - radius; dx <= center.dx + radius; dx++) {
      const { cost, count } = ssdAt(a, b, w, h, usable, dx, dy, step)
      if (count < 32) continue
      const avg = cost / count
      if (avg < bestAvg) {
        bestAvg = avg
        best = { dx, dy }
      }
    }
  }
  return best
}

/**
 * Estimates the integer translation `d` such that `b(p + d) ≈ a(p)` on unmasked
 * pixels — i.e. how the background in frame `b` is shifted relative to frame
 * `a`. `usable` is true for pixels that are safe to match on (outside the mask,
 * in both frames' coordinates); pass null to use all pixels.
 */
export function estimateTranslation(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  width: number,
  height: number,
  usable: Uint8Array | null,
  maxShift = 48,
): Translation {
  // Two-level pyramid: coarse search at 1/4, refine at full resolution.
  const factor = 4
  const ca = downsampleLuma(a, width, height, factor)
  const cb = downsampleLuma(b, width, height, factor)
  const cu = downsampleUsable(usable, width, height, factor)
  const coarseRadius = Math.max(2, Math.round(maxShift / factor))
  const coarse = searchLevel(ca.data, cb.data, ca.w, ca.h, cu, { dx: 0, dy: 0 }, coarseRadius, 1)

  const fa = downsampleLuma(a, width, height, 1).data
  const fb = downsampleLuma(b, width, height, 1).data
  const seed: Translation = { dx: coarse.dx * factor, dy: coarse.dy * factor }
  // Refine within ±factor around the upscaled coarse estimate, sampling sparsely.
  return searchLevel(fa, fb, width, height, usable, seed, factor, 2)
}

/**
 * Given per-adjacent-pair translations `pair[i]` mapping frame i+1 onto frame i
 * (b=i+1, a=i), returns the cumulative translation mapping frame `to` onto
 * frame `from` (so a point p in `from` is at p + offset in `to`).
 */
export function cumulativeTranslation(pairs: Translation[], from: number, to: number): Translation {
  let dx = 0
  let dy = 0
  if (to > from) {
    for (let i = from; i < to; i++) {
      dx += pairs[i].dx
      dy += pairs[i].dy
    }
  } else {
    for (let i = from - 1; i >= to; i--) {
      dx -= pairs[i].dx
      dy -= pairs[i].dy
    }
  }
  return { dx, dy }
}
