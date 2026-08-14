import { describe, expect, it } from 'vitest'
import { detectMarkMask } from './detectMark'

const W = 60
const H = 60
const bounds = { minX: 10, minY: 10, maxX: 49, maxY: 49 }

function geomBox(): Float32Array {
  // Uniform 0.5 alpha over the whole bounds box (the geometric region).
  const m = new Float32Array(W * H)
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) m[y * W + x] = 0.5
  }
  return m
}

/** Dark region with a small bright sparkle patch inside it. */
function frameWithSparkle(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < px.length; i += 4) {
    px[i] = px[i + 1] = px[i + 2] = 40
    px[i + 3] = 255
  }
  for (let y = 28; y < 34; y++) {
    for (let x = 28; x < 34; x++) {
      const o = (y * W + x) * 4
      px[o] = px[o + 1] = px[o + 2] = 230 // bright sparkle
    }
  }
  return px
}

describe('detectMarkMask', () => {
  it('masks the bright sparkle and NOT the dark background inside the region', () => {
    const px = frameWithSparkle()
    const mask = detectMarkMask(px, W, H, bounds, geomBox(), 0.5)

    // A sparkle pixel is masked...
    expect(mask[31 * W + 31]).toBeGreaterThan(0)
    // ...a dark background pixel inside the region is not.
    expect(mask[12 * W + 12]).toBe(0)
  })

  it('masks far fewer pixels than the full geometric box', () => {
    const px = frameWithSparkle()
    const geom = geomBox()
    const mask = detectMarkMask(px, W, H, bounds, geom, 0.5)
    let detected = 0
    let boxed = 0
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) detected++
      if (geom[i] > 0) boxed++
    }
    expect(detected).toBeGreaterThan(0)
    expect(detected).toBeLessThan(boxed * 0.4)
  })

  it('falls back to the geometric mask on a nearly-uniform region (no mark to find)', () => {
    const px = new Uint8ClampedArray(W * H * 4)
    for (let i = 0; i < px.length; i += 4) {
      px[i] = px[i + 1] = px[i + 2] = 120
      px[i + 3] = 255
    }
    const geom = geomBox()
    const mask = detectMarkMask(px, W, H, bounds, geom, 0.5)
    expect(mask).toBe(geom) // identity: returned the geometric mask unchanged
  })

  it('dilates around the sparkle to catch its glow', () => {
    const px = frameWithSparkle()
    const mask = detectMarkMask(px, W, H, bounds, geomBox(), 0.5, 2)
    // A pixel just outside the 28..33 sparkle core (dilated) should be masked.
    expect(mask[27 * W + 31]).toBeGreaterThan(0)
  })
})
