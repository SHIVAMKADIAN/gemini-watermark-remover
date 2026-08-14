import { describe, expect, it } from 'vitest'
import { formatAspectRatio, formatBytes, formatDuration, formatFps, formatResolution } from './format'

describe('format utils', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('formats duration as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(9)).toBe('0:09')
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(Infinity)).toBe('0:00')
  })

  it('formats resolution', () => {
    expect(formatResolution(1920, 1080)).toBe('1920 × 1080')
  })

  it('reduces aspect ratios', () => {
    expect(formatAspectRatio(1920, 1080)).toBe('16:9')
    expect(formatAspectRatio(1080, 1920)).toBe('9:16')
    expect(formatAspectRatio(1280, 720)).toBe('16:9')
  })

  it('formats fps', () => {
    expect(formatFps(30)).toBe('30 fps')
    expect(formatFps(29.97)).toBe('29.97 fps')
  })
})
