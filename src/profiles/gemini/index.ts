import type { WatermarkProfile } from '../types'

/**
 * Gemini image export watermark: the sparkle logo inset from the bottom-right
 * corner. Geometry follows the reverse-engineered "V2" profile from
 * allenk/GeminiWatermarkTool — a ~96 px square logo with a ~192 px margin on a
 * canonical ~2816 px export, scaled linearly to the actual image's long side
 * (floored at 36 px, matching that tool's smallest V2 logo). Use the in-app
 * region editor to fine-tune against a specific export.
 */
export const geminiProfile: WatermarkProfile = {
  id: 'gemini-image',
  name: 'Gemini (image)',
  source: 'gemini',
  description: 'Bottom-right sparkle logo on Gemini-generated image exports (current V2 layout).',
  supportedResolutions: [],
  aspectTolerance: 0.5,
  geometry: {
    anchor: 'bottom-right',
    canonicalLongSide: 2816,
    logoSizePx: 96,
    minLogoPx: 36,
    marginPx: 192,
    paddingPx: 22,
    cornerRadiusFrac: 0.3,
    featherFrac: 0.16,
  },
  orientations: ['landscape', 'portrait', 'square'],
  color: { r: 255, g: 255, b: 255, alpha: 0.55 },
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

/**
 * Legacy Gemini (pre-3.5) "V1" layout, kept for reference/extension: a 96 px
 * (large) / 48 px (small) logo with a 64/32 px margin. Not registered by
 * default; swap it in if you're cleaning older exports.
 */
export const geminiLegacyProfile: WatermarkProfile = {
  ...geminiProfile,
  id: 'gemini-image-v1',
  name: 'Gemini (image, legacy)',
  description: 'Bottom-right sparkle logo on pre-3.5 Gemini image exports (V1 layout).',
  geometry: {
    anchor: 'bottom-right',
    canonicalLongSide: 2048,
    logoSizePx: 96,
    minLogoPx: 48,
    marginPx: 64,
    paddingPx: 20,
    cornerRadiusFrac: 0.3,
    featherFrac: 0.16,
  },
}
