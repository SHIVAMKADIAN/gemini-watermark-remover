import { chromium } from 'playwright'
import { BASE_URL, BROWSER_PATH } from './_prelude.mjs'

const browser = await chromium.launch({
  executablePath: BROWSER_PATH,
  args: ['--no-sandbox'],
})
const page = await browser.newContext().then((c) => c.newPage())
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [browser error]', msg.text())
})
page.on('pageerror', (err) => console.log('  [page error]', err.message))

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`)
}

await page.goto(BASE_URL, { waitUntil: 'networkidle' })

// --- Header / hero present ---
check('App shell renders', (await page.getByText('OmniClean').count()) > 0)
check('Hero heading present', (await page.getByRole('heading', { name: /Clean your Gemini/ }).count()) > 0)
check('Privacy note present', (await page.getByText(/Your media stays on your device/).count()) > 0)

// --- Build a synthetic watermarked PNG in-page ---
// This reproduces the reported failure case: a DARK background (grey 50, like a
// dark wall) with a BRIGHT watermark badge in the corner. Reverse-alpha would
// clamp this to black; content-aware fill must restore it to the ~50 wall.
// Gemini landscape default: marginX 0.022, marginY 0.028, width 0.16, height 0.075.
const BG = 50
const dataUrl = await page.evaluate(async (BG) => {
  const W = 640
  const H = 360
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = BG
    img.data[i + 1] = BG
    img.data[i + 2] = BG
    img.data[i + 3] = 255
  }
  // Bright watermark badge (value ~205) in the gemini landscape region.
  const wmW = 0.16 * W
  const wmH = 0.075 * H
  const wmX = W - 0.022 * W - wmW
  const wmY = H - 0.028 * H - wmH
  for (let y = Math.floor(wmY); y < Math.ceil(wmY + wmH); y++) {
    for (let x = Math.floor(wmX); x < Math.ceil(wmX + wmW); x++) {
      const o = (y * W + x) * 4
      img.data[o] = 205
      img.data[o + 1] = 205
      img.data[o + 2] = 205
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}, BG)

// Convert data URL to a File and drop into the input.
const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
const fileInput = page.locator('input[type=file]').first()
await fileInput.setInputFiles({ name: 'synthetic-gemini.png', mimeType: 'image/png', buffer })

// Media inspector should appear with correct resolution.
await page.getByText('Media information').waitFor({ timeout: 10000 })
check('Media inspector shows resolution', (await page.getByText('640 × 360').count()) > 0)

// Run cleanup.
await page.getByRole('button', { name: 'Clean image' }).click()

// Wait for the download card.
await page.getByText('Your cleaned file is ready').waitFor({ timeout: 20000 })
check('Cleanup completed and download card shown', true)
check('Notes mention deterministic content-aware fill', (await page.getByText(/content-aware fill/i).count()) > 0)
check('Notes mention dimensions preserved', (await page.getByText(/Original dimensions preserved/).count()) > 0)

// --- Pixel verification: fetch the cleaned image from the <img> in the compare view and inspect region pixels ---
const pixelCheck = await page.evaluate(async () => {
  const imgs = Array.from(document.querySelectorAll('img'))
  const cleaned = imgs.find((i) => i.alt === 'Cleaned result')
  if (!cleaned) return { error: 'cleaned image not found' }
  const W = 640
  const H = 360
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  await cleaned.decode()
  ctx.drawImage(cleaned, 0, 0, W, H)
  const data = ctx.getImageData(0, 0, W, H).data

  // Sample the center of the watermark region.
  const wmW = 0.16 * W
  const wmH = 0.075 * H
  const wmX = W - 0.022 * W - wmW
  const wmY = H - 0.028 * H - wmH
  const cx = Math.round(wmX + wmW / 2)
  const cy = Math.round(wmY + wmH / 2)
  const centerVal = data[(cy * W + cx) * 4]

  // Sample a corner far from the watermark (should be untouched = background).
  const cornerVal = data[(10 * W + 10) * 4]

  return { centerVal, cornerVal }
})

if (pixelCheck.error) {
  check('Pixel verification', false, pixelCheck.error)
} else {
  // The reported bug: cleaned region came out pure black (0). It must instead be
  // reconstructed to ~the dark wall (BG=50), i.e. the badge is gone but NOT black.
  check(
    'Watermark region is NOT a black box (regression)',
    pixelCheck.centerVal > 20,
    `center=${pixelCheck.centerVal}, must be > 20 (black-box bug produced 0)`,
  )
  check(
    'Watermark region reconstructed to background, badge removed',
    pixelCheck.centerVal >= 20 && pixelCheck.centerVal <= 90,
    `center=${pixelCheck.centerVal}, expected ~${BG} (badge was 205)`,
  )
  check(
    'Pixels outside watermark untouched (corner == background)',
    Math.abs(pixelCheck.cornerVal - BG) <= 2,
    `corner=${pixelCheck.cornerVal}, expected ~${BG}`,
  )
}

// --- Difference view works ---
await page.getByRole('tab', { name: 'Difference' }).click()
await page.getByText(/Difference amplified/).waitFor({ timeout: 5000 })
check('Difference view renders', true)

// --- Show processing mask toggle ---
await page.getByRole('tab', { name: 'Slider' }).click()
await page.getByLabel('Show processing mask').check()
check('Mask overlay toggle works', (await page.getByText('Restored region').count()) > 0)

// --- Tab navigation to video/batch ---
await page.getByRole('button', { name: 'Video' }).click()
await page.getByRole('heading', { name: /Clean your Gemini & Omni videos/ }).waitFor({ timeout: 5000 })
check('Video tab renders', true)

await page.getByRole('button', { name: 'Batch' }).click()
await page.getByRole('heading', { name: /Batch-clean/ }).waitFor({ timeout: 5000 })
check('Batch tab renders', true)

await page.screenshot({ path: 'scripts/verify-shot.png', fullPage: true })

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
