import { useCallback, useEffect, useRef, useState } from 'react'
import type { WatermarkSource } from '../profiles/types'
import type { CleanupMode, ImageFormat, ProcessingProgress, WatermarkRegionOverride } from '../types'
import { createTrackedObjectUrl, revokeTrackedObjectUrl } from '../utils/objectUrl'
import type { ImageWorkerRequest, ImageWorkerResponse, MaskGeometryPixels } from '../workers/imageWorker.types'

export interface ImageProcessResult {
  blob: Blob
  url: string
  width: number
  height: number
  format: ImageFormat
  geometry: MaskGeometryPixels | null
  pixelsModified: number
  fallbackPixels: number
}

export function useImageProcessor() {
  const workerRef = useRef<Worker | null>(null)
  const [progress, setProgress] = useState<ProcessingProgress | null>(null)
  const [result, setResult] = useState<ImageProcessResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  const reset = useCallback(() => {
    setResult((prev) => {
      if (prev) revokeTrackedObjectUrl(prev.url)
      return null
    })
    setError(null)
    setProgress(null)
  }, [])

  const process = useCallback(
    (
      file: File,
      format: ImageFormat,
      source: WatermarkSource,
      mode: CleanupMode,
      override?: WatermarkRegionOverride | null,
    ) => {
      return new Promise<ImageProcessResult>((resolve, reject) => {
        setError(null)
        setIsProcessing(true)
        setProgress({ stage: 'decoding', progress: 0, message: 'Starting…' })

        workerRef.current?.terminate()
        const worker = new Worker(new URL('../workers/imageWorker.ts', import.meta.url), { type: 'module' })
        workerRef.current = worker
        const id = crypto.randomUUID()

        worker.onmessage = (ev: MessageEvent<ImageWorkerResponse>) => {
          const msg = ev.data
          if (msg.id !== id) return
          if (msg.type === 'progress') {
            setProgress({ stage: msg.stage, progress: msg.progress, message: msg.message })
          } else if (msg.type === 'success') {
            const url = createTrackedObjectUrl(msg.blob)
            const processed: ImageProcessResult = {
              blob: msg.blob,
              url,
              width: msg.width,
              height: msg.height,
              format: msg.format,
              geometry: msg.geometry,
              pixelsModified: msg.pixelsModified,
              fallbackPixels: msg.fallbackPixels,
            }
            setResult(processed)
            setProgress({ stage: 'done', progress: 1, message: 'Done' })
            setIsProcessing(false)
            worker.terminate()
            resolve(processed)
          } else if (msg.type === 'error') {
            setError(msg.message)
            setProgress({ stage: 'error', progress: 0, message: msg.message })
            setIsProcessing(false)
            worker.terminate()
            reject(new Error(msg.message))
          }
        }

        worker.onerror = () => {
          const message = 'Processing failed. Your original file has not been modified.'
          setError(message)
          setProgress({ stage: 'error', progress: 0, message })
          setIsProcessing(false)
          worker.terminate()
          reject(new Error(message))
        }

        file
          .arrayBuffer()
          .then((buf) => {
            const req: ImageWorkerRequest = {
              id,
              fileBuffer: buf,
              mimeType: file.type || `image/${format}`,
              format,
              source,
              mode,
              override: override ?? null,
            }
            worker.postMessage(req, [buf])
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'Failed to read file.'
            setError(message)
            setIsProcessing(false)
            reject(new Error(message))
          })
      })
    },
    [],
  )

  return { process, progress, result, error, isProcessing, reset }
}
