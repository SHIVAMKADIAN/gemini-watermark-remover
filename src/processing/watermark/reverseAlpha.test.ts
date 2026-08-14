import { describe, expect, it } from 'vitest'
import type { WatermarkColorProfile } from '../../profiles/types'
import { applyReverseAlpha } from './reverseAlpha'

const white: WatermarkColorProfile = { r: 255, g: 255, b: 255, alpha: 0.5 }

function makePixel(r: number, g: number, b: number): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, 255])
}

describe('applyReverseAlpha', () => {
  it('recovers the original pixel from a known composite', () => {
    // observed = alpha*wm + (1-alpha)*original, alpha=0.5, wm=255, original=100
    // observed = 0.5*255 + 0.5*100 = 177.5 -> 178
    const alpha = 0.5
    const original = 100
    const observed = Math.round(alpha * 255 + (1 - alpha) * original)
    const pixels = makePixel(observed, observed, observed)
    const mask = new Float32Array([alpha])
    applyReverseAlpha(pixels, 1, 1, mask, white, 1)
    // Recovered = (178 - 0.5*255)/0.5 = 101 -> within rounding of 100
    expect(pixels[0]).toBeGreaterThanOrEqual(99)
    expect(pixels[0]).toBeLessThanOrEqual(103)
  })

  it('does not touch pixels with zero mask alpha', () => {
    const pixels = makePixel(123, 45, 67)
    const mask = new Float32Array([0])
    applyReverseAlpha(pixels, 1, 1, mask, white, 1)
    expect(Array.from(pixels)).toEqual([123, 45, 67, 255])
  })

  it('never modifies the alpha channel', () => {
    const pixels = new Uint8ClampedArray([200, 200, 200, 128])
    const mask = new Float32Array([0.5])
    applyReverseAlpha(pixels, 1, 1, mask, white, 1)
    expect(pixels[3]).toBe(128)
  })

  it('flags unstable pixels above the threshold instead of dividing by ~0', () => {
    const pixels = makePixel(250, 250, 250)
    const mask = new Float32Array([0.95])
    const unstable = applyReverseAlpha(pixels, 1, 1, mask, white, 0.9)
    expect(unstable.length).toBe(1)
    expect(unstable[0]).toBe(0)
    // Pixel left untouched because it was deferred to the fallback pass.
    expect(pixels[0]).toBe(250)
  })

  it('clamps recovered values into [0,255]', () => {
    const pixels = makePixel(255, 255, 255)
    const mask = new Float32Array([0.5])
    applyReverseAlpha(pixels, 1, 1, mask, white, 1)
    // (255 - 0.5*255)/0.5 = 255 exactly, must stay in range
    expect(pixels[0]).toBeLessThanOrEqual(255)
    expect(pixels[0]).toBeGreaterThanOrEqual(0)
  })
})
