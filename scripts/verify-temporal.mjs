import { chromium } from 'playwright'
import { BASE_URL, BROWSER_PATH, TEST_BUNDLE_URL, installTestBundle, removeTestBundle, watermarkBox } from './_prelude.mjs'

installTestBundle()
process.on('exit', removeTestBundle)

const VID_W = 1280
const VID_H = 720
const PAN = 5 // px/frame background pan → reveals background behind a static mark
const box = watermarkBox('omni', VID_W, VID_H)

const browser = await chromium.launch({ executablePath: BROWSER_PATH, args: ['--no-sandbox'] })
const page = await browser.newContext().then((c) => c.newPage())
page.on('pageerror', (e) => console.log('  [page error]', e.message))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`)
}

await page.goto(BASE_URL, { waitUntil: 'networkidle' })

console.log('  building a panning textured MP4 with a static mark…')
const b64 = await page.evaluate(
  async ({ BUNDLE_URL, box, W, H, PAN }) => {
    const mb = await import(BUNDLE_URL)
    const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality, canEncodeVideo } = mb
    const codec = (await canEncodeVideo('avc')) ? 'avc' : (await canEncodeVideo('vp9')) ? 'vp9' : 'av1'
    const FPS = 30
    const FRAMES = 45

    // Pre-render a "world" wider than the frame; each frame is a panning crop.
    const worldW = W + PAN * FRAMES + 4
    const world = document.createElement('canvas')
    world.width = worldW
    world.height = H
    const wctx = world.getContext('2d')
    const grad = wctx.createLinearGradient(0, 0, worldW, H)
    grad.addColorStop(0, '#20303a')
    grad.addColorStop(1, '#402838')
    wctx.fillStyle = grad
    wctx.fillRect(0, 0, worldW, H)
    let seed = 12345
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let i = 0; i < 900; i++) {
      wctx.fillStyle = `hsl(${Math.floor(rand() * 360)}, 70%, ${30 + Math.floor(rand() * 50)}%)`
      const rw = 6 + rand() * 26
      const rh = 6 + rand() * 26
      wctx.fillRect(rand() * worldW, rand() * H, rw, rh)
    }

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
    const source = new CanvasSource(canvas, { codec, bitrate: new Quality('high') })
    output.addVideoTrack(source)
    await output.start()

    for (let f = 0; f < FRAMES; f++) {
      ctx.drawImage(world, -f * PAN, 0)
      // Static opaque mark over the mask box (bright cyan — unlike the scene).
      ctx.fillStyle = 'rgb(0,255,255)'
      ctx.fillRect(box.x, box.y, box.width, box.height)
      await source.add(f / FPS, 1 / FPS)
    }
    source.close()
    await output.finalize()
    const bytes = new Uint8Array(output.target.buffer)
    let s = ''
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
    return btoa(s)
  },
  { BUNDLE_URL: TEST_BUNDLE_URL, box, W: VID_W, H: VID_H, PAN },
)
const buffer = Buffer.from(b64, 'base64')
check('Built panning MP4', buffer.length > 0, `${buffer.length} bytes`)

await page.getByRole('button', { name: 'Video' }).click()
await page.getByRole('heading', { name: /Clean your Gemini & Omni videos/ }).waitFor({ timeout: 5000 })
await page.locator('input[type=file]').first().setInputFiles({ name: 'pan.mp4', mimeType: 'video/mp4', buffer })
await page.getByText('Media information').waitFor({ timeout: 20000 })

// Select the Temporal engine.
await page.getByRole('button', { name: /Temporal/ }).click()
check('Temporal engine selectable', (await page.getByRole('button', { name: /Temporal/ }).getAttribute('aria-pressed')) === 'true')

await page.getByRole('button', { name: 'Clean video' }).click()
await page.getByText('Your cleaned file is ready').waitFor({ timeout: 180000 })
check('Temporal cleanup completed', true)

// Coverage note should report a meaningful temporal fraction.
const noteText = (await page.getByText(/Temporal engine:/).textContent()) ?? ''
const cov = Number((noteText.match(/(\d+)%/) ?? [])[1] ?? '0')
check('Coverage note present', (await page.getByText(/Temporal engine:/).count()) > 0, noteText.trim())
check('Most masked pixels retrieved from other frames', cov >= 40, `coverage=${cov}%`)

// Pixel: the mask centre should no longer be the cyan mark.
const px = await page.evaluate(
  async ({ W, H, box }) => {
    const videos = Array.from(document.querySelectorAll('video'))
    const cleaned = videos.find((v) => v.muted) || videos[0]
    if (!cleaned) return { error: 'no cleaned video' }
    await new Promise((res) => {
      if (cleaned.readyState >= 2) return res()
      cleaned.addEventListener('loadeddata', () => res(), { once: true })
    })
    cleaned.currentTime = 0.7
    await new Promise((res) => cleaned.addEventListener('seeked', () => res(), { once: true }))
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.drawImage(cleaned, 0, 0, W, H)
    const d = ctx.getImageData(0, 0, W, H).data
    const cx = Math.round(box.x + box.width / 2)
    const cy = Math.round(box.y + box.height / 2)
    const o = (cy * W + cx) * 4
    return { r: d[o], g: d[o + 1], b: d[o + 2] }
  },
  { W: VID_W, H: VID_H, box },
)
if (px.error) {
  check('Mark removed', false, px.error)
} else {
  // Cyan mark is (0,255,255): high G+B, low R. Background is warm/varied.
  const isCyan = px.r < 90 && px.g > 170 && px.b > 170
  check('Static mark removed at mask centre', !isCyan, `rgb(${px.r},${px.g},${px.b})`)
}

await page.screenshot({ path: 'scripts/verify-temporal-shot.png', fullPage: true })
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
