/// <reference lib="webworker" />
import { processVideo } from '../processing/video/pipeline'
import { MediaValidationError } from '../types'
import type { VideoWorkerRequest, VideoWorkerResponse } from './videoWorker.types'

const ctx = self as unknown as DedicatedWorkerGlobalScope

function post(msg: VideoWorkerResponse): void {
  ctx.postMessage(msg)
}

ctx.onmessage = async (ev: MessageEvent<VideoWorkerRequest>) => {
  const { id, file, source, mode, override, detectMark } = ev.data
  try {
    const result = await processVideo(file, {
      source,
      mode,
      override,
      detectMark,
      onProgress: (p) =>
        post({
          id,
          type: 'progress',
          stage: p.stage,
          progress: p.progress,
          message: p.message,
          frameIndex: p.frameIndex,
          totalFrames: p.totalFrames,
        }),
    })
    post({
      id,
      type: 'success',
      blob: result.blob,
      width: result.width,
      height: result.height,
      duration: result.duration,
      fps: result.fps,
      audioPreserved: result.audioPreserved,
      geometry: result.geometry,
    })
  } catch (err) {
    const message =
      err instanceof MediaValidationError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Processing failed. Your original file has not been modified.'
    post({ id, type: 'error', message })
  }
}
