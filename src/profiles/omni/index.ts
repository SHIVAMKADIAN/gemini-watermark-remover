import type { WatermarkProfile } from '../types'

/**
 * Gemini Omni video export watermark: bottom-right corner badge, present
 * on every frame at a fixed relative position. Geometry is a calibratable
 * best-effort default — use the in-app watermark region editor to
 * fine-tune it against your own exports before running Standard cleanup.
 */
export const omniProfile: WatermarkProfile = {
  id: 'omni-video',
  name: 'Gemini Omni (video)',
  source: 'omni',
  description: 'Corner badge watermark used on Gemini Omni video exports.',
  supportedResolutions: [
    { width: 1280, height: 720 },
    { width: 720, height: 1280 },
    { width: 1920, height: 1080 },
    { width: 1080, height: 1920 },
  ],
  aspectTolerance: 0.05,
  geometry: {
    landscape: {
      anchor: 'bottom-right',
      marginXFrac: 0.02,
      marginYFrac: 0.03,
      widthFrac: 0.14,
      heightFrac: 0.07,
      cornerRadiusFrac: 0.3,
      featherFrac: 0.1,
    },
    portrait: {
      anchor: 'bottom-right',
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
    auto: { alphaScale: 1.0, useFallbackReconstruction: true, fallbackAlphaThreshold: 0.82 },
    soft: { alphaScale: 0.85, useFallbackReconstruction: false, fallbackAlphaThreshold: 0.95 },
    standard: { alphaScale: 1.15, useFallbackReconstruction: true, fallbackAlphaThreshold: 0.7 },
  },
}
