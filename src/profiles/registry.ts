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
  if (!profile.orientations.includes(orientation)) return null
  return geometryToPixels(profile.geometry, mediaWidth, mediaHeight)
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * Computes the watermark mask box in actual pixels. The logo is a fixed square
 * measured at a canonical export long-side and scaled linearly to this media's
 * long side, then anchored to a corner with a scaled margin, and expanded by
 * scaled padding so the mask fully covers the logo (plus its anti-aliased halo).
 */
function geometryToPixels(geometry: WatermarkGeometry, mediaWidth: number, mediaHeight: number): ResolvedGeometry {
  const longSide = Math.max(mediaWidth, mediaHeight)
  const scale = longSide / geometry.canonicalLongSide

  const logo = Math.max(geometry.minLogoPx, Math.round(geometry.logoSizePx * scale))
  const margin = Math.round(geometry.marginPx * scale)
  const pad = Math.round(geometry.paddingPx * scale)
  const size = Math.min(logo + 2 * pad, mediaWidth, mediaHeight)

  let x: number
  let y: number
  switch (geometry.anchor) {
    case 'bottom-right':
      x = mediaWidth - margin - logo - pad
      y = mediaHeight - margin - logo - pad
      break
    case 'bottom-left':
      x = margin - pad
      y = mediaHeight - margin - logo - pad
      break
    case 'top-right':
      x = mediaWidth - margin - logo - pad
      y = margin - pad
      break
    case 'top-left':
      x = margin - pad
      y = margin - pad
      break
    case 'bottom-center':
      x = (mediaWidth - size) / 2
      y = mediaHeight - margin - logo - pad
      break
  }

  return {
    x: clamp(x, 0, mediaWidth - size),
    y: clamp(y, 0, mediaHeight - size),
    width: size,
    height: size,
    cornerRadius: geometry.cornerRadiusFrac * size,
    feather: geometry.featherFrac * size,
  }
}
