'use client'

import { useCallback, useRef, useState } from 'react'
import type { MediaKind, Region } from '@/lib/types'

interface RegionSelectorProps {
  url: string
  kind: MediaKind
  region: Region | null
  onChange: (region: Region) => void
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Draw a rectangular removal region over the media (fractional coords). */
export function RegionSelector({ url, kind, region, onChange }: RegionSelectorProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x0: number; y0: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const toFrac = useCallback((clientX: number, clientY: number) => {
    const el = boxRef.current!
    const r = el.getBoundingClientRect()
    return { x: clamp01((clientX - r.left) / r.width), y: clamp01((clientY - r.top) / r.height) }
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const p = toFrac(e.clientX, e.clientY)
    drag.current = { x0: p.x, y0: p.y }
    setDragging(true)
    onChange({ x: p.x, y: p.y, w: 0, h: 0 })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const p = toFrac(e.clientX, e.clientY)
    const x = Math.min(drag.current.x0, p.x)
    const y = Math.min(drag.current.y0, p.y)
    const w = Math.abs(p.x - drag.current.x0)
    const h = Math.abs(p.y - drag.current.y0)
    onChange({ x, y, w, h })
  }

  const onPointerUp = () => {
    drag.current = null
    setDragging(false)
  }

  return (
    <div>
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative w-full cursor-crosshair select-none overflow-hidden rounded-xl border border-border-subtle bg-black"
        style={{ touchAction: 'none', maxHeight: '60vh' }}
      >
        {kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Upload preview" className="pointer-events-none block max-h-[60vh] w-full object-contain" />
        ) : (
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none block max-h-[60vh] w-full object-contain"
          />
        )}

        {region && region.w > 0 && region.h > 0 && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-accent bg-accent/15"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.w * 100}%`,
              height: `${region.h * 100}%`,
            }}
          />
        )}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {dragging
          ? 'Release to set the region.'
          : region && region.w > 0
            ? `Region: ${(region.w * 100).toFixed(0)}% × ${(region.h * 100).toFixed(0)}% — drag again to redraw.`
            : 'Drag a rectangle over the watermark or object to remove.'}
      </p>
    </div>
  )
}
