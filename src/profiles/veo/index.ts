import type { WatermarkProfile } from '../types'

/**
 * Google Flow / Veo video export watermark: bottom-left corner badge.
 * Geometry is a calibratable best-effort default — use the in-app
 * watermark region editor to fine-tune it against your own exports
 * before running Standard cleanup.
 */
export const veoProfile: WatermarkProfile = {
  id: 'veo-video',
  name: 'Google Flow / Veo (video)',
  source: 'veo',
  description: 'Corner badge watermark used on Google Flow / Veo video exports.',
  supportedResolutions: [
    { width: 1280, height: 720 },
    { width: 720, height: 1280 },
    { width: 1920, height: 1080 },
    { width: 1080, height: 1920 },
  ],
  aspectTolerance: 0.05,
  geometry: {
    landscape: {
      anchor: 'bottom-left',
      marginXFrac: 0.02,
      marginYFrac: 0.03,
      widthFrac: 0.14,
      heightFrac: 0.07,
      cornerRadiusFrac: 0.3,
      featherFrac: 0.1,
    },
    portrait: {
      anchor: 'bottom-left',
      marginXFrac: 0.03,
      marginYFrac: 0.018,
      widthFrac: 0.22,
      heightFrac: 0.045,
      cornerRadiusFrac: 0.3,
      featherFrac: 0.1,
    },
    square: null,
  },
  color: { r: 255, g: 255, b: 255, alpha: 0.5 },
  cleanupParams: {
    auto: {
      method: 'exemplar',
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
