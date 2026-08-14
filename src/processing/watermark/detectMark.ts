export interface PixelBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const luma = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b

/**
 * Detects the actual watermark pixels inside the region box and returns a mask
 * covering only those (dilated a little), instead of the whole rectangle.
 *
 * The Gemini/Veo watermark is a bright, semi-transparent mark (the ✦ sparkle /
 * diamond) laid over the frame. Within the region we estimate the background
 * luminance (median) and flag pixels significantly brighter than it as
 * watermark, then dilate to catch the soft glow. Reconstructing only those
 * pixels leaves the surrounding detail (e.g. railings, texture between two
 * sparkles) untouched — far more accurate than filling the entire box.
 *
 * Falls back to the supplied geometric mask when the region has too little
 * contrast to isolate a mark (nearly uniform, or almost entirely bright), so a
 * poorly-positioned or low-contrast box degrades gracefully rather than
 * over- or under-removing.
 */
export function detectMarkMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bounds: PixelBounds,
  geomMask: Float32Array,
  peakAlpha: number,
  dilateRadius = 2,
): Float32Array {
  const { minX, minY, maxX, maxY } = bounds
  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  const eps = 1 / 255

  const lums: number[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = y * width + x
      if (geomMask[i] <= eps) continue
      const o = i * 4
      lums.push(luma(pixels[o], pixels[o + 1], pixels[o + 2]))
    }
  }
  const regionCount = lums.length
  if (regionCount < 32) return geomMask

  const sorted = Float64Array.from(lums).sort()
  const quantile = (p: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))]
  const bg = quantile(0.5)
  const top = quantile(0.97)
  const threshold = bg + Math.max(24, 0.3 * (top - bg))

  const det = new Uint8Array(bw * bh)
  let count = 0
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = y * width + x
      if (geomMask[i] <= eps) continue
      const o = i * 4
      if (luma(pixels[o], pixels[o + 1], pixels[o + 2]) > threshold) {
        det[(y - minY) * bw + (x - minX)] = 1
        count++
      }
    }
  }

  const coverage = count / regionCount
  // Too little contrast to isolate a mark, or the box is almost all "bright":
  // trust the geometric box instead of masking essentially nothing / everything.
  if (coverage < 0.02 || coverage > 0.8) return geomMask

  // Dilate to capture the mark's soft anti-aliased glow.
  const r = Math.max(1, dilateRadius | 0)
  const out = new Float32Array(width * height)
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (!det[y * bw + x]) continue
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= bh) continue
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= bw) continue
          const gi = (yy + minY) * width + (xx + minX)
          if (geomMask[gi] > eps) out[gi] = peakAlpha
        }
      }
    }
  }
  return out
}
