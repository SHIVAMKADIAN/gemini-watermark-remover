import type { ResolvedGeometry } from '../../profiles/registry'

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function smoothstep(t: number): number {
  const c = clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
}

/** Signed distance to a rounded box centered at (cx, cy) with half-extents (hx, hy) and corner radius r. Negative = inside. */
function roundedBoxSDF(px: number, py: number, cx: number, cy: number, hx: number, hy: number, r: number): number {
  const qx = Math.abs(px - cx) - (hx - r)
  const qy = Math.abs(py - cy) - (hy - r)
  const outsideX = Math.max(qx, 0)
  const outsideY = Math.max(qy, 0)
  const outsideDist = Math.sqrt(outsideX * outsideX + outsideY * outsideY)
  const insideDist = Math.min(Math.max(qx, qy), 0)
  return outsideDist + insideDist - r
}

/**
 * Generates a per-pixel alpha mask (0..peakAlpha) at native resolution
 * describing the estimated watermark compositing alpha. The mask is a
 * feathered rounded rectangle so the reverse-alpha correction fades out
 * smoothly at the watermark's anti-aliased edge instead of leaving a hard
 * seam. Pixels outside the geometry (plus feather) are exactly 0 and are
 * never touched by downstream restoration.
 */
export function generateWatermarkMask(
  width: number,
  height: number,
  geometry: ResolvedGeometry,
  peakAlpha: number,
): Float32Array {
  const mask = new Float32Array(width * height)
  const peak = clamp(peakAlpha, 0, 0.98)
  const r = Math.min(geometry.cornerRadius, geometry.width / 2, geometry.height / 2)
  const cx = geometry.x + geometry.width / 2
  const cy = geometry.y + geometry.height / 2
  const hx = geometry.width / 2
  const hy = geometry.height / 2
  const feather = Math.max(geometry.feather, 0.001)

  // Bounding box (expanded by feather) to avoid scanning the whole image.
  const minX = Math.max(0, Math.floor(geometry.x - feather - 1))
  const maxX = Math.min(width - 1, Math.ceil(geometry.x + geometry.width + feather + 1))
  const minY = Math.max(0, Math.floor(geometry.y - feather - 1))
  const maxY = Math.min(height - 1, Math.ceil(geometry.y + geometry.height + feather + 1))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = roundedBoxSDF(x + 0.5, y + 0.5, cx, cy, hx, hy, r)
      if (d >= feather) continue
      const t = smoothstep((feather - d) / (2 * feather))
      mask[y * width + x] = peak * t
    }
  }
  return mask
}

/** Bounding box (in pixels, clamped to media dims) that a mask actually touches. */
export function maskBounds(
  width: number,
  height: number,
  geometry: ResolvedGeometry,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const feather = Math.max(geometry.feather, 0.001)
  return {
    minX: Math.max(0, Math.floor(geometry.x - feather - 1)),
    minY: Math.max(0, Math.floor(geometry.y - feather - 1)),
    maxX: Math.min(width - 1, Math.ceil(geometry.x + geometry.width + feather + 1)),
    maxY: Math.min(height - 1, Math.ceil(geometry.y + geometry.height + feather + 1)),
  }
}
