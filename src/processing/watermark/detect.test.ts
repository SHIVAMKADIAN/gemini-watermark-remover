import { describe, expect, it } from 'vitest'
import { defaultSourceForKind, resolveWatermark } from './detect'

describe('resolveWatermark', () => {
  it('selects the default source per media kind', () => {
    expect(defaultSourceForKind('image')).toBe('gemini')
    expect(defaultSourceForKind('video')).toBe('omni')
  })

  it('resolves geometry and params for a supported video', () => {
    const res = resolveWatermark('omni', 'auto', 1920, 1080)
    expect(res.geometry).not.toBeNull()
    expect(res.params.alphaScale).toBeGreaterThan(0)
    expect(res.color.alpha).toBeGreaterThan(0)
  })

  it('applies a manual override region in pixel space', () => {
    const res = resolveWatermark('omni', 'auto', 1000, 1000, {
      xFrac: 0.1,
      yFrac: 0.2,
      widthFrac: 0.3,
      heightFrac: 0.4,
    })
    expect(res.geometry).not.toBeNull()
    if (!res.geometry) return
    expect(res.geometry.x).toBeCloseTo(100)
    expect(res.geometry.y).toBeCloseTo(200)
    expect(res.geometry.width).toBeCloseTo(300)
    expect(res.geometry.height).toBeCloseTo(400)
  })

  it('uses different params per cleanup mode', () => {
    const soft = resolveWatermark('omni', 'soft', 1280, 720)
    const standard = resolveWatermark('omni', 'standard', 1280, 720)
    expect(standard.params.alphaScale).toBeGreaterThan(soft.params.alphaScale)
    expect(soft.params.useFallbackReconstruction).toBe(false)
    expect(standard.params.useFallbackReconstruction).toBe(true)
  })
})
