import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, type VideoSample } from 'mediabunny'
import type { WatermarkSource } from '../../profiles/types'
import { MediaValidationError, type CleanupMode, type ProcessingProgress, type WatermarkRegionOverride } from '../../types'
import { applyPreparedMask, prepareMask } from '../watermark/restore'
import { resolveWatermark, toVideoPerfParams } from '../watermark/detect'
import type { MaskGeometryPixels } from '../../workers/imageWorker.types'

export interface VideoProcessOptions {
  source: WatermarkSource
  mode: CleanupMode
  override?: WatermarkRegionOverride | null
  detectMark?: boolean
  onProgress: (progress: ProcessingProgress) => void
}

export interface VideoProcessResult {
  blob: Blob
  width: number
  height: number
  duration: number
  fps: number
  audioPreserved: boolean
  geometry: MaskGeometryPixels | null
}

export async function processVideo(file: File, options: VideoProcessOptions): Promise<VideoProcessResult> {
  const { source, mode, override, detectMark, onProgress } = options
  onProgress({ stage: 'decoding', progress: 0.02, message: 'Reading video…' })

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  const videoTrack = await input.getPrimaryVideoTrack()
  if (!videoTrack) {
    input.dispose()
    throw new MediaValidationError('No readable video track was found in this file.', 'decode-failed')
  }
  const audioTrackBefore = await input.getPrimaryAudioTrack()
  const width = await videoTrack.getDisplayWidth()
  const height = await videoTrack.getDisplayHeight()
  const duration = await input.computeDuration()
  const fps = (await videoTrack.computePacketStats()).averagePacketRate

  onProgress({ stage: 'analyzing', progress: 0.05, message: 'Locating watermark region…' })
  const resolution = resolveWatermark(source, mode, width, height, override)
  const { color, geometry } = resolution
  const basePerf = toVideoPerfParams(resolution.params)
  const params = detectMark === undefined ? basePerf : { ...basePerf, detectWithinRegion: detectMark }
  if (!geometry) {
    input.dispose()
    throw new MediaValidationError(
      "This video's orientation isn't supported by the selected watermark profile yet.",
      'unsupported-resolution',
    )
  }
  const prepared = prepareMask(geometry, color, params, width, height)

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      process: (sample: VideoSample) => {
        const canvas = new OffscreenCanvas(sample.displayWidth, sample.displayHeight)
        const cctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
        sample.draw(cctx, 0, 0, sample.displayWidth, sample.displayHeight)
        const imageData = cctx.getImageData(0, 0, canvas.width, canvas.height)
        applyPreparedMask(imageData.data, canvas.width, canvas.height, prepared, color, params)
        cctx.putImageData(imageData, 0, 0)
        return canvas
      },
    },
    // No `process`/`codec`/`quality` set for audio: Mediabunny takes the fast
    // path and copies the original encoded audio packets directly into the
    // output container, with no re-encode, whenever the container supports
    // the source codec.
    audio: {},
  })

  const audioDiscarded = conversion.discardedTracks.some((d) => d.track.isAudioTrack())
  const audioPreserved = !!audioTrackBefore && !audioDiscarded

  conversion.onProgress = (progress) => {
    const frameIndex = Math.min(Math.round(progress * fps * duration), Math.round(fps * duration))
    onProgress({
      stage: 'processing',
      progress: 0.1 + progress * 0.85,
      message: `Restoring frames… ${Math.round(progress * 100)}%`,
      frameIndex,
      totalFrames: Math.round(fps * duration),
    })
  }

  onProgress({ stage: 'processing', progress: 0.1, message: 'Restoring frames…' })
  await conversion.execute()

  onProgress({ stage: 'muxing', progress: 0.97, message: 'Finalizing MP4 container…' })
  const buffer = output.target.buffer
  if (!buffer) throw new Error('Encoding failed to produce output.')
  const blob = new Blob([buffer], { type: 'video/mp4' })

  input.dispose()
  onProgress({ stage: 'done', progress: 1, message: 'Done' })

  return {
    blob,
    width,
    height,
    duration,
    fps,
    audioPreserved,
    geometry,
  }
}
