import { describe, expect, it } from 'vitest'
import {
  encodeMimeForFormat,
  extensionForFormat,
  formatFromExtension,
  formatFromMimeType,
} from './imageFormat'

describe('imageFormat', () => {
  it('maps mime types to formats', () => {
    expect(formatFromMimeType('image/png')).toBe('png')
    expect(formatFromMimeType('image/jpeg')).toBe('jpeg')
    expect(formatFromMimeType('image/jpg')).toBe('jpeg')
    expect(formatFromMimeType('image/webp')).toBe('webp')
    expect(formatFromMimeType('image/gif')).toBeNull()
  })

  it('maps extensions to formats', () => {
    expect(formatFromExtension('a.PNG')).toBe('png')
    expect(formatFromExtension('a.jpg')).toBe('jpeg')
    expect(formatFromExtension('a.jpeg')).toBe('jpeg')
    expect(formatFromExtension('a.webp')).toBe('webp')
    expect(formatFromExtension('a.bmp')).toBeNull()
  })

  it('produces encode mime types', () => {
    expect(encodeMimeForFormat('png')).toBe('image/png')
    expect(encodeMimeForFormat('jpeg')).toBe('image/jpeg')
    expect(encodeMimeForFormat('webp')).toBe('image/webp')
  })

  it('produces file extensions', () => {
    expect(extensionForFormat('png')).toBe('png')
    expect(extensionForFormat('jpeg')).toBe('jpg')
    expect(extensionForFormat('webp')).toBe('webp')
  })
})
