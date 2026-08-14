import type { WatermarkSource } from '../profiles/types'
import type { CleanupMode, ProcessingStage, WatermarkRegionOverride } from '../types'
import type { MaskGeometryPixels } from './imageWorker.types'

export interface VideoWorkerRequest {
  id: string
  file: File
  source: WatermarkSource
  mode: CleanupMode
  override?: WatermarkRegionOverride | null
}

export interface VideoWorkerProgressMsg {
  id: string
  type: 'progress'
  stage: ProcessingStage
  progress: number
  message: string
  frameIndex?: number
  totalFrames?: number
}

export interface VideoWorkerSuccessMsg {
  id: string
  type: 'success'
  blob: Blob
  width: number
  height: number
  duration: number
  fps: number
  audioPreserved: boolean
  geometry: MaskGeometryPixels | null
}

export interface VideoWorkerErrorMsg {
  id: string
  type: 'error'
  message: string
}

export type VideoWorkerResponse = VideoWorkerProgressMsg | VideoWorkerSuccessMsg | VideoWorkerErrorMsg
