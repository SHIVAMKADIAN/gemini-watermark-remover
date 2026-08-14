import { describe, expect, it } from 'vitest'
import { MediaValidationError } from '../types'
import { isSupportedVideoResolution, validateImageFile, validateVideoFile } from './fileValidation'

function fakeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateImageFile', () => {
  it('accepts PNG, JPEG, WebP by mime type', () => {
    expect(validateImageFile(fakeFile('a.png', 'image/png'))).toBe('png')
    expect(validateImageFile(fakeFile('a.jpg', 'image/jpeg'))).toBe('jpeg')
    expect(validateImageFile(fakeFile('a.webp', 'image/webp'))).toBe('webp')
  })

  it('falls back to extension when mime is missing', () => {
    expect(validateImageFile(fakeFile('photo.PNG', ''))).toBe('png')
    expect(validateImageFile(fakeFile('photo.jpeg', ''))).toBe('jpeg')
  })

  it('rejects unsupported formats', () => {
    expect(() => validateImageFile(fakeFile('a.gif', 'image/gif'))).toThrow(MediaValidationError)
  })

  it('rejects empty files', () => {
    expect(() => validateImageFile(fakeFile('a.png', 'image/png', 0))).toThrow(/empty/i)
  })
})

describe('validateVideoFile', () => {
  it('accepts mp4 by mime or extension', () => {
    expect(() => validateVideoFile(fakeFile('v.mp4', 'video/mp4'))).not.toThrow()
    expect(() => validateVideoFile(fakeFile('v.mp4', ''))).not.toThrow()
  })

  it('rejects non-mp4', () => {
    expect(() => validateVideoFile(fakeFile('v.mov', 'video/quicktime'))).toThrow(MediaValidationError)
  })
})

describe('isSupportedVideoResolution', () => {
  it('accepts the four primary resolutions', () => {
    expect(isSupportedVideoResolution(1280, 720)).toBe(true)
    expect(isSupportedVideoResolution(720, 1280)).toBe(true)
    expect(isSupportedVideoResolution(1920, 1080)).toBe(true)
    expect(isSupportedVideoResolution(1080, 1920)).toBe(true)
  })

  it('accepts near-16:9 and near-9:16 aspect ratios', () => {
    expect(isSupportedVideoResolution(2560, 1440)).toBe(true)
    expect(isSupportedVideoResolution(1440, 2560)).toBe(true)
  })

  it('rejects square and off-ratio dimensions', () => {
    expect(isSupportedVideoResolution(800, 800)).toBe(false)
    expect(isSupportedVideoResolution(1000, 500)).toBe(false)
  })
})
