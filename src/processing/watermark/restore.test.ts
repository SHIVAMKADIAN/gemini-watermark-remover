import { describe, expect, it } from 'vitest'
import type { ResolvedGeometry } from '../../profiles/registry'
import type { CleanupParams, WatermarkColorProfile } from '../../profiles/types'
import { restoreWatermarkRegion } from './restore'

const white: WatermarkColorProfile = { r: 255, g: 255, b: 255, alpha: 0.5 }

const softParams: CleanupParams = {
  method: 'reverse-alpha',
  detectWithinRegion: false,
  patchRadius: 4,
  searchRadius: 48,
  exemplarStride: 2,
  inpaintIterations: 0,
  alphaScale: 1,
  useFallbackReconstruction: false,
  fallbackAlphaThreshold: 0.95,
}

function solidImage(width: number, height: number, value: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < px.length; i += 4) {
    px[i] = value
    px[i + 1] = value
    px[i + 2] = value
    px[i + 3] = 255
  }
  return px
}

describe('restoreWatermarkRegion', () => {
  it('modifies only pixels inside the mask region', () => {
    const w = 60
    const h = 60
    const pixels = solidImage(w, h, 178) // composite of 0.5*255 + 0.5*100
    const geo: ResolvedGeometry = { x: 40, y: 40, width: 15, height: 12, cornerRadius: 3, feather: 2 }
    const before = pixels.slice()
    restoreWatermarkRegion(pixels, w, h, geo, white, softParams)

    // A corner pixel far from the region must be untouched.
    const cornerIdx = 0
    expect(pixels[cornerIdx]).toBe(before[cornerIdx])

    // A pixel in the center of the region should be changed toward the recovered value.
    const cx = 47
    const cy = 46
    const idx = (cy * w + cx) * 4
    expect(pixels[idx]).not.toBe(before[idx])
    expect(pixels[idx]).toBeLessThan(before[idx]) // white watermark removed -> darker toward original
  })

  it('reports the number of modified pixels and it is bounded by the region', () => {
    const w = 60
    const h = 60
    const pixels = solidImage(w, h, 178)
    const geo: ResolvedGeometry = { x: 40, y: 40, width: 15, height: 12, cornerRadius: 3, feather: 2 }
    const result = restoreWatermarkRegion(pixels, w, h, geo, white, softParams)
    expect(result.pixelsModified).toBeGreaterThan(0)
    expect(result.pixelsModified).toBeLessThan(w * h)
  })

  it('does not alter the alpha channel of any pixel', () => {
    const w = 40
    const h = 40
    const pixels = solidImage(w, h, 178)
    const geo: ResolvedGeometry = { x: 20, y: 20, width: 12, height: 10, cornerRadius: 2, feather: 2 }
    restoreWatermarkRegion(pixels, w, h, geo, white, softParams)
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255)
    }
  })
})
