import type { JobView, MediaKind, Region } from './types'

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '')

export interface CreateJobInput {
  file: File
  kind: MediaKind
  region: Region
  imageBackend?: string
  videoBackend?: string
  featherRadius?: number
  dilateRadius?: number
}

export async function createJob(input: CreateJobInput): Promise<JobView> {
  const fd = new FormData()
  fd.append('file', input.file)
  fd.append('kind', input.kind)
  fd.append('x', String(input.region.x))
  fd.append('y', String(input.region.y))
  fd.append('w', String(input.region.w))
  fd.append('h', String(input.region.h))
  if (input.imageBackend) fd.append('image_backend', input.imageBackend)
  if (input.videoBackend) fd.append('video_backend', input.videoBackend)
  if (input.featherRadius != null) fd.append('feather_radius', String(input.featherRadius))
  if (input.dilateRadius != null) fd.append('dilate_radius', String(input.dilateRadius))

  const res = await fetch(`${API_BASE}/api/jobs`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(await errorText(res))
  return res.json()
}

export async function getJob(id: string): Promise<JobView> {
  const res = await fetch(`${API_BASE}/api/jobs/${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(await errorText(res))
  return res.json()
}

export function resultUrl(id: string): string {
  return `${API_BASE}/api/jobs/${id}/result`
}

export async function fetchHealth(): Promise<{ status: string; queued: number }> {
  const res = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' })
  if (!res.ok) throw new Error('server unreachable')
  return res.json()
}

async function errorText(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body.detail ?? JSON.stringify(body)
  } catch {
    return `${res.status} ${res.statusText}`
  }
}
