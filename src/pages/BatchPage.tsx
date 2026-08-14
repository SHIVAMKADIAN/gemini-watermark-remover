import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import JSZip from 'jszip'
import { CleanupControls } from '../components/CleanupControls'
import { ErrorBanner } from '../components/ErrorBanner'
import { Hero } from '../components/Hero'
import { PrivacyNote } from '../components/PrivacyNote'
import { UploadDropzone } from '../components/UploadDropzone'
import { queueReducer, STATUS_LABELS, type QueueItem } from '../hooks/batchQueue'
import { readVideoMetadata } from '../processing/video/metadata'
import type { WatermarkSource } from '../profiles/types'
import { MediaValidationError, type CleanupMode } from '../types'
import { formatBytes, formatDuration, formatResolution } from '../utils/format'
import { isSupportedVideoResolution, validateVideoFile } from '../utils/fileValidation'
import { createTrackedObjectUrl, revokeTrackedObjectUrl } from '../utils/objectUrl'
import { cn } from '../utils/cn'
import type { MaskGeometryPixels } from '../workers/imageWorker.types'
import type { VideoWorkerRequest, VideoWorkerResponse } from '../workers/videoWorker.types'

const SOURCE_OPTIONS = [
  { id: 'omni' as const, label: 'Gemini Omni' },
  { id: 'veo' as const, label: 'Google Flow / Veo' },
]

function processOne(
  file: File,
  source: WatermarkSource,
  mode: CleanupMode,
  onProgress: (progress: number, message: string) => void,
): Promise<{ blob: Blob; fps: number; duration: number; audioPreserved: boolean; geometry: MaskGeometryPixels | null }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/videoWorker.ts', import.meta.url), { type: 'module' })
    const id = crypto.randomUUID()
    worker.onmessage = (ev: MessageEvent<VideoWorkerResponse>) => {
      const msg = ev.data
      if (msg.id !== id) return
      if (msg.type === 'progress') {
        onProgress(msg.progress, msg.message)
      } else if (msg.type === 'success') {
        worker.terminate()
        resolve({ blob: msg.blob, fps: msg.fps, duration: msg.duration, audioPreserved: msg.audioPreserved, geometry: msg.geometry })
      } else if (msg.type === 'error') {
        worker.terminate()
        reject(new Error(msg.message))
      }
    }
    worker.onerror = () => {
      worker.terminate()
      reject(new Error('Processing failed. Your original file has not been modified.'))
    }
    const req: VideoWorkerRequest = { id, file, source, mode, override: null }
    worker.postMessage(req)
  })
}

