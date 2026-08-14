import { getOrientation, type ImageFormat, type ImageMetadata } from '../../types'

export async function readImageMetadata(file: File, format: ImageFormat): Promise<ImageMetadata> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  try {
    const hasAlpha = format === 'jpeg' ? false : await detectAlpha(bitmap)
    return {
      kind: 'image',
      fileName: file.name,
      fileSize: file.size,
      format,
      width,
      height,
      hasAlpha,
      orientation: getOrientation(width, height),
    }
  } finally {
    bitmap.close()
  }
}

async function detectAlpha(bitmap: ImageBitmap): Promise<boolean> {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.drawImage(bitmap, 0, 0)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const totalPixels = canvas.width * canvas.height
  const step = Math.max(1, Math.floor(totalPixels / 100_000))
  for (let p = 0; p < totalPixels; p += step) {
    if (data[p * 4 + 3] < 255) return true
  }
  return false
}
