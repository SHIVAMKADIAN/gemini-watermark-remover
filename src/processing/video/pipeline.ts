import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  VideoSampleSink,
  type VideoSample,
} from 'mediabunny'
import type { WatermarkSource } from '../../profiles/types'
import { MediaValidationError, type CleanupMode, type ProcessingProgress, type WatermarkRegionOverride } from '../../types'
import { applyPreparedMask, prepareMask, type PreparedMask } from '../watermark/restore'
import { resolveWatermark, toVideoPerfParams } from '../watermark/detect'
import { temporalFillWindow, type TemporalWindow } from './temporalFill'
import type { MaskGeometryPixels } from '../../workers/imageWorker.types'

export type VideoEngine = 'spatial' | 'temporal'

export interface VideoProcessOptions {
  source: WatermarkSource
  mode: CleanupMode
  override?: WatermarkRegionOverride | null
  detectMark?: boolean
  engine?: VideoEngine
  onProgress: (progress: ProcessingProgress) => void
}

export interface VideoProcessResult {
  blob: Blob
  width: number
  height: number
  duration: number
  fps: number
  audioPreserved: boolean
  engine: VideoEngine
  /** For the temporal engine: fraction of hole pixels reconstructed from other frames (0..1). */
  temporalCoverage?: number
  geometry: MaskGeometryPixels | null
}

const TEMPORAL_WINDOW = 24
const TEMPORAL_OVERLAP = 8

export async function processVideo(file: File, options: VideoProcessOptions): Promise<VideoProcessResult> {
  const { source, mode, override, detectMark, onProgress } = options
  const engine: VideoEngine = options.engine ?? 'spatial'
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

  // For the temporal engine, precompute per-frame fills (with cross-frame
  // look-ahead) before encoding, so the encode pass can just overlay them.
  let temporalFills: Map<number, Uint8ClampedArray> | null = null
  let temporalCoverage: number | undefined
  if (engine === 'temporal') {
    const result = await computeTemporalFills(file, width, height, prepared, fps, duration, onProgress)
    temporalFills = result.fills
    temporalCoverage = result.coverage
  }

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const boxW = prepared.bounds.maxX - prepared.bounds.minX + 1
  const boxH = prepared.bounds.maxY - prepared.bounds.minY + 1
  let frameCounter = 0

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      process: (sample: VideoSample) => {
        const canvas = new OffscreenCanvas(sample.displayWidth, sample.displayHeight)
        const cctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
        sample.draw(cctx, 0, 0, sample.displayWidth, sample.displayHeight)

        if (temporalFills) {
          const fill = temporalFills.get(frameCounter)
          if (fill) overlayHolePixels(cctx, fill, boxW, boxH, prepared)
        } else {
          const imageData = cctx.getImageData(0, 0, canvas.width, canvas.height)
          applyPreparedMask(imageData.data, canvas.width, canvas.height, prepared, color, params)
          cctx.putImageData(imageData, 0, 0)
        }
        frameCounter++
        return canvas
      },
    },
    // No audio options: Mediabunny copies the original encoded audio packets
    // directly into the output (no re-encode) when the container supports them.
    audio: {},
  })

  const audioDiscarded = conversion.discardedTracks.some((d) => d.track.isAudioTrack())
  const audioPreserved = !!audioTrackBefore && !audioDiscarded

  const encodeBase = engine === 'temporal' ? 0.65 : 0.1
  const encodeSpan = engine === 'temporal' ? 0.3 : 0.85
  conversion.onProgress = (progress) => {
    const total = Math.round(fps * duration)
    onProgress({
      stage: 'encoding',
      progress: encodeBase + progress * encodeSpan,
      message: `Encoding frames… ${Math.round(progress * 100)}%`,
      frameIndex: Math.min(Math.round(progress * total), total),
      totalFrames: total,
    })
  }

  onProgress({ stage: 'encoding', progress: encodeBase, message: 'Encoding frames…' })
  await conversion.execute()

  onProgress({ stage: 'muxing', progress: 0.97, message: 'Finalizing MP4 container…' })
  const buffer = output.target.buffer
  if (!buffer) throw new Error('Encoding failed to produce output.')
  const blob = new Blob([buffer], { type: 'video/mp4' })

  input.dispose()
  onProgress({ stage: 'done', progress: 1, message: 'Done' })

  return { blob, width, height, duration, fps, audioPreserved, engine, temporalCoverage, geometry }
}

