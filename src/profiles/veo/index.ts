import type { WatermarkProfile } from '../types'

/**
 * Google Flow / Veo video export watermark: a ~48 px "Veo" diamond badge in
 * the bottom-right corner (per the reference tool's notes: 48×48 at 1080p,
 * ~44×44 compact at 720p). Fixed-pixel model scaled by long side; fine-tune
 * with the in-app region editor for a given export.
 */
export const veoProfile: WatermarkProfile = {
  id: 'veo-video',
  name: 'Google Flow / Veo (video)',
  source: 'veo',
  description: 'Bottom-right "Veo" diamond badge on Google Flow / Veo video exports.',
  supportedResolutions: [
    { width: 1280, height: 720 },
    { width: 720, height: 1280 },
    { width: 1920, height: 1080 },
    { width: 1080, height: 1920 },
  ],
  aspectTolerance: 0.05,
  geometry: {
    anchor: 'bottom-right',
    canonicalLongSide: 1920,
    logoSizePx: 48,
    minLogoPx: 40,
    marginPx: 44,
    paddingPx: 16,
    cornerRadiusFrac: 0.3,
    featherFrac: 0.16,
  },
  orientations: ['landscape', 'portrait'],
  color: { r: 255, g: 255, b: 255, alpha: 0.5 },
  cleanupParams: {
    auto: {
      method: 'exemplar',
      detectWithinRegion: true,
      patchRadius: 4,
      searchRadius: 64,
      exemplarStride: 2,
      inpaintIterations: 140,
      alphaScale: 1.0,
      useFallbackReconstruction: true,
      fallbackAlphaThreshold: 0.82,
    },
    soft: {
      method: 'reverse-alpha',
      detectWithinRegion: false,
      patchRadius: 4,
      searchRadius: 48,
      exemplarStride: 2,
      inpaintIterations: 60,
      alphaScale: 0.85,
      useFallbackReconstruction: false,
      fallbackAlphaThreshold: 0.95,
    },
    standard: {
      method: 'exemplar',
      detectWithinRegion: true,
      patchRadius: 5,
      searchRadius: 96,
      exemplarStride: 2,
      inpaintIterations: 240,
      alphaScale: 1.15,
      useFallbackReconstruction: true,
      fallbackAlphaThreshold: 0.7,
    },
  },
}
