import type { WatermarkSource } from '../profiles/types'
import type { CleanupMode, ImageFormat, ProcessingStage, WatermarkRegionOverride } from '../types'

export interface MaskGeometryPixels {
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
  feather: number
}

export interface ImageWorkerRequest {
  id: string
  fileBuffer: ArrayBuffer
  mimeType: string
  format: ImageFormat
  source: WatermarkSource
  mode: CleanupMode
  override?: WatermarkRegionOverride | null
}

export interface ImageWorkerProgressMsg {
  id: string
  type: 'progress'
  stage: ProcessingStage
  progress: number
  message: string
}

export interface ImageWorkerSuccessMsg {
  id: string
  type: 'success'
  blob: Blob
  width: number
  height: number
  format: ImageFormat
  geometry: MaskGeometryPixels | null
  pixelsModified: number
  fallbackPixels: number
}

export interface ImageWorkerErrorMsg {
  id: string
  type: 'error'
  message: string
}

export type ImageWorkerResponse = ImageWorkerProgressMsg | ImageWorkerSuccessMsg | ImageWorkerErrorMsg