/** Overlays only the hole pixels of a precomputed box fill onto the frame. */
function overlayHolePixels(
  cctx: OffscreenCanvasRenderingContext2D,
  boxFill: Uint8ClampedArray,
  boxW: number,
  boxH: number,
  prepared: PreparedMask,
): void {
  const { minX, minY } = prepared.bounds
  const region = cctx.getImageData(minX, minY, boxW, boxH)
  const data = region.data
  const eps = 1 / 255
  const fullWidth = cctx.canvas.width
  for (let by = 0; by < boxH; by++) {
    for (let bx = 0; bx < boxW; bx++) {
      const gi = (minY + by) * fullWidth + (minX + bx)
      if (prepared.mask[gi] <= eps) continue
      const bi = (by * boxW + bx) * 4
      data[bi] = boxFill[bi]
      data[bi + 1] = boxFill[bi + 1]
      data[bi + 2] = boxFill[bi + 2]
    }
  }
  cctx.putImageData(region, minX, minY)
}

interface TemporalFillsResult {
  fills: Map<number, Uint8ClampedArray>
  coverage: number
}

/**
 * Reads the video in overlapping windows, runs flow-guided temporal retrieval
 * over each window, and returns the filled box region for every frame keyed by
 * frame index — plus the overall fraction of hole pixels that were satisfied
 * from other frames (rather than spatially inpainted).
 */
async function computeTemporalFills(
  file: File,
  width: number,
  height: number,
  prepared: PreparedMask,
  fps: number,
  duration: number,
  onProgress: (p: ProcessingProgress) => void,
): Promise<TemporalFillsResult> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  const track = await input.getPrimaryVideoTrack()
  if (!track) {
    input.dispose()
    throw new MediaValidationError('No readable video track was found in this file.', 'decode-failed')
  }
  const sink = new VideoSampleSink(track)
  const totalFrames = Math.max(1, Math.round(fps * duration))
  const boxW = prepared.bounds.maxX - prepared.bounds.minX + 1
  const boxH = prepared.bounds.maxY - prepared.bounds.minY + 1
  const maxShift = Math.min(64, Math.round(Math.max(width, height) * 0.08))

  const canvas = new OffscreenCanvas(width, height)
  const cctx = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D

  const fills = new Map<number, Uint8ClampedArray>()
  let holeTotal = 0
  let temporalTotal = 0

  let buffer: Uint8ClampedArray[] = []
  let bufferStart = 0
  let nextToRecord = 0
  const step = TEMPORAL_WINDOW - TEMPORAL_OVERLAP

  const extractBox = (frame: Uint8ClampedArray): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(boxW * boxH * 4)
    for (let by = 0; by < boxH; by++) {
      const srcRow = ((prepared.bounds.minY + by) * width + prepared.bounds.minX) * 4
      out.set(frame.subarray(srcRow, srcRow + boxW * 4), by * boxW * 4)
    }
    return out
  }

  const flush = (isLast: boolean): void => {
    const win: TemporalWindow = { frames: buffer, width, height, mask: prepared.mask, bounds: prepared.bounds }
    const stats = temporalFillWindow(win, { maxShift })
    const end = isLast ? bufferStart + buffer.length : bufferStart + step
    for (let gi = nextToRecord; gi < end; gi++) {
      const local = gi - bufferStart
      fills.set(gi, extractBox(buffer[local]))
      holeTotal += stats[local].holePixels
      temporalTotal += stats[local].temporalPixels
    }
    nextToRecord = end
    if (!isLast) {
      buffer = buffer.slice(step)
      bufferStart += step
    }
  }

  let index = 0
  for await (const sample of sink.samples()) {
    sample.draw(cctx, 0, 0, width, height)
    sample.close()
    buffer.push(cctx.getImageData(0, 0, width, height).data)
    if (buffer.length === TEMPORAL_WINDOW) flush(false)
    index++
    if (index % 4 === 0) {
      onProgress({
        stage: 'processing',
        progress: 0.1 + Math.min(1, index / totalFrames) * 0.5,
        message: `Analyzing frames for revealed background… ${Math.round((index / totalFrames) * 100)}%`,
        frameIndex: index,
        totalFrames,
      })
    }
  }
  if (buffer.length > 0) flush(true)

  input.dispose()
  const coverage = holeTotal > 0 ? temporalTotal / holeTotal : 0
  return { fills, coverage }
}
