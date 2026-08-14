import { describe, expect, it } from 'vitest'
import type { ResolvedGeometry } from '../../profiles/registry'
import type { CleanupParams, WatermarkColorProfile } from '../../profiles/types'
import { generateWatermarkMask, maskBounds } from './mask'
import { exemplarInpaint } from './exemplarInpaint'
import { restoreWatermarkRegion } from './restore'

const white: WatermarkColorProfile = { r: 255, g: 255, b: 255, alpha: 0.5 }

const exemplarParams: CleanupParams = {
  method: 'exemplar',
  patchRadius: 3,
  searchRadius: 40,
  exemplarStride: 1,
  inpaintIterations: 0,
  alphaScale: 1,
  useFallbackReconstruction: true,
  fallbackAlphaThreshold: 0.82,
}

/** Sharp vertical stripes (period 4): a texture a blur would destroy. */
function stripedImage(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x % 4 < 2 ? 30 : 220
      const o = (y * w + x) * 4
      px[o] = v
      px[o + 1] = v
      px[o + 2] = v
      px[o + 3] = 255
    }
  }
  return px
}

function overwriteRegionWithBadge(px: Uint8ClampedArray, w: number, geo: ResolvedGeometry): void {
  for (let y = Math.floor(geo.y); y < geo.y + geo.height; y++) {
    for (let x = Math.floor(geo.x); x < geo.x + geo.width; x++) {
      const o = (y * w + x) * 4
      px[o] = px[o + 1] = px[o + 2] = 255 // solid bright badge
    }
  }
}

describe('exemplarInpaint (texture-preserving)', () => {
  const w = 100
  const h = 60
  const geo: ResolvedGeometry = { x: 44, y: 26, width: 16, height: 12, cornerRadius: 3, feather: 2 }

  it('reconstructs a striped texture without blurring it to a mid-grey', () => {
    const px = stripedImage(w, h)
    overwriteRegionWithBadge(px, w, geo)
    restoreWatermarkRegion(px, w, h, geo, white, exemplarParams)

    // Every reconstructed pixel should be close to one of the two stripe values
    // (30 or 220), NOT a blurred mid-grey (~125). A diffusion fill would fail this.
    const bounds = maskBounds(w, h, geo)
    let midGrey = 0
    let total = 0
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const o = (y * w + x) * 4
        const v = px[o]
        // count pixels that are neither near-dark nor near-bright (i.e. blurred)
        const nearDark = Math.abs(v - 30) < 45
        const nearBright = Math.abs(v - 220) < 45
        if (!nearDark && !nearBright) midGrey++
        total++
      }
    }
    // Overwhelmingly bimodal (texture preserved), only a few transition pixels.
    expect(midGrey / total).toBeLessThan(0.2)
  })

  it('removes the bright badge (no near-white block remains in the region)', () => {
    const px = stripedImage(w, h)
    overwriteRegionWithBadge(px, w, geo)
    restoreWatermarkRegion(px, w, h, geo, white, exemplarParams)
    // Center of the region should no longer be the 255 badge.
    const cx = Math.round(geo.x + geo.width / 2)
    const cy = Math.round(geo.y + geo.height / 2)
    expect(px[(cy * w + cx) * 4]).toBeLessThan(240)
  })

  it('leaves pixels outside the mask untouched', () => {
    const px = stripedImage(w, h)
    overwriteRegionWithBadge(px, w, geo)
    const before = px.slice()
    restoreWatermarkRegion(px, w, h, geo, white, exemplarParams)
    const idx = (3 * w + 3) * 4
    expect(px[idx]).toBe(before[idx])
  })

  it('never modifies the alpha channel', () => {
    const px = stripedImage(w, h)
    overwriteRegionWithBadge(px, w, geo)
    restoreWatermarkRegion(px, w, h, geo, white, exemplarParams)
    for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255)
  })

  it('no-ops on an empty mask', () => {
    const px = stripedImage(w, h)
    const empty = new Float32Array(w * h)
    const before = px.slice()
    const n = exemplarInpaint(px, w, h, empty, maskBounds(w, h, geo), 0.5, {
      patchRadius: 3,
      searchRadius: 20,
      stride: 1,
    })
    expect(n).toBe(0)
    expect(Array.from(px)).toEqual(Array.from(before))
  })

  it('reconstructs every masked pixel (leaves no raw badge behind)', () => {
    const px = stripedImage(w, h)
    overwriteRegionWithBadge(px, w, geo)
    const mask = generateWatermarkMask(w, h, geo, 0.5)
    restoreWatermarkRegion(px, w, h, geo, white, exemplarParams)
    // No fully-saturated 255 badge pixels should remain where the mask was strong.
    let raw = 0
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0.3) {
        const o = i * 4
        if (px[o] === 255 && px[o + 1] === 255 && px[o + 2] === 255) raw++
      }
    }
    expect(raw).toBe(0)
  })
})