export function BatchPage() {
  const [items, dispatch] = useReducer(queueReducer, [])
  const [source, setSource] = useState<WatermarkSource>('omni')
  const [mode, setMode] = useState<CleanupMode>('auto')
  const [isRunning, setIsRunning] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const itemsRef = useRef<QueueItem[]>(items)
  itemsRef.current = items

  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) {
        revokeTrackedObjectUrl(it.originalUrl)
        revokeTrackedObjectUrl(it.resultUrl)
      }
    }
  }, [])

  const handleFiles = useCallback(async (files: File[]) => {
    setValidationError(null)
    const valid: File[] = []
    for (const file of files) {
      try {
        validateVideoFile(file)
        valid.push(file)
      } catch (err) {
        const message = err instanceof MediaValidationError ? err.message : `${file.name} is not a supported MP4.`
        setValidationError(message)
      }
    }
    if (valid.length === 0) return
    dispatch({ type: 'add', files: valid })
  }, [])

  // Read metadata for any items missing it.
  useEffect(() => {
    for (const it of items) {
      if (it.width == null && it.status === 'waiting') {
        void (async () => {
          try {
            const meta = await readVideoMetadata(it.file)
            const url = createTrackedObjectUrl(it.file)
            dispatch({
              type: 'setMeta',
              id: it.id,
              width: meta.width,
              height: meta.height,
              fps: meta.fps,
              duration: meta.duration,
              originalUrl: url,
            })
          } catch {
            dispatch({ type: 'error', id: it.id, error: 'Could not read video metadata.' })
          }
        })()
      }
    }
  }, [items])

  const runQueue = useCallback(async () => {
    setIsRunning(true)
    // Process sequentially so we never hold multiple decoded videos in memory.
    for (const snapshot of itemsRef.current) {
      const current = itemsRef.current.find((i) => i.id === snapshot.id)
      if (!current || current.status !== 'waiting') continue
      dispatch({ type: 'start', id: current.id })
      try {
        const res = await processOne(current.file, source, mode, (progress, message) =>
          dispatch({ type: 'progress', id: current.id, progress, message }),
        )
        const url = createTrackedObjectUrl(res.blob)
        dispatch({
          type: 'complete',
          id: current.id,
          blob: res.blob,
          url,
          fps: res.fps,
          duration: res.duration,
          audioPreserved: res.audioPreserved,
          geometry: res.geometry,
        })
      } catch (err) {
        // Failure of one item must not stop the rest of the queue.
        dispatch({ type: 'error', id: current.id, error: err instanceof Error ? err.message : 'Processing failed.' })
      }
    }
    setIsRunning(false)
  }, [source, mode])

  const downloadItem = useCallback((it: QueueItem) => {
    if (!it.resultBlob) return
    const url = URL.createObjectURL(it.resultBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${it.file.name.replace(/\.[^.]+$/, '')}-cleaned.mp4`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }, [])

  const downloadZip = useCallback(async () => {
    const done = itemsRef.current.filter((it) => it.status === 'complete' && it.resultBlob)
    if (done.length === 0) return
    setZipping(true)
    try {
      const zip = new JSZip()
      // Add blobs one at a time; JSZip streams them at generate time.
      for (const it of done) {
        zip.file(`${it.file.name.replace(/\.[^.]+$/, '')}-cleaned.mp4`, it.resultBlob!)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'omniclean-batch.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 8000)
    } finally {
      setZipping(false)
    }
  }, [])

  const removeItem = useCallback((it: QueueItem) => {
    revokeTrackedObjectUrl(it.originalUrl)
    revokeTrackedObjectUrl(it.resultUrl)
    dispatch({ type: 'remove', id: it.id })
  }, [])

  const clearAll = useCallback(() => {
    for (const it of itemsRef.current) {
      revokeTrackedObjectUrl(it.originalUrl)
      revokeTrackedObjectUrl(it.resultUrl)
    }
    dispatch({ type: 'clear' })
  }, [])

  const waitingCount = items.filter((i) => i.status === 'waiting').length
  const completeCount = items.filter((i) => i.status === 'complete').length

  return (
    <div className="mx-auto max-w-4xl px-6 pb-24">
      <Hero
        title="Batch-clean your Gemini & Omni videos."
        subtitle="Queue multiple MP4 clips and process them one at a time, locally. Failed clips never stop the rest of the queue."
      />

      <div className="space-y-5">
        <PrivacyNote />

        <UploadDropzone
          accept="video/mp4,.mp4"
          multiple
          formatsLabel="Multiple MP4 files · 720p or 1080p"
          onFiles={handleFiles}
          disabled={isRunning}
        />

        {validationError && <ErrorBanner message={validationError} onDismiss={() => setValidationError(null)} />}

        {items.length > 0 && (
          <>
            <CleanupControls
              source={source}
              onSourceChange={setSource}
              mode={mode}
              onModeChange={setMode}
              showMask={false}
              onShowMaskChange={() => {}}
              onCalibrate={() => {}}
              sourceOptions={SOURCE_OPTIONS}
            />

            <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-1">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border-subtle text-xs text-text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">File</th>
                      <th className="px-4 py-3 font-medium">Resolution</th>
                      <th className="px-4 py-3 font-medium">Progress</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b border-border-subtle/60 last:border-0">
                        <td className="max-w-[220px] px-4 py-3">
                          <p className="truncate font-medium text-text-primary">{it.file.name}</p>
                          <p className="text-xs text-text-muted">
                            {formatBytes(it.file.size)}
                            {it.duration != null && ` · ${formatDuration(it.duration)}`}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {it.width && it.height ? formatResolution(it.width, it.height) : '—'}
                          {it.width && it.height && !isSupportedVideoResolution(it.width, it.height) && (
                            <span className="ml-1 text-warning" title="Unsupported resolution">
                              !
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                            <div
                              className={cn(
                                'h-full rounded-full transition-[width]',
                                it.status === 'error' ? 'bg-danger' : 'bg-accent',
                              )}
                              style={{ width: `${Math.round(it.progress * 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={it.status} />
                          {it.error && <p className="mt-1 max-w-[160px] text-xs text-danger">{it.error}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {it.status === 'complete' && (
                              <button
                                type="button"
                                onClick={() => downloadItem(it)}
                                className="focus-ring rounded-md border border-border-subtle px-2.5 py-1 text-xs font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
                              >
                                Download
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeItem(it)}
                              disabled={it.status === 'processing'}
                              aria-label={`Remove ${it.file.name}`}
                              className="focus-ring rounded-md p-1 text-text-muted hover:text-danger disabled:opacity-40"
                            >
                              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runQueue}
                disabled={isRunning || waitingCount === 0}
                className="focus-ring rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface-0 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning ? 'Processing…' : `Process ${waitingCount} clip${waitingCount === 1 ? '' : 's'}`}
              </button>
              <button
                type="button"
                onClick={downloadZip}
                disabled={completeCount === 0 || zipping}
                className="focus-ring rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50"
              >
                {zipping ? 'Building ZIP…' : `Download all as ZIP (${completeCount})`}
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={isRunning}
                className="focus-ring rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50"
              >
                Clear queue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: QueueItem['status'] }) {
  const styles: Record<QueueItem['status'], string> = {
    waiting: 'border-border-subtle text-text-muted',
    processing: 'border-accent/50 text-accent',
    review: 'border-warning/50 text-warning',
    complete: 'border-success/50 text-success',
    error: 'border-danger/50 text-danger',
  }
  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', styles[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}
