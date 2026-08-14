import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { WatermarkRegionOverride } from '../types'

interface WatermarkRegionEditorProps {
  previewUrl: string
  mediaKind: 'image' | 'video'
  mediaWidth: number
  mediaHeight: number
  initialRegion: WatermarkRegionOverride
  onSave: (region: WatermarkRegionOverride) => void
  onResetToDefault: () => void
  onClose: () => void
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

export function WatermarkRegionEditor({
  previewUrl,
  mediaKind,
  mediaWidth,
  mediaHeight,
  initialRegion,
  onSave,
  onResetToDefault,
  onClose,
}: WatermarkRegionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [region, setRegion] = useState<WatermarkRegionOverride>(initialRegion)
  const dragState = useRef<{
    mode: 'move' | 'resize'
    startX: number
    startY: number
    startRegion: WatermarkRegionOverride
  } | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onLoaded = () => {
      video.currentTime = Math.min(0.1, video.duration / 2)
    }
    video.addEventListener('loadedmetadata', onLoaded)
    return () => video.removeEventListener('loadedmetadata', onLoaded)
  }, [])

  function beginDrag(e: ReactPointerEvent, mode: 'move' | 'resize') {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragState.current = { mode, startX: e.clientX, startY: e.clientY, startRegion: region }
  }

  function onPointerMove(e: ReactPointerEvent) {
    const ds = dragState.current
    const box = containerRef.current
    if (!ds || !box) return
    const rect = box.getBoundingClientRect()
    const dxFrac = (e.clientX - ds.startX) / rect.width
    const dyFrac = (e.clientY - ds.startY) / rect.height

    if (ds.mode === 'move') {
      const maxX = 1 - ds.startRegion.widthFrac
      const maxY = 1 - ds.startRegion.heightFrac
      setRegion({
        ...ds.startRegion,
        xFrac: clamp01(Math.min(maxX, Math.max(0, ds.startRegion.xFrac + dxFrac))),
        yFrac: clamp01(Math.min(maxY, Math.max(0, ds.startRegion.yFrac + dyFrac))),
      })
    } else {
      const maxWidth = 1 - ds.startRegion.xFrac
      const maxHeight = 1 - ds.startRegion.yFrac
      setRegion({
        ...ds.startRegion,
        widthFrac: Math.min(maxWidth, Math.max(0.03, ds.startRegion.widthFrac + dxFrac)),
        heightFrac: Math.min(maxHeight, Math.max(0.03, ds.startRegion.heightFrac + dyFrac)),
      })
    }
  }

  function endDrag() {
    dragState.current = null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adjust watermark region"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">Adjust watermark region</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring rounded-lg p-1 text-text-muted hover:text-text-primary"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-text-muted">
          Drag the box over the watermark, and drag its bottom-right corner to resize. This calibrates the
          restoration region against your actual export — the default position is a best-effort estimate.
        </p>

        <div
          ref={containerRef}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          className="relative mx-auto w-full select-none overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: `${mediaWidth} / ${mediaHeight}`, touchAction: 'none' }}
        >
          {mediaKind === 'image' ? (
            <img src={previewUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-fill" />
          ) : (
            <video
              ref={videoRef}
              src={previewUrl}
              muted
              playsInline
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            />
          )}

          <div
            onPointerDown={(e) => beginDrag(e, 'move')}
            className="absolute cursor-move rounded-md border-2 border-dashed border-accent bg-accent/20"
            style={{
              left: `${region.xFrac * 100}%`,
              top: `${region.yFrac * 100}%`,
              width: `${region.widthFrac * 100}%`,
              height: `${region.heightFrac * 100}%`,
            }}
          >
            <div
              onPointerDown={(e) => beginDrag(e, 'resize')}
              aria-hidden="true"
              className="absolute -right-1.5 -bottom-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-surface-0 bg-accent"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onResetToDefault}
            className="focus-ring rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
          >
            Reset to profile default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-lg border border-border-subtle px-3.5 py-1.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(region)}
              className="focus-ring rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-surface-0 hover:bg-accent-strong"
            >
              Save region
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
