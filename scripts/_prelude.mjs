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
