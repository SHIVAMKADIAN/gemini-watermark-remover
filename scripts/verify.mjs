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
// This reproduces the reported failure case: a TEXTURED background (sharp
// vertical stripes) with a bright watermark badge in the corner. A blur/
// diffusion fill would smear the stripes to a flat mid-grey; the exemplar fill
// must reconstruct the crisp stripe texture instead.
// Gemini landscape default: marginX 0.022, marginY 0.028, width 0.16, height 0.075.
const dataUrl = await page.evaluate(async () => {
  const W = 640
  const H = 360
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  // Sharp vertical-stripe texture (period 8): dark 40 / bright 210. A blur would
  // smear this to a uniform mid-grey — exemplar fill must keep it bimodal.
  const stripe = (x) => ((x >> 2) % 2 === 0 ? 40 : 210)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      const v = stripe(x)
      img.data[o] = v
      img.data[o + 1] = v
      img.data[o + 2] = v
      img.data[o + 3] = 255
    }
  }
  // Solid bright watermark badge over the stripes in the gemini landscape region.
  const wmW = 0.16 * W
  const wmH = 0.075 * H
  const wmX = W - 0.022 * W - wmW
  const wmY = H - 0.028 * H - wmH
  for (let y = Math.floor(wmY); y < Math.ceil(wmY + wmH); y++) {
    for (let x = Math.floor(wmX); x < Math.ceil(wmX + wmW); x++) {
      const o = (y * W + x) * 4
      img.data[o] = 245
      img.data[o + 1] = 245
      img.data[o + 2] = 245
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
check('Notes mention deterministic exemplar-based fill', (await page.getByText(/exemplar-based fill/i).count()) > 0)
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

  // Sample a corner far from the watermark (should be untouched stripe).
  const cornerVal = data[(10 * W + 10) * 4]

  // Measure how many reconstructed pixels are a blurred mid-grey vs. crisp stripe.
  let mid = 0
  let total = 0
  for (let y = Math.floor(wmY) + 2; y < wmY + wmH - 2; y++) {
    for (let x = Math.floor(wmX) + 2; x < wmX + wmW - 2; x++) {
      const v = data[(y * W + x) * 4]
      const nearDark = Math.abs(v - 40) < 50
      const nearBright = Math.abs(v - 210) < 50
      if (!nearDark && !nearBright) mid++
      total++
    }
  }
  return { centerVal, cornerVal, midFraction: mid / total }
})

if (pixelCheck.error) {
  check('Pixel verification', false, pixelCheck.error)
} else {
  // The reported bug: the region came out as a blurred smudge. Exemplar fill must
  // reconstruct the crisp stripe texture, so most pixels are near a stripe value
  // (40 or 210), NOT a blurred mid-grey.
  check(
    'Watermark badge removed (center no longer the 245 badge)',
    pixelCheck.centerVal < 235,
    `center=${pixelCheck.centerVal}, badge was 245`,
  )
  check(
    'Texture preserved, region is NOT blurred to mid-grey',
    pixelCheck.midFraction < 0.25,
    `blurred fraction=${pixelCheck.midFraction.toFixed(2)}, must be < 0.25 (a blur fill would be ~1.0)`,
  )
  check(
    'Pixels outside watermark untouched (corner stripe intact)',
    pixelCheck.cornerVal === 40 || pixelCheck.cornerVal === 210,
    `corner=${pixelCheck.cornerVal}, expected a crisp stripe value`,
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
