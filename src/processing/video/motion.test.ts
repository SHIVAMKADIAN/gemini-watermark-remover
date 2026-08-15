import { describe, expect, it } from 'vitest'
import { cumulativeTranslation, estimateTranslation } from './motion'

const W = 64
const H = 48

// Non-periodic textured background so SSD has a unique minimum.
function bg(gx: number, gy: number): number {
  const v = 0.4 * gx + 50 * Math.sin(gx * 0.3) + 30 * Math.cos(gy * 0.5) + 60 * Math.sin((gx + gy) * 0.11)
  return Math.max(0, Math.min(255, 128 + v))
}

function cropFrame(offX: number, offY: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = bg(x + offX, y + offY)
      const o = (y * W + x) * 4
      px[o] = px[o + 1] = px[o + 2] = v
      px[o + 3] = 255
    }
  }
  return px
}

describe('estimateTranslation', () => {
  it('recovers a horizontal pan', () => {
    const a = cropFrame(0, 0)
    const b = cropFrame(5, 0) // b is the background shifted so a(p)=b(p-5)
    const d = estimateTranslation(a, b, W, H, null, 24)
    // b(p + d) ≈ a(p) => d ≈ (-5, 0)
    expect(d.dx).toBe(-5)
    expect(d.dy).toBe(0)
  })

  it('recovers a diagonal pan', () => {
    const a = cropFrame(0, 0)
    const b = cropFrame(4, 3)
    const d = estimateTranslation(a, b, W, H, null, 24)
    expect(d.dx).toBe(-4)
    expect(d.dy).toBe(-3)
  })

  it('returns ~zero for a static camera', () => {
    const a = cropFrame(10, 6)
    const b = cropFrame(10, 6)
    const d = estimateTranslation(a, b, W, H, null, 24)
    expect(Math.abs(d.dx)).toBeLessThanOrEqual(1)
    expect(Math.abs(d.dy)).toBeLessThanOrEqual(1)
  })
})

describe('cumulativeTranslation', () => {
  const pairs = [
    { dx: 2, dy: 1 },
    { dx: 3, dy: -1 },
    { dx: -1, dy: 2 },
  ]
  it('accumulates forward', () => {
    expect(cumulativeTranslation(pairs, 0, 3)).toEqual({ dx: 4, dy: 2 })
    expect(cumulativeTranslation(pairs, 0, 2)).toEqual({ dx: 5, dy: 0 })
  })
  it('accumulates backward as the negation', () => {
    expect(cumulativeTranslation(pairs, 3, 0)).toEqual({ dx: -4, dy: -2 })
    expect(cumulativeTranslation(pairs, 2, 0)).toEqual({ dx: -5, dy: 0 })
  })
  it('is zero for from==to', () => {
    expect(cumulativeTranslation(pairs, 1, 1)).toEqual({ dx: 0, dy: 0 })
  })
})
