import { useCallback, useEffect, useRef, useState } from 'react'
import type { WatermarkSource } from '../profiles/types'
import type { CleanupMode, ProcessingProgress, WatermarkRegionOverride } from '../types'
import { createTrackedObjectUrl, revokeTrackedObjectUrl } from '../utils/objectUrl'
import type { VideoWorkerRequest, VideoWorkerResponse } from '../workers/videoWorker.types'
import type { MaskGeometryPixels } from '../workers/imageWorker.types'

export interface VideoProcessResult {
  blob: Blob
  url: string
  width: number
  height: number
  duration: number
  fps: number
  audioPreserved: boolean
  geometry: MaskGeometryPixels | null
}

export function useVideoProcessor() {
  const workerRef = useRef<Worker | null>(null)
  const [progress, setProgress] = useState<ProcessingProgress | null>(null)
  const [result, setResult] = useState<VideoProcessResult | null>(null)
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

  const cancel = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setIsProcessing(false)
  }, [])

  const process = useCallback(
    (file: File, source: WatermarkSource, mode: CleanupMode, override?: WatermarkRegionOverride | null) => {
      return new Promise<VideoProcessResult>((resolve, reject) => {
        setError(null)
        setIsProcessing(true)
        setProgress({ stage: 'decoding', progress: 0, message: 'Starting…' })

        workerRef.current?.terminate()
        const worker = new Worker(new URL('../workers/videoWorker.ts', import.meta.url), { type: 'module' })
        workerRef.current = worker
        const id = crypto.randomUUID()

        worker.onmessage = (ev: MessageEvent<VideoWorkerResponse>) => {
          const msg = ev.data
          if (msg.id !== id) return
          if (msg.type === 'progress') {
            setProgress({
              stage: msg.stage,
              progress: msg.progress,
              message: msg.message,
              frameIndex: msg.frameIndex,
              totalFrames: msg.totalFrames,
            })
          } else if (msg.type === 'success') {
            const url = createTrackedObjectUrl(msg.blob)
            const processed: VideoProcessResult = {
              blob: msg.blob,
              url,
              width: msg.width,
              height: msg.height,
              duration: msg.duration,
              fps: msg.fps,
              audioPreserved: msg.audioPreserved,
              geometry: msg.geometry,
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

        const req: VideoWorkerRequest = { id, file, source, mode, override: override ?? null }
        worker.postMessage(req)
      })
    },
    [],
  )

  return { process, cancel, progress, result, error, isProcessing, reset }
}
