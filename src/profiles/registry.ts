import type { Orientation, Resolution } from '../types'
import { getOrientation } from '../types'
import { geminiProfile } from './gemini'
import { omniProfile } from './omni'
import { veoProfile } from './veo'
import type { WatermarkGeometry, WatermarkProfile, WatermarkSource } from './types'

export const WATERMARK_PROFILES: WatermarkProfile[] = [geminiProfile, omniProfile, veoProfile]

export function getProfile(source: WatermarkSource): WatermarkProfile {
  const profile = WATERMARK_PROFILES.find((p) => p.source === source)
  if (!profile) throw new Error(`No watermark profile registered for source "${source}"`)
  return profile
}

/** Video profiles list their exact supported resolutions (spec requirement). */
export function isResolutionSupported(profile: WatermarkProfile, width: number, height: number): boolean {
  if (profile.supportedResolutions.length === 0) return true // images: any resolution
  return profile.supportedResolutions.some((res) => matchesResolution(res, width, height, profile.aspectTolerance))
}

function matchesResolution(res: Resolution, width: number, height: number, tolerance: number): boolean {
  const targetAspect = res.width / res.height
  const actualAspect = width / height
  const aspectDiff = Math.abs(targetAspect - actualAspect) / targetAspect
  if (aspectDiff > tolerance) return false
  // Same orientation family is required; exact pixel match is preferred but
  // any resolution sharing the aspect ratio within tolerance is accepted so
  // slightly re-exported files aren't rejected unnecessarily.
  return getOrientation(width, height) === getOrientation(res.width, res.height)
}

export interface ResolvedGeometry {
  /** Absolute pixel rectangle of the watermark bounding box. */
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
  feather: number
}

export function resolveGeometry(
  profile: WatermarkProfile,
  mediaWidth: number,
  mediaHeight: number,
): ResolvedGeometry | null {
  const orientation: Orientation = getOrientation(mediaWidth, mediaHeight)
  const geometry = profile.geometry[orientation]
  if (!geometry) return null
  return geometryToPixels(geometry, mediaWidth, mediaHeight)
}

function geometryToPixels(geometry: WatermarkGeometry, mediaWidth: number, mediaHeight: number): ResolvedGeometry {
  const width = geometry.widthFrac * mediaWidth
  const height = geometry.heightFrac * mediaHeight
  const marginX = geometry.marginXFrac * mediaWidth
  const marginY = geometry.marginYFrac * mediaHeight

  let x: number
  let y: number
  switch (geometry.anchor) {
    case 'bottom-right':
      x = mediaWidth - marginX - width
      y = mediaHeight - marginY - height
      break
    case 'bottom-left':
      x = marginX
      y = mediaHeight - marginY - height
      break
    case 'top-right':
      x = mediaWidth - marginX - width
      y = marginY
      break
    case 'top-left':
      x = marginX
      y = marginY
      break
    case 'bottom-center':
      x = (mediaWidth - width) / 2
      y = mediaHeight - marginY - height
      break
  }

  const minDim = Math.min(width, height)
  return {
    x,
    y,
    width,
    height,
    cornerRadius: geometry.cornerRadiusFrac * minDim,
    feather: geometry.featherFrac * minDim,
  }
}
