import { describe, expect, it } from 'vitest'
import type { ResolvedGeometry } from '../../profiles/registry'
import { generateWatermarkMask, maskBounds } from './mask'

const geo: ResolvedGeometry = {
  x: 60,
  y: 60,
  width: 30,
  height: 20,
  cornerRadius: 5,
  feather: 3,
}

describe('generateWatermarkMask', () => {
  it('produces a mask sized to the media', () => {
    const mask = generateWatermarkMask(100, 100, geo, 0.5)
    expect(mask.length).toBe(100 * 100)
  })

  it('leaves pixels far outside the region at exactly 0', () => {
    const mask = generateWatermarkMask(100, 100, geo, 0.5)
    expect(mask[0]).toBe(0) // top-left corner
    expect(mask[10 * 100 + 10]).toBe(0)
  })

  it('has non-zero alpha near the center of the region', () => {
    const mask = generateWatermarkMask(100, 100, geo, 0.5)
    const cx = Math.round(geo.x + geo.width / 2)
    const cy = Math.round(geo.y + geo.height / 2)
    expect(mask[cy * 100 + cx]).toBeGreaterThan(0.4)
  })

  it('never exceeds the peak alpha', () => {
    const peak = 0.5
    const mask = generateWatermarkMask(100, 100, geo, peak)
    let max = 0
    for (const v of mask) max = Math.max(max, v)
    expect(max).toBeLessThanOrEqual(peak + 1e-6)
  })

  it('clamps peak alpha below 1 to keep inversion stable', () => {
    const mask = generateWatermarkMask(100, 100, geo, 1)
    let max = 0
    for (const v of mask) max = Math.max(max, v)
    expect(max).toBeLessThan(1)
  })

  it('computes bounds that contain the geometry', () => {
    const bounds = maskBounds(100, 100, geo)
    expect(bounds.minX).toBeLessThanOrEqual(geo.x)
    expect(bounds.minY).toBeLessThanOrEqual(geo.y)
    expect(bounds.maxX).toBeGreaterThanOrEqual(geo.x + geo.width)
    expect(bounds.maxY).toBeGreaterThanOrEqual(geo.y + geo.height)
  })
})
