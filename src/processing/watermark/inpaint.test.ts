import { describe, expect, it } from 'vitest'
import type { ResolvedGeometry } from '../../profiles/registry'
import type { CleanupParams, WatermarkColorProfile } from '../../profiles/types'
import { restoreWatermarkRegion } from './restore'
import { inpaintRegion } from './inpaint'
import { maskBounds } from './mask'
import { generateWatermarkMask } from './mask'

const white: WatermarkColorProfile = { r: 255, g: 255, b: 255, alpha: 0.5 }

const inpaintParams: CleanupParams = {
  method: 'inpaint',
  detectWithinRegion: false,
  patchRadius: 4,
  searchRadius: 48,
  exemplarStride: 2,
  inpaintIterations: 60,
  alphaScale: 1,
  useFallbackReconstruction: true,
  fallbackAlphaThreshold: 0.82,
}

/** Dark background with a bright watermark badge composited into the region. */
function darkImageWithBadge(w: number, h: number, geo: ResolvedGeometry): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4)
  const BG = 50 // dark grey wall
  for (let i = 0; i < px.length; i += 4) {
    px[i] = BG
    px[i + 1] = BG
    px[i + 2] = BG
    px[i + 3] = 255
  }
  // Simulate a bright semi-opaque badge inside the region.
  for (let y = Math.floor(geo.y); y < geo.y + geo.height; y++) {
    for (let x = Math.floor(geo.x); x < geo.x + geo.width; x++) {
      const o = (y * w + x) * 4
      px[o] = 200
      px[o + 1] = 200
      px[o + 2] = 200
    }
  }
  return px
}

describe('inpaintRegion (content-aware fill)', () => {
  const w = 120
  const h = 80
  const geo: ResolvedGeometry = { x: 90, y: 58, width: 22, height: 16, cornerRadius: 4, feather: 3 }

  it('reconstructs a bright badge on a dark background to the background color — never black', () => {
    const px = darkImageWithBadge(w, h, geo)
    restoreWatermarkRegion(px, w, h, geo, white, inpaintParams)

    const cx = Math.round(geo.x + geo.width / 2)
    const cy = Math.round(geo.y + geo.height / 2)
    const centerVal = px[(cy * w + cx) * 4]

    // The whole point: the badge is gone and the area matches the ~50 wall,
    // NOT clamped to 0 (the black-box bug) and NOT left at the 200 badge value.
    expect(centerVal).toBeGreaterThan(20)
    expect(centerVal).toBeLessThan(90)
  })

  it('never drives any reconstructed pixel to pure black', () => {
    const px = darkImageWithBadge(w, h, geo)
    restoreWatermarkRegion(px, w, h, geo, white, inpaintParams)
    const bounds = maskBounds(w, h, geo)
    let blacks = 0
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const o = (y * w + x) * 4
        if (px[o] === 0 && px[o + 1] === 0 && px[o + 2] === 0) blacks++
      }
    }
    expect(blacks).toBe(0)
  })

  it('leaves pixels outside the mask untouched', () => {
    const px = darkImageWithBadge(w, h, geo)
    const before = px.slice()
    restoreWatermarkRegion(px, w, h, geo, white, inpaintParams)
    // Far corner well outside the region.
    const idx = (5 * w + 5) * 4
    expect(px[idx]).toBe(before[idx])
  })

  it('does not modify the alpha channel', () => {
    const px = darkImageWithBadge(w, h, geo)
    restoreWatermarkRegion(px, w, h, geo, white, inpaintParams)
    for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255)
  })

  it('returns 0 and no-ops when the mask is empty', () => {
    const px = darkImageWithBadge(w, h, geo)
    const emptyMask = new Float32Array(w * h) // all zero
    const before = px.slice()
    const count = inpaintRegion(px, w, h, emptyMask, maskBounds(w, h, geo), 0.5, 60)
    expect(count).toBe(0)
    expect(Array.from(px)).toEqual(Array.from(before))
  })

  it('fills toward a uniform surrounding color exactly', () => {
    // Uniform BG everywhere (no badge): inpaint must reproduce the BG value.
    const px = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < px.length; i += 4) {
      px[i] = px[i + 1] = px[i + 2] = 77
      px[i + 3] = 255
    }
    const mask = generateWatermarkMask(w, h, geo, 0.5)
    inpaintRegion(px, w, h, mask, maskBounds(w, h, geo), 0.5, 80)
    const cx = Math.round(geo.x + geo.width / 2)
    const cy = Math.round(geo.y + geo.height / 2)
    expect(px[(cy * w + cx) * 4]).toBe(77)
  })
})
