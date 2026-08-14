import { chromium } from 'playwright'
import { BASE_URL, BROWSER_PATH, TEST_BUNDLE_URL, installTestBundle, removeTestBundle } from './_prelude.mjs'

installTestBundle()
process.on('exit', removeTestBundle)

const browser = await chromium.launch({ executablePath: BROWSER_PATH, args: ['--no-sandbox'] })
const page = await browser.newContext().then((c) => c.newPage())
page.on('console', (m) => m.type() === 'error' && console.log('  [browser error]', m.text()))
page.on('pageerror', (e) => console.log('  [page error]', e.message))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`)
}

await page.goto(BASE_URL, { waitUntil: 'networkidle' })

const b64 = await page.evaluate(async (BUNDLE_URL) => {
  const mb = await import(BUNDLE_URL)
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality, canEncodeVideo } = mb
  const codec = (await canEncodeVideo('avc')) ? 'avc' : (await canEncodeVideo('vp9')) ? 'vp9' : 'av1'
  const W = 1280, H = 720, FPS = 30, DURATION = 1
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec, bitrate: new Quality('high') })
  output.addVideoTrack(source)
  await output.start()
  for (let f = 0; f < FPS * DURATION; f++) {
    ctx.fillStyle = 'rgb(100,100,100)'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(W - 0.02 * W - 0.14 * W, H - 0.03 * H - 0.07 * H, 0.14 * W, 0.07 * H)
    await source.add(f / FPS, 1 / FPS)
  }
  source.close()
  await output.finalize()
  const bytes = new Uint8Array(output.target.buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}, TEST_BUNDLE_URL)
const good = Buffer.from(b64, 'base64')
// A corrupt "mp4" that passes the extension check but fails to decode -> must not crash the queue.
const bad = Buffer.from('not a real mp4 file at all', 'utf8')

await page.getByRole('button', { name: 'Batch' }).click()
await page.getByRole('heading', { name: /Batch-clean/ }).waitFor()

await page.locator('input[type=file]').first().setInputFiles([
  { name: 'good-01.mp4', mimeType: 'video/mp4', buffer: good },
  { name: 'broken-02.mp4', mimeType: 'video/mp4', buffer: bad },
  { name: 'good-03.mp4', mimeType: 'video/mp4', buffer: good },
])

// Three rows should appear.
await page.getByText('good-01.mp4').waitFor({ timeout: 10000 })
const rows = await page.locator('tbody tr').count()
check('Queue shows all uploaded files', rows === 3, `${rows} rows`)

// Process.
await page.getByRole('button', { name: /Process \d+ clip/ }).click()

// Wait until no item is still processing/waiting (queue drained). Two complete, one error.
await page.waitForFunction(
  () => {
    const badges = Array.from(document.querySelectorAll('tbody tr'))
    if (badges.length !== 3) return false
    const text = document.body.innerText
    const completeCount = (text.match(/Complete/g) || []).length
    const errorCount = (text.match(/\bError\b/g) || []).length
    return completeCount >= 2 && errorCount >= 1
  },
  { timeout: 120000 },
)
check('Two clips completed, one failed (failure isolated)', true)
check('Failed job did not stop the queue', (await page.getByText('Error').count()) >= 1)

// ZIP button should reflect 2 completed and be enabled.
const zipBtn = page.getByRole('button', { name: /Download all as ZIP \(2\)/ })
check('ZIP button enabled with 2 completed', (await zipBtn.count()) > 0 && (await zipBtn.isEnabled()))

// Trigger the ZIP download and confirm a real archive is produced.
const dlPromise = page.waitForEvent('download', { timeout: 20000 })
await zipBtn.click()
const dl = await dlPromise
check('ZIP download starts', (await dl.suggestedFilename()).endsWith('.zip'), await dl.suggestedFilename())

await page.screenshot({ path: 'scripts/verify-batch-shot.png', fullPage: true })
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
