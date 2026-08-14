import { describe, expect, it } from 'vitest'
import { fallbackEdgeDirectedFill } from './fallbackFill'

describe('fallbackEdgeDirectedFill', () => {
  it('fills an unstable pixel by interpolating from real neighbors', () => {
    // 3x1 row: left=100, middle=unstable(0), right=200. Expect middle ~150.
    const pixels = new Uint8ClampedArray([100, 100, 100, 255, 0, 0, 0, 255, 200, 200, 200, 255])
    const unstable = Uint32Array.from([1])
    fallbackEdgeDirectedFill(pixels, 3, 1, unstable, { minX: 0, minY: 0, maxX: 2, maxY: 0 })
    expect(pixels[4]).toBeGreaterThanOrEqual(140)
    expect(pixels[4]).toBeLessThanOrEqual(160)
  })

  it('does nothing when there are no unstable pixels', () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 255])
    fallbackEdgeDirectedFill(pixels, 1, 1, new Uint32Array(), { minX: 0, minY: 0, maxX: 0, maxY: 0 })
    expect(Array.from(pixels)).toEqual([10, 20, 30, 255])
  })

  it('leaves stable neighbors unchanged', () => {
    const pixels = new Uint8ClampedArray([100, 100, 100, 255, 0, 0, 0, 255, 200, 200, 200, 255])
    const unstable = Uint32Array.from([1])
    fallbackEdgeDirectedFill(pixels, 3, 1, unstable, { minX: 0, minY: 0, maxX: 2, maxY: 0 })
    expect(pixels[0]).toBe(100)
    expect(pixels[8]).toBe(200)
  })

  it('interpolates from vertical neighbors too', () => {
    // 1x3 column: top=60, middle=unstable, bottom=180 -> ~120
    const pixels = new Uint8ClampedArray([60, 60, 60, 255, 0, 0, 0, 255, 180, 180, 180, 255])
    const unstable = Uint32Array.from([1])
    fallbackEdgeDirectedFill(pixels, 1, 3, unstable, { minX: 0, minY: 0, maxX: 0, maxY: 2 })
    expect(pixels[4]).toBeGreaterThanOrEqual(110)
    expect(pixels[4]).toBeLessThanOrEqual(130)
  })
})
