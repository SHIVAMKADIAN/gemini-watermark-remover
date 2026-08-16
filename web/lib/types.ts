export type MediaKind = 'image' | 'video'
export type JobStatus = 'queued' | 'processing' | 'done' | 'error'

export interface Region {
  x: number
  y: number
  w: number
  h: number
}

export interface JobView {
  id: string
  kind: MediaKind
  status: JobStatus
  progress: number
  message: string
  backend: string | null
  coverage: number | null
  error: string | null
  result_available: boolean
}
