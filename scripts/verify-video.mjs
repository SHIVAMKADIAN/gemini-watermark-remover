import { chromium } from 'playwright'
import { BASE_URL, BROWSER_PATH, TEST_BUNDLE_URL, installTestBundle, removeTestBundle, watermarkBox } from './_prelude.mjs'

const VID_W = 1280
const VID_H = 720
const box = watermarkBox('omni', VID_W, VID_H) // where the app will mask

installTestBundle()
process.on('exit', removeTestBundle)

const browser = await chromium.launch({ executablePath: BROWSER_PATH, args: ['--no-sandbox'] })
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

// Build a real 1280x720 MP4 in-page with mediabunny: grey background (100) with a
// white watermark composited in the omni landscape bottom-right region, on every frame.
console.log('  building synthetic MP4 in-browser (WebCodecs H.264)...')
const b64 = await page.evaluate(async ({ BUNDLE_URL, box, W, H }) => {
  const mb = await import(BUNDLE_URL)
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality, canEncodeVideo } = mb
  // This headless Chromium lacks proprietary codecs (no H.264); pick a supported one.
  const codec = (await canEncodeVideo('avc')) ? 'avc' : (await canEncodeVideo('vp9')) ? 'vp9' : 'av1'

  const FPS = 30
  const DURATION = 1.5
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Watermark badge over the app's fixed-pixel omni mask box.
  const wmX = box.x
  const wmY = box.y
  const wmW = box.width
  const wmH = box.height

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec, bitrate: new Quality('high') })
  output.addVideoTrack(source)

  // Add an Opus audio track so we can verify passthrough (copy without re-encode).
  let audioAdded = false
  let audioSource = null
  if (await mb.canEncodeAudio('opus')) {
    const { AudioBufferSource } = mb
    audioSource = new AudioBufferSource({ codec: 'opus', bitrate: new Quality('medium') })
    output.addAudioTrack(audioSource)
    audioAdded = true
  }

  await output.start()

  if (audioAdded) {
    const sampleRate = 48000
    const actx = new OfflineAudioContext(1, sampleRate * DURATION, sampleRate)
    const ab = actx.createBuffer(1, sampleRate * DURATION, sampleRate)
    const ch = ab.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.2
    await audioSource.add(ab)
    audioSource.close()
  }

  const frames = Math.round(FPS * DURATION)
  for (let f = 0; f < frames; f++) {
    ctx.fillStyle = 'rgb(100,100,100)'
    ctx.fillRect(0, 0, W, H)
    // white @ alpha 0.5 => composite 178
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(wmX, wmY, wmW, wmH)
    await source.add(f / FPS, 1 / FPS)
  }
  source.close()
  await output.finalize()
  const buf = output.target.buffer
  // base64 encode
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return { data: btoa(binary), size: bytes.length, audioAdded }
}, { BUNDLE_URL: TEST_BUNDLE_URL, box, W: VID_W, H: VID_H })

if (b64.error) {
  check('Build synthetic MP4', false, b64.error)
  await browser.close()
  process.exit(1)
}
check('Built synthetic MP4 in-browser', true, `${b64.size} bytes`)

const buffer = Buffer.from(b64.data, 'base64')

// Switch to the Video tab.
await page.getByRole('button', { name: 'Video' }).click()
await page.getByRole('heading', { name: /Clean your Gemini & Omni videos/ }).waitFor({ timeout: 5000 })

// Upload.
await page.locator('input[type=file]').first().setInputFiles({
  name: 'synthetic-omni-720.mp4',
  mimeType: 'video/mp4',
  buffer,
})

// Metadata should appear.
await page.getByText('Media information').waitFor({ timeout: 15000 })
check('Video metadata read', (await page.getByText('1280 × 720').count()) > 0)
check('Frame rate detected', (await page.getByText(/fps/).count()) > 0)
if (b64.audioAdded) {
  check('Audio track detected in metadata', (await page.getByText('opus').count()) > 0)
}

// Process.
await page.getByRole('button', { name: 'Clean video' }).click()
await page.getByText('Your cleaned file is ready').waitFor({ timeout: 90000 })
check('Video cleanup completed', true)
check('Dimensions preserved note', (await page.getByText(/Original dimensions preserved \(1280 × 720\)/).count()) > 0)
check('Honest re-encode note present', (await page.getByText(/Not bit-for-bit identical/).count()) > 0)
if (b64.audioAdded) {
  check(
    'Audio copied through without re-encoding',
    (await page.getByText(/Audio stream copied through without re-encoding/).count()) > 0,
  )
}

// Verify the cleaned video's pixels: draw a frame to canvas and inspect the region.
const pixelCheck = await page.evaluate(
  async ({ W, H, box }) => {
    const videos = Array.from(document.querySelectorAll('video'))
    // the cleaned video is the muted one
    const cleaned = videos.find((v) => v.muted) || videos[0]
    if (!cleaned) return { error: 'no cleaned video element' }
    await new Promise((res) => {
      if (cleaned.readyState >= 2) return res()
      cleaned.addEventListener('loadeddata', () => res(), { once: true })
    })
    cleaned.currentTime = 0.5
    await new Promise((res) => cleaned.addEventListener('seeked', () => res(), { once: true }))

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.drawImage(cleaned, 0, 0, W, H)
    const data = ctx.getImageData(0, 0, W, H).data

    const cx = Math.round(box.x + box.width / 2)
    const cy = Math.round(box.y + box.height / 2)
    const centerVal = data[(cy * W + cx) * 4]
    const cornerVal = data[(100 * W + 100) * 4]
    return { centerVal, cornerVal }
  },
  { W: VID_W, H: VID_H, box },
)

if (pixelCheck.error) {
  check('Video pixel verification', false, pixelCheck.error)
} else {
  // Watermarked region ~178; original 100. Cleaned should move toward 100.
  // Allow tolerance for H.264 chroma/luma compression.
  check(
    'Watermark region restored in video (center < 150)',
    pixelCheck.centerVal < 150,
    `center=${pixelCheck.centerVal} (watermarked ~178, original 100)`,
  )
  check(
    'Video area outside watermark ~unchanged (corner near 100)',
    Math.abs(pixelCheck.cornerVal - 100) <= 12,
    `corner=${pixelCheck.cornerVal} (expected ~100, H.264 tolerance)`,
  )
}

await page.screenshot({ path: 'scripts/verify-video-shot.png', fullPage: true })
await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
