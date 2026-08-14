import { useEffect, useRef, useState } from 'react'

interface DiffViewProps {
  originalUrl: string
  cleanedUrl: string
  width: number
  height: number
  amplify?: number
}

/**
 * Renders an amplified absolute-difference image between original and cleaned
 * frames. Regions that are identical show as black; changed pixels glow. This
 * makes it obvious whether anything outside the watermark region was altered.
 */
export function DiffView({ originalUrl, cleanedUrl, width, height, amplify = 6 }: DiffViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [changedPixels, setChangedPixels] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const [a, b] = await Promise.all([loadBitmap(originalUrl), loadBitmap(cleanedUrl)])
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      ctx.drawImage(a, 0, 0, width, height)
      const origData = ctx.getImageData(0, 0, width, height)
      ctx.drawImage(b, 0, 0, width, height)
      const cleanData = ctx.getImageData(0, 0, width, height)
      a.close()
      b.close()

      const out = ctx.createImageData(width, height)
      let changed = 0
      for (let i = 0; i < origData.data.length; i += 4) {
        const dr = Math.abs(origData.data[i] - cleanData.data[i])
        const dg = Math.abs(origData.data[i + 1] - cleanData.data[i + 1])
        const db = Math.abs(origData.data[i + 2] - cleanData.data[i + 2])
        if (dr + dg + db > 3) changed++
        out.data[i] = Math.min(255, dr * amplify)
        out.data[i + 1] = Math.min(255, dg * amplify)
        out.data[i + 2] = Math.min(255, db * amplify)
        out.data[i + 3] = 255
      }
      ctx.putImageData(out, 0, 0)
      if (!cancelled) setChangedPixels(changed)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [originalUrl, cleanedUrl, width, height, amplify])

  return (
    <div>
      <div
        className="relative mx-auto w-full overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: `${width} / ${height}`, maxHeight: '60vh' }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Difference amplified ×{amplify}. Black means identical to the original.
        {changedPixels != null && (
          <> {changedPixels.toLocaleString()} pixels changed — all should lie inside the watermark region.</>
        )}
      </p>
    </div>
  )
}

function loadBitmap(url: string): Promise<ImageBitmap> {
  return fetch(url)
    .then((r) => r.blob())
    .then((blob) => createImageBitmap(blob))
}
