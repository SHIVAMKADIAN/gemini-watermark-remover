export type MediaKind = 'image' | 'video'

export type ImageFormat = 'png' | 'jpeg' | 'webp'

export type CleanupMode = 'auto' | 'soft' | 'standard'

export interface CleanupModeInfo {
  id: CleanupMode
  label: string
  description: string
}

export const CLEANUP_MODES: CleanupModeInfo[] = [
  {
    id: 'auto',
    label: 'Auto',
    description: 'Recommended for most Gemini and Omni files. Reconstructs the watermark area from the surrounding pixels (deterministic content-aware fill).',
  },
  {
    id: 'soft',
    label: 'Soft',
    description: 'For translucent marks on bright, simple backgrounds. Uses reverse-alpha to recover detail under the mark instead of filling it in.',
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'For darker, textured, or busy backgrounds. Stronger content-aware reconstruction with more smoothing.',
  },
]

export interface Resolution {
  width: number
  height: number
}

export type Orientation = 'landscape' | 'portrait' | 'square'

export function getOrientation(width: number, height: number): Orientation {
  if (width === height) return 'square'
  return width > height ? 'landscape' : 'portrait'
}

export interface ImageMetadata {
  kind: 'image'
  fileName: string
  fileSize: number
  format: ImageFormat
  width: number
  height: number
  hasAlpha: boolean
  orientation: Orientation
}

export interface VideoMetadata {
  kind: 'video'
  fileName: string
  fileSize: number
  width: number
  height: number
  duration: number
  fps: number
  videoCodec: string | null
  hasAudio: boolean
  audioCodec: string | null
  sampleRate: number | null
  numberOfChannels: number | null
  orientation: Orientation
  totalFrames: number
}

export type MediaMetadata = ImageMetadata | VideoMetadata

export type ProcessingStage =
  | 'idle'
  | 'validating'
  | 'decoding'
  | 'analyzing'
  | 'processing'
  | 'encoding'
  | 'muxing'
  | 'done'
  | 'error'

export interface ProcessingProgress {
  stage: ProcessingStage
  progress: number // 0..1
  message: string
  frameIndex?: number
  totalFrames?: number
}

export type MediaValidationErrorCode =
  | 'unsupported-format'
  | 'unsupported-resolution'
  | 'unsupported-browser'
  | 'decode-failed'
  | 'empty-file'
  | 'too-large'

export class MediaValidationError extends Error {
  readonly code: MediaValidationErrorCode

  constructor(message: string, code: MediaValidationErrorCode) {
    super(message)
    this.name = 'MediaValidationError'
    this.code = code
  }
}

export interface ProcessedImageResult {
  kind: 'image'
  blob: Blob
  width: number
  height: number
  format: ImageFormat
  maskPreviewDataUrl?: string
}

export interface ProcessedVideoResult {
  kind: 'video'
  blob: Blob
  width: number
  height: number
  duration: number
  fps: number
  audioPreserved: boolean
  reencoded: true
}

export type QueueItemStatus = 'waiting' | 'processing' | 'review' | 'complete' | 'error'

export interface WatermarkRegionOverride {
  xFrac: number
  yFrac: number
  widthFrac: number
  heightFrac: number
}
