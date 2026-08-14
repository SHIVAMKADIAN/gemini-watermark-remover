import type { WatermarkProfile } from '../types'

/**
 * Gemini Omni video export watermark: bottom-right corner badge present on
 * every frame. The reference tool (allenk/GeminiWatermarkTool) covers Gemini
 * images only, so the video figures here are estimates in the same fixed-pixel
 * model (a ~64 px badge with a small margin on a 1920 px-wide frame, scaled by
 * long side). Fine-tune with the in-app region editor for a given export.
 */
export const omniProfile: WatermarkProfile = {
  id: 'omni-video',
  name: 'Gemini Omni (video)',
  source: 'omni',
  description: 'Bottom-right corner badge on Gemini Omni video exports.',
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
    logoSizePx: 64,
    minLogoPx: 44,
    marginPx: 40,
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
