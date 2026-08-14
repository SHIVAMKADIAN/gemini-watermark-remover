/// <reference lib="webworker" />
import { resolveWatermark } from '../processing/watermark/detect'
import { restoreWatermarkRegion } from '../processing/watermark/restore'
import { encodeMimeForFormat } from '../utils/imageFormat'
import type { ImageWorkerRequest, ImageWorkerResponse } from './imageWorker.types'

const ctx = self as unknown as DedicatedWorkerGlobalScope

function post(msg: ImageWorkerResponse, transfer?: Transferable[]): void {
  if (transfer && transfer.length > 0) {
    ctx.postMessage(msg, transfer)
  } else {
    ctx.postMessage(msg)
  }
}

ctx.onmessage = async (ev: MessageEvent<ImageWorkerRequest>) => {
  const { id, fileBuffer, mimeType, format, source, mode, override, detectMark } = ev.data
  try {
    post({ id, type: 'progress', stage: 'decoding', progress: 0.1, message: 'Decoding image…' })
    const blob = new Blob([fileBuffer], { type: mimeType })
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap

    post({ id, type: 'progress', stage: 'analyzing', progress: 0.3, message: 'Locating watermark region…' })
    const resolved = resolveWatermark(source, mode, width, height, override)
    const { color, geometry } = resolved
    const params =
      detectMark === undefined ? resolved.params : { ...resolved.params, detectWithinRegion: detectMark }

    const canvas = new OffscreenCanvas(width, height)
    const octx = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
    octx.drawImage(bitmap, 0, 0)
    bitmap.close()

    let pixelsModified = 0
    let fallbackPixels = 0
    if (geometry) {
      post({ id, type: 'progress', stage: 'processing', progress: 0.55, message: 'Restoring watermark pixels…' })
      const imageData = octx.getImageData(0, 0, width, height)
      const result = restoreWatermarkRegion(imageData.data, width, height, geometry, color, params)
      pixelsModified = result.reconstructedPixels
      fallbackPixels = result.fallbackPixels
      octx.putImageData(imageData, 0, 0)
    }

    post({ id, type: 'progress', stage: 'encoding', progress: 0.85, message: 'Encoding output…' })
    const outMime = encodeMimeForFormat(format)
    const quality = format === 'png' ? undefined : 0.95
    const outBlob = await canvas.convertToBlob({ type: outMime, quality })

    post({
      id,
      type: 'success',
      blob: outBlob,
      width,
      height,
      format,
      geometry,
      pixelsModified,
      fallbackPixels,
    })
  } catch (err) {
    post({ id, type: 'error', message: err instanceof Error ? err.message : 'Processing failed. Your original file has not been modified.' })
  }
}
