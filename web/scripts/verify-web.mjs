// Full-stack E2E: browser → Next.js → wmserver API → worker → result.
// Requires both servers running (web :3000, api :8000). Uses the repo-root
// Playwright + Chromium.
import { chromium } from 'playwright'

const BROWSER = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const WEB = process.env.WEB_URL || 'http://localhost:3000'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`)
}

const browser = await chromium.launch({ executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await browser.newContext().then((c) => c.newPage())
page.on('pageerror', (e) => console.log('  [page error]', e.message))

await page.goto(WEB, { waitUntil: 'networkidle' })
check('App renders', (await page.getByText('Remove watermarks & objects').count()) > 0)
check('API reported online', (await page.getByText('API online').count()) > 0)

// Upload the synthetic image (green ramp + red block at x 150-250 / y 100-200 of 400x300).
await page.locator('input[type=file]').first().setInputFiles('/tmp/webblock.png')
await page.getByText('Mark the region to remove').waitFor({ timeout: 8000 })
check('Region step shown after upload', true)

// Drag a box over the red block (fractions: x 0.375-0.625, y 0.333-0.667).
const canvas = page.locator('div.cursor-crosshair')
const box = await canvas.boundingBox()
const fx = (f) => box.x + box.width * f
const fy = (f) => box.y + box.height * f
await page.mouse.move(fx(0.37), fy(0.32))
await page.mouse.down()
await page.mouse.move(fx(0.5), fy(0.5))
await page.mouse.move(fx(0.64), fy(0.69))
await page.mouse.up()
check('Region drawn', (await page.getByText(/Region: /).count()) > 0)

// Submit and wait for the result.
await page.getByRole('button', { name: /Remove from image/ }).click()
await page.getByText('Download cleaned image').waitFor({ timeout: 30000 })
check('Job completed, result shown', true)
check('Backend label present', (await page.getByText(/backend:/).count()) > 0)

// Verify the cleaned image pixel at the block centre is no longer red.
// Fetch the result bytes via CORS (blob-sourced bitmap isn't canvas-tainted).
const px = await page.evaluate(async () => {
  const imgs = Array.from(document.querySelectorAll('img'))
  const src = imgs[imgs.length - 1].src // the Cleaned image = API result URL
  const blob = await fetch(src).then((r) => r.blob())
  const bmp = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const ctx = c.getContext('2d')
  ctx.drawImage(bmp, 0, 0)
  const cx = Math.round(bmp.width * 0.5)
  const cy = Math.round(bmp.height * 0.5)
  const d = ctx.getImageData(cx, cy, 1, 1).data
  return { r: d[0], g: d[1], b: d[2] }
})
check('Block removed at centre (not red)', !(px.r > 200 && px.g < 60 && px.b < 60), `rgb(${px.r},${px.g},${px.b})`)

await page.screenshot({ path: 'web/scripts/verify-web-shot.png', fullPage: true })
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
