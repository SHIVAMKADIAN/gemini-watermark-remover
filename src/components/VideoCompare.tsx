import { useCallback, useEffect, useRef, useState } from 'react'
import { useCompareSlider } from '../hooks/useCompareSlider'
import { formatDuration } from '../utils/format'
import { cn } from '../utils/cn'
import { CompareDivider } from './CompareDivider'
import { MaskOverlay } from './MaskOverlay'
import type { MaskGeometryPixels } from '../workers/imageWorker.types'

type ViewMode = 'slider' | 'original' | 'cleaned'

interface VideoCompareProps {
  originalUrl: string
  cleanedUrl: string
  width: number
  height: number
  fps: number
  geometry: MaskGeometryPixels | null
  showMask: boolean
}

const VIEW_TABS: Array<{ id: ViewMode; label: string }> = [
  { id: 'slider', label: 'Slider' },
  { id: 'original', label: 'Original' },
  { id: 'cleaned', label: 'Cleaned' },
]

export function VideoCompare({ originalUrl, cleanedUrl, width, height, fps, geometry, showMask }: VideoCompareProps) {
  const origRef = useRef<HTMLVideoElement>(null)
  const cleanRef = useRef<HTMLVideoElement>(null)
  const [view, setView] = useState<ViewMode>('slider')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const slider = useCompareSlider()

  const frameStep = 1 / (fps > 0 ? fps : 30)
  const totalFrames = Math.max(1, Math.round(duration * fps))
  const currentFrame = Math.min(totalFrames, Math.round(currentTime * fps) + 1)

  // Keep the cleaned (muted) video mirroring the original's clock.
  const syncClean = useCallback(() => {
    const orig = origRef.current
    const clean = cleanRef.current
    if (!orig || !clean) return
    if (Math.abs(clean.currentTime - orig.currentTime) > 0.04) {
      clean.currentTime = orig.currentTime
    }
  }, [])

  useEffect(() => {
    const orig = origRef.current
    if (!orig) return
    const onTime = () => {
      setCurrentTime(orig.currentTime)
      syncClean()
    }
    const onLoaded = () => setDuration(orig.duration)
    const onPlay = () => {
      setIsPlaying(true)
      void cleanRef.current?.play().catch(() => {})
    }
    const onPause = () => {
      setIsPlaying(false)
      cleanRef.current?.pause()
      syncClean()
    }
    orig.addEventListener('timeupdate', onTime)
    orig.addEventListener('loadedmetadata', onLoaded)
    orig.addEventListener('play', onPlay)
    orig.addEventListener('pause', onPause)
    orig.addEventListener('seeked', syncClean)
    return () => {
      orig.removeEventListener('timeupdate', onTime)
      orig.removeEventListener('loadedmetadata', onLoaded)
      orig.removeEventListener('play', onPlay)
      orig.removeEventListener('pause', onPause)
      orig.removeEventListener('seeked', syncClean)
    }
  }, [syncClean])

  const togglePlay = () => {
    const orig = origRef.current
    if (!orig) return
    if (orig.paused) void orig.play().catch(() => {})
    else orig.pause()
  }

  const seek = (time: number) => {
    const orig = origRef.current
    const clean = cleanRef.current
    if (!orig || !clean) return
    const clamped = Math.min(duration || orig.duration, Math.max(0, time))
    orig.pause()
    orig.currentTime = clamped
    clean.currentTime = clamped
    setCurrentTime(clamped)
  }

  const stepFrame = (dir: -1 | 1) => seek(currentTime + dir * frameStep)
  const restart = () => seek(0)

  return (
    <section aria-label="Before and after comparison" className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-text-primary">Compare</h2>
        <div className="flex gap-1 rounded-full border border-border-subtle bg-surface-2 p-1" role="tablist">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => setView(tab.id)}
              className={cn(
                'focus-ring rounded-full px-3 py-1 text-xs font-medium transition-colors',
                view === tab.id ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={slider.containerRef}
        onPointerMove={slider.onPointerMove}
        onPointerUp={slider.onPointerUp}
        className="relative mx-auto w-full overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: `${width} / ${height}`, maxHeight: '58vh' }}
      >
        <video
          ref={cleanRef}
          src={cleanedUrl}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-contain"
        />
        {view !== 'cleaned' && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={view === 'slider' ? { clipPath: `inset(0 ${(1 - slider.position) * 100}% 0 0)` } : undefined}
          >
            <video
              ref={origRef}
              src={originalUrl}
              playsInline
              preload="auto"
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
        )}
        {/* When only viewing cleaned, we still need the original element mounted for the clock. */}
        {view === 'cleaned' && (
          <video ref={origRef} src={originalUrl} playsInline preload="auto" className="pointer-events-none absolute h-px w-px opacity-0" />
        )}

        {showMask && (
          <div className="absolute inset-0">
            <MaskOverlay geometry={geometry} mediaWidth={width} mediaHeight={height} label="Restored region" />
          </div>
        )}

        {view === 'slider' && (
          <>
            <CompareDivider position={slider.position} onPointerDown={slider.onPointerDown} onKeyDown={slider.onKeyDown} />
            <span className="absolute top-2 left-2 rounded bg-surface-3/85 px-1.5 py-0.5 text-[10px] font-medium text-text-primary">
              Original
            </span>
            <span className="absolute top-2 right-2 rounded bg-surface-3/85 px-1.5 py-0.5 text-[10px] font-medium text-text-primary">
              Cleaned
            </span>
          </>
        )}
      </div>

      <div className="mt-4">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="any"
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Timeline"
          className="focus-ring h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <IconButton label="Restart" onClick={restart}>
              <path d="M5 5v10M8 10l7-5v10l-7-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </IconButton>
            <IconButton label="Previous frame" onClick={() => stepFrame(-1)}>
              <path d="M13 5 7 10l6 5V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M6 5v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </IconButton>
            <IconButton label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay} primary>
              {isPlaying ? (
                <path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M6 4.5 15.5 10 6 15.5v-11Z" fill="currentColor" />
              )}
            </IconButton>
            <IconButton label="Next frame" onClick={() => stepFrame(1)}>
              <path d="M7 5l6 5-6 5V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M14 5v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </IconButton>
          </div>
          <div className="flex items-center gap-4 text-xs tabular-nums text-text-secondary">
            <span>
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
            <span className="text-text-muted">
              Frame {currentFrame.toLocaleString()} / {totalFrames.toLocaleString()}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">
          Pause and use the frame buttons to inspect the watermark region for artifacts. Frame stepping is approximate
          (based on average frame rate).
        </p>
      </div>
    </section>
  )
}

function IconButton({
  label,
  onClick,
  children,
  primary,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'focus-ring flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
        primary
          ? 'bg-accent text-surface-0 hover:bg-accent-strong'
          : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
      )}
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
        {children}
      </svg>
    </button>
  )
}
