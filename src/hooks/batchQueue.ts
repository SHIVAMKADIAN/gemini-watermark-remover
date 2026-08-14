import type { WatermarkSource } from '../profiles/types'
import type { CleanupMode, QueueItemStatus } from '../types'
import type { MaskGeometryPixels } from '../workers/imageWorker.types'

export interface QueueItem {
  id: string
  file: File
  status: QueueItemStatus
  progress: number
  message: string
  width: number | null
  height: number | null
  error: string | null
  resultBlob: Blob | null
  resultUrl: string | null
  originalUrl: string | null
  fps: number | null
  duration: number | null
  audioPreserved: boolean
  geometry: MaskGeometryPixels | null
}

export interface BatchSettings {
  source: WatermarkSource
  mode: CleanupMode
}

export type QueueAction =
  | { type: 'add'; files: File[] }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'setMeta'; id: string; width: number; height: number; fps: number | null; duration: number | null; originalUrl: string }
  | { type: 'start'; id: string }
  | { type: 'progress'; id: string; progress: number; message: string }
  | {
      type: 'complete'
      id: string
      blob: Blob
      url: string
      fps: number
      duration: number
      audioPreserved: boolean
      geometry: MaskGeometryPixels | null
    }
  | { type: 'error'; id: string; error: string }

function newItem(file: File): QueueItem {
  return {
    id: crypto.randomUUID(),
    file,
    status: 'waiting',
    progress: 0,
    message: 'Waiting',
    width: null,
    height: null,
    error: null,
    resultBlob: null,
    resultUrl: null,
    originalUrl: null,
    fps: null,
    duration: null,
    audioPreserved: false,
    geometry: null,
  }
}

export function queueReducer(state: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.type) {
    case 'add':
      return [...state, ...action.files.map(newItem)]
    case 'remove':
      return state.filter((it) => it.id !== action.id)
    case 'clear':
      return []
    case 'setMeta':
      return state.map((it) =>
        it.id === action.id
          ? { ...it, width: action.width, height: action.height, fps: action.fps, duration: action.duration, originalUrl: action.originalUrl }
          : it,
      )
    case 'start':
      return state.map((it) =>
        it.id === action.id ? { ...it, status: 'processing', progress: 0, message: 'Processing…', error: null } : it,
      )
    case 'progress':
      return state.map((it) =>
        it.id === action.id ? { ...it, progress: action.progress, message: action.message } : it,
      )
    case 'complete':
      return state.map((it) =>
        it.id === action.id
          ? {
              ...it,
              status: 'complete',
              progress: 1,
              message: 'Complete',
              resultBlob: action.blob,
              resultUrl: action.url,
              fps: action.fps,
              duration: action.duration,
              audioPreserved: action.audioPreserved,
              geometry: action.geometry,
            }
          : it,
      )
    case 'error':
      return state.map((it) =>
        it.id === action.id ? { ...it, status: 'error', message: 'Failed', error: action.error } : it,
      )
    default:
      return state
  }
}

export const STATUS_LABELS: Record<QueueItemStatus, string> = {
  waiting: 'Waiting',
  processing: 'Processing',
  review: 'Review',
  complete: 'Complete',
  error: 'Error',
}
