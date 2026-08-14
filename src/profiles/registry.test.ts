import { describe, expect, it } from 'vitest'
import { getProfile, isResolutionSupported, resolveGeometry } from './registry'

describe('profile registry', () => {
  it('returns a profile for each known source', () => {
    expect(getProfile('gemini').source).toBe('gemini')
    expect(getProfile('omni').source).toBe('omni')
    expect(getProfile('veo').source).toBe('veo')
  })

  it('accepts any resolution for image profiles (no supportedResolutions)', () => {
    const gemini = getProfile('gemini')
    expect(isResolutionSupported(gemini, 1234, 567)).toBe(true)
  })

  it('accepts exact supported video resolutions', () => {
    const omni = getProfile('omni')
    expect(isResolutionSupported(omni, 1280, 720)).toBe(true)
    expect(isResolutionSupported(omni, 720, 1280)).toBe(true)
    expect(isResolutionSupported(omni, 1920, 1080)).toBe(true)
    expect(isResolutionSupported(omni, 1080, 1920)).toBe(true)
  })

  it('rejects mismatched aspect ratios for video profiles', () => {
    const omni = getProfile('omni')
    expect(isResolutionSupported(omni, 640, 640)).toBe(false)
    expect(isResolutionSupported(omni, 1000, 500)).toBe(false)
  })

  it('resolves bottom-right geometry inside the frame for landscape', () => {
    const omni = getProfile('omni')
    const geo = resolveGeometry(omni, 1920, 1080)
    expect(geo).not.toBeNull()
    if (!geo) return
    expect(geo.x).toBeGreaterThan(0)
    expect(geo.y).toBeGreaterThan(0)
    expect(geo.x + geo.width).toBeLessThanOrEqual(1920)
    expect(geo.y + geo.height).toBeLessThanOrEqual(1080)
    // Bottom-right anchor should place the box in the right half, lower half.
    expect(geo.x).toBeGreaterThan(1920 / 2)
    expect(geo.y).toBeGreaterThan(1080 / 2)
  })

  it('resolves geometry that scales with resolution', () => {
    const omni = getProfile('omni')
    const small = resolveGeometry(omni, 1280, 720)
    const large = resolveGeometry(omni, 1920, 1080)
    expect(small).not.toBeNull()
    expect(large).not.toBeNull()
    if (!small || !large) return
    // Same fractional width -> larger pixel width at higher resolution.
    expect(large.width).toBeGreaterThan(small.width)
  })

  it('returns null geometry for unsupported orientation (omni square)', () => {
    const omni = getProfile('omni')
    expect(resolveGeometry(omni, 800, 800)).toBeNull()
  })

  it('places veo watermark in the bottom-left', () => {
    const veo = getProfile('veo')
    const geo = resolveGeometry(veo, 1920, 1080)
    expect(geo).not.toBeNull()
    if (!geo) return
    expect(geo.x).toBeLessThan(1920 / 2)
    expect(geo.y).toBeGreaterThan(1080 / 2)
  })
})
