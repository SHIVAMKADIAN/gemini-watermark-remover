import type { WatermarkProfile } from '../types'

/**
 * Gemini image export watermark: a small semi-transparent badge in the
 * bottom-right corner. Geometry below is a calibratable best-effort
 * default — use the in-app watermark region editor to fine-tune it
 * against your own exports before running Standard cleanup.
 */
export const geminiProfile: WatermarkProfile = {
  id: 'gemini-image',
  name: 'Gemini (image)',
  source: 'gemini',
  description: 'Corner badge watermark used on Gemini-generated image exports.',
  supportedResolutions: [],
  aspectTolerance: 0.5,
  geometry: {
    landscape: {
      anchor: 'bottom-right',
      marginXFrac: 0.022,
      marginYFrac: 0.028,
      widthFrac: 0.16,
      heightFrac: 0.075,
      cornerRadiusFrac: 0.35,
      featherFrac: 0.12,
    },
    portrait: {
      anchor: 'bottom-right',
      marginXFrac: 0.03,
      marginYFrac: 0.02,
      widthFrac: 0.24,
      heightFrac: 0.055,
      cornerRadiusFrac: 0.35,
      featherFrac: 0.12,
    },
    square: {
      anchor: 'bottom-right',
      marginXFrac: 0.025,
      marginYFrac: 0.025,
      widthFrac: 0.18,
      heightFrac: 0.065,
      cornerRadiusFrac: 0.35,
      featherFrac: 0.12,
    },
  },
  color: { r: 255, g: 255, b: 255, alpha: 0.55 },
  cleanupParams: {
    auto: { alphaScale: 1.0, useFallbackReconstruction: true, fallbackAlphaThreshold: 0.82 },
    soft: { alphaScale: 0.85, useFallbackReconstruction: false, fallbackAlphaThreshold: 0.95 },
    standard: { alphaScale: 1.15, useFallbackReconstruction: true, fallbackAlphaThreshold: 0.7 },
  },
}
