import { describe, expect, it } from 'vitest'
import { generateWatermarkMask } from '../watermark/mask'
import { maskBounds } from '../watermark/mask'
import type { ResolvedGeometry } from '../../profiles/registry'
import { temporalFillWindow, type TemporalWindow } from './temporalFill'

const W = 80
const H = 56

// Smooth, non-periodic background so retrieval + Poisson land on the true value.
function bg(gx: number, gy: number): number {
  const v = 0.3 * gx + 40 * Math.sin(gx * 0.18) + 25 * Math.cos(gy * 0.22)
  return Math.max(0, Math.min(255, 128 + v))
}

const geo: ResolvedGeometry = { x: 34, y: 22, width: 12, height: 10, cornerRadius: 2, feather: 1 }
const bounds = maskBounds(W, H, geo)
const mask = generateWatermarkMask(W, H, geo, 0.9)

/** Build a panning window: each frame crops the background at t*pan, with the
 *  static mask region corrupted to a bright block (the "watermark"). */
function buildWindow(pan: number, count: number): { win: TemporalWindow; truth: (t: number, x: number, y: number) => number } {
  const frames: Uint8ClampedArray[] = []
  for (let t = 0; t < count; t++) {
    const px = new Uint8ClampedArray(W * H * 4)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4
        const masked = mask[y * W + x] > 1 / 255
        const v = masked ? 255 : bg(x + t * pan, y) // corrupt masked pixels
        px[o] = px[o + 1] = px[o + 2] = v
        px[o + 3] = 255
      }
    }
    frames.push(px)
  }
  return { win: { frames, width: W, height: H, mask, bounds }, truth: (t, x, y) => bg(x + t * pan, y) }
}

describe('temporalFillWindow', () => {
  it('reconstructs the true background revealed by the pan (not a spatial guess)', () => {
    const { win, truth } = buildWindow(3, 11)
    const stats = temporalFillWindow(win, { poissonIterations: 80 })

    // A middle frame's mask centre should be restored close to the real background.
    const t = 5
    const cx = Math.round(geo.x + geo.width / 2)
    const cy = Math.round(geo.y + geo.height / 2)
    const got = win.frames[t][(cy * W + cx) * 4]
    const want = truth(t, cx, cy)
    expect(Math.abs(got - want)).toBeLessThan(14)
    // And it must no longer be the 255 corruption.
    expect(got).toBeLessThan(230)

    // Most of the hole was filled temporally, not spatially, in a middle frame.
    expect(stats[t].temporalPixels).toBeGreaterThan(stats[t].holePixels * 0.5)
  })

  it('leaves pixels outside the mask untouched', () => {
    const { win } = buildWindow(3, 11)
    const before = win.frames[5].slice()
    temporalFillWindow(win, { poissonIterations: 20 })
    // Corner well outside the mask box.
    const idx = (3 * W + 3) * 4
    expect(win.frames[5][idx]).toBe(before[idx])
  })

  it('never leaves raw watermark (255 block) behind', () => {
    const { win } = buildWindow(3, 11)
    temporalFillWindow(win, { poissonIterations: 20 })
    for (let t = 0; t < win.frames.length; t++) {
      let raw = 0
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] > 0.5 && win.frames[t][i * 4] === 255 && win.frames[t][i * 4 + 1] === 255) raw++
      }
      expect(raw).toBe(0)
    }
  })

  it('falls back to spatial fill when nothing is ever revealed (static occluder)', () => {
    // pan = 0: the background behind the mask is never uncovered.
    const { win } = buildWindow(0, 9)
    const stats = temporalFillWindow(win, { poissonIterations: 10 })
    const t = 4
    // No temporal coverage, but the hole is still filled (spatial residual).
    expect(stats[t].temporalPixels).toBe(0)
    expect(stats[t].residualPixels).toBe(stats[t].holePixels)
    const cx = Math.round(geo.x + geo.width / 2)
    const cy = Math.round(geo.y + geo.height / 2)
    expect(win.frames[t][(cy * W + cx) * 4]).toBeLessThan(230) // no raw 255 left
  })

  it('preserves the alpha channel', () => {
    const { win } = buildWindow(3, 9)
    temporalFillWindow(win, { poissonIterations: 10 })
    for (let i = 3; i < win.frames[4].length; i += 4) expect(win.frames[4][i]).toBe(255)
  })
})
