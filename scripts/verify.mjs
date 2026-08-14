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
// original grey value 100 everywhere; bottom-right region composited with white @ alpha 0.5.
// Gemini landscape default: marginX 0.022, marginY 0.028, width 0.16, height 0.075.
const dataUrl = await page.evaluate(async () => {
  const W = 640
  const H = 360
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const ORIGINAL = 100
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = ORIGINAL
    img.data[i + 1] = ORIGINAL
    img.data[i + 2] = ORIGINAL
    img.data[i + 3] = 255
  }
  // Composite white watermark at alpha 0.5 in the gemini landscape region.
  const wmW = 0.16 * W
  const wmH = 0.075 * H
  const wmX = W - 0.022 * W - wmW
  const wmY = H - 0.028 * H - wmH
  const alpha = 0.5
  for (let y = Math.floor(wmY); y < Math.ceil(wmY + wmH); y++) {
    for (let x = Math.floor(wmX); x < Math.ceil(wmX + wmW); x++) {
      const o = (y * W + x) * 4
      const composite = alpha * 255 + (1 - alpha) * ORIGINAL
      img.data[o] = composite
      img.data[o + 1] = composite
      img.data[o + 2] = composite
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
})

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
check('Notes mention deterministic reverse-alpha', (await page.getByText(/reverse-alpha/i).count()) > 0)
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

  // Sample a corner far from the watermark (should be untouched = 100).
  const cornerVal = data[(10 * W + 10) * 4]

  return { centerVal, cornerVal }
})

if (pixelCheck.error) {
  check('Pixel verification', false, pixelCheck.error)
} else {
  // Watermarked composite was 178; original 100. Cleaned center should move back toward 100.
  check(
    'Watermark region restored toward original (center << 178)',
    pixelCheck.centerVal < 140,
    `center=${pixelCheck.centerVal}, expected < 140 (was 178 watermarked, 100 original)`,
  )
  check(
    'Pixels outside watermark untouched (corner == 100)',
    Math.abs(pixelCheck.cornerVal - 100) <= 2,
    `corner=${pixelCheck.cornerVal}, expected ~100`,
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
