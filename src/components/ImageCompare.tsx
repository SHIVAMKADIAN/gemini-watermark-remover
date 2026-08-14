import { useState } from 'react'
import { useCompareSlider } from '../hooks/useCompareSlider'
import { cn } from '../utils/cn'
import { CompareDivider } from './CompareDivider'
import { DiffView } from './DiffView'
import { MaskOverlay } from './MaskOverlay'
import type { MaskGeometryPixels } from '../workers/imageWorker.types'

type ViewMode = 'slider' | 'original' | 'cleaned' | 'difference'

interface ImageCompareProps {
  originalUrl: string
  cleanedUrl: string
  width: number
  height: number
  geometry: MaskGeometryPixels | null
  showMask: boolean
}

const VIEW_TABS: Array<{ id: ViewMode; label: string }> = [
  { id: 'slider', label: 'Slider' },
  { id: 'original', label: 'Original' },
  { id: 'cleaned', label: 'Cleaned' },
  { id: 'difference', label: 'Difference' },
]

export function ImageCompare({ originalUrl, cleanedUrl, width, height, geometry, showMask }: ImageCompareProps) {
  const [view, setView] = useState<ViewMode>('slider')
  const slider = useCompareSlider()

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

      {view === 'difference' ? (
        <DiffView originalUrl={originalUrl} cleanedUrl={cleanedUrl} width={width} height={height} />
      ) : (
        <div
          ref={slider.containerRef}
          onPointerMove={slider.onPointerMove}
          onPointerUp={slider.onPointerUp}
          className="relative mx-auto w-full overflow-hidden rounded-xl bg-[repeating-conic-gradient(#1a1d27_0_25%,#141720_0_50%)] bg-[length:24px_24px]"
          style={{ aspectRatio: `${width} / ${height}`, maxHeight: '60vh' }}
        >
          <img src={cleanedUrl} alt="Cleaned result" className="absolute inset-0 h-full w-full object-contain" />

          {view !== 'cleaned' && (
            <div
              className="absolute inset-0 overflow-hidden"
              style={view === 'slider' ? { clipPath: `inset(0 ${(1 - slider.position) * 100}% 0 0)` } : undefined}
            >
              <img src={originalUrl} alt="Original" className="absolute inset-0 h-full w-full object-contain" />
            </div>
          )}

          {showMask && (
            <div className="absolute inset-0">
              <MaskOverlay geometry={geometry} mediaWidth={width} mediaHeight={height} label="Restored region" />
            </div>
          )}

          {view === 'slider' && (
            <CompareDivider position={slider.position} onPointerDown={slider.onPointerDown} onKeyDown={slider.onKeyDown} />
          )}

          {view === 'slider' && (
            <>
              <span className="absolute top-2 left-2 rounded bg-surface-3/85 px-1.5 py-0.5 text-[10px] font-medium text-text-primary">
                Original
              </span>
              <span className="absolute top-2 right-2 rounded bg-surface-3/85 px-1.5 py-0.5 text-[10px] font-medium text-text-primary">
                Cleaned
              </span>
            </>
          )}
        </div>
      )}
    </section>
  )
}
