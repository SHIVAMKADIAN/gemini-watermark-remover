import { MediaValidationError, type ImageFormat, type Resolution } from '../types'
import { formatFromExtension, formatFromMimeType } from './imageFormat'

export const ACCEPTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp']
export const ACCEPTED_VIDEO_EXTENSIONS = ['.mp4']

export const SUPPORTED_VIDEO_RESOLUTIONS: Resolution[] = [
  { width: 1280, height: 720 },
  { width: 720, height: 1280 },
  { width: 1920, height: 1080 },
  { width: 1080, height: 1920 },
]

/** Large-file advisory threshold — not a hard cap, just surfaces a warning. */
export const LARGE_IMAGE_BYTES = 40 * 1024 * 1024
export const LARGE_VIDEO_BYTES = 400 * 1024 * 1024

export function validateImageFile(file: File): ImageFormat {
  if (file.size === 0) {
    throw new MediaValidationError('This file is empty.', 'empty-file')
  }
  const format = formatFromMimeType(file.type) ?? formatFromExtension(file.name)
  if (!format) {
    throw new MediaValidationError(
      "This file format isn't supported. Please use PNG, JPG, or WebP.",
      'unsupported-format',
    )
  }
  return format
}

export function validateVideoFile(file: File): void {
  if (file.size === 0) {
    throw new MediaValidationError('This file is empty.', 'empty-file')
  }
  const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')
  if (!isMp4) {
    throw new MediaValidationError("This file format isn't supported. Please use an MP4 video.", 'unsupported-format')
  }
}

export function isSupportedVideoResolution(width: number, height: number): boolean {
  const aspect = width / height
  return SUPPORTED_VIDEO_RESOLUTIONS.some((r) => {
    const rAspect = r.width / r.height
    return Math.abs(aspect - rAspect) / rAspect < 0.05
  })
}

export function checkWebCodecsSupport(): boolean {
  return typeof globalThis.VideoDecoder !== 'undefined' && typeof globalThis.VideoEncoder !== 'undefined'
}
