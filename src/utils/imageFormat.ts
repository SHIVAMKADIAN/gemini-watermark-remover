import type { ImageFormat } from '../types'

const MIME_TO_FORMAT: Record<string, ImageFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/webp': 'webp',
}

export function formatFromMimeType(mime: string): ImageFormat | null {
  return MIME_TO_FORMAT[mime.toLowerCase()] ?? null
}

export function formatFromExtension(name: string): ImageFormat | null {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'png'
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (ext === 'webp') return 'webp'
  return null
}

export function encodeMimeForFormat(format: ImageFormat): string {
  switch (format) {
    case 'png':
      return 'image/png'
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
  }
}

export function extensionForFormat(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : format
}
