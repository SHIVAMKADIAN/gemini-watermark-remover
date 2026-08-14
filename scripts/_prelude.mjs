import { copyFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/**
 * E2E verification scripts build a synthetic MP4 in the browser using
 * Mediabunny's ESM browser bundle. The app itself imports Mediabunny through
 * Vite's module graph, but the *page context* in these tests needs a plain
 * URL to import. We copy the prebuilt bundle into public/ (served at the web
 * root) for the duration of the test only, and delete it afterwards so it
 * never ends up in the production build.
 */
export const BROWSER_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
export const BASE_URL = process.env.VERIFY_URL || 'http://localhost:5173/'
export const TEST_BUNDLE_URL = '/mediabunny-e2e.mjs'

const src = resolve(root, 'node_modules/mediabunny/dist/bundles/mediabunny.min.mjs')
const dest = resolve(root, 'public/mediabunny-e2e.mjs')

export function installTestBundle() {
  copyFileSync(src, dest)
}

export function removeTestBundle() {
  try {
    rmSync(dest)
  } catch {
    /* already gone */
  }
}

// Mirror of the app's fixed-pixel watermark geometry (src/profiles + registry)
// so E2E scripts can place a synthetic badge exactly where the app will mask.
const GEOMETRY = {
  gemini: { anchor: 'bottom-right', canonicalLongSide: 2816, logoSizePx: 96, minLogoPx: 36, marginPx: 192, paddingPx: 22 },
  omni: { anchor: 'bottom-right', canonicalLongSide: 1920, logoSizePx: 64, minLogoPx: 44, marginPx: 40, paddingPx: 16 },
  veo: { anchor: 'bottom-right', canonicalLongSide: 1920, logoSizePx: 48, minLogoPx: 40, marginPx: 44, paddingPx: 16 },
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Returns { x, y, width, height } of the watermark mask box for the app. */
export function watermarkBox(source, W, H) {
  const g = GEOMETRY[source]
  const scale = Math.max(W, H) / g.canonicalLongSide
  const logo = Math.max(g.minLogoPx, Math.round(g.logoSizePx * scale))
  const margin = Math.round(g.marginPx * scale)
  const pad = Math.round(g.paddingPx * scale)
  const size = Math.min(logo + 2 * pad, W, H)
  let x = W - margin - logo - pad
  let y = H - margin - logo - pad
  if (g.anchor === 'bottom-left') x = margin - pad
  return { x: clamp(x, 0, W - size), y: clamp(y, 0, H - size), width: size, height: size }
}
