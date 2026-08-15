import { useCallback, useEffect, useMemo, useState } from 'react'
import { CleanupControls } from '../components/CleanupControls'
import { EngineSelector } from '../components/EngineSelector'
import { DownloadCard } from '../components/DownloadCard'
import { ErrorBanner } from '../components/ErrorBanner'
import { Hero } from '../components/Hero'
import { MediaInspector } from '../components/MediaInspector'
import { PrivacyNote } from '../components/PrivacyNote'
import { ProgressBar } from '../components/ProgressBar'
import { UploadDropzone } from '../components/UploadDropzone'
import { VideoCompare } from '../components/VideoCompare'
import { WatermarkRegionEditor } from '../components/WatermarkRegionEditor'
import { methodNoteForMode } from '../processing/watermark/detect'
import { useMediaMetadata } from '../hooks/useMediaMetadata'
import { useVideoProcessor } from '../hooks/useVideoProcessor'
import type { WatermarkSource } from '../profiles/types'
import type { VideoEngine } from '../processing/video/pipeline'
import { MediaValidationError, type CleanupMode, type WatermarkRegionOverride } from '../types'
import {
  checkWebCodecsSupport,
  isSupportedVideoResolution,
  LARGE_VIDEO_BYTES,
  validateVideoFile,
} from '../utils/fileValidation'
import { createTrackedObjectUrl, revokeTrackedObjectUrl } from '../utils/objectUrl'
import { defaultRegionOverride } from '../utils/region'

const SOURCE_OPTIONS = [
  { id: 'omni' as const, label: 'Gemini Omni' },
  { id: 'veo' as const, label: 'Google Flow / Veo' },
]

export function VideoPage() {
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [source, setSource] = useState<WatermarkSource>('omni')
  const [mode, setMode] = useState<CleanupMode>('auto')
  const [engine, setEngine] = useState<VideoEngine>('spatial')
  const [showMask, setShowMask] = useState(false)
  const [detectMark, setDetectMark] = useState(true)
  const [override, setOverride] = useState<WatermarkRegionOverride | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [resolutionWarning, setResolutionWarning] = useState<string | null>(null)
  const [largeWarning, setLargeWarning] = useState(false)

  const webCodecsSupported = useMemo(() => checkWebCodecsSupport(), [])
  const { metadata, readVideo, reset: resetMeta } = useMediaMetadata()
  const { process, progress, result, error, isProcessing, reset: resetProcess } = useVideoProcessor()

  useEffect(() => {
    return () => {
      revokeTrackedObjectUrl(originalUrl)
    }
  }, [originalUrl])

  const resetAll = useCallback(() => {
    revokeTrackedObjectUrl(originalUrl)
    setOriginalUrl(null)
    setFile(null)
    setOverride(null)
    setValidationError(null)
    setResolutionWarning(null)
    setLargeWarning(false)
    resetMeta()
    resetProcess()
  }, [originalUrl, resetMeta, resetProcess])

  const handleFiles = useCallback(
    async (files: File[]) => {
      const incoming = files[0]
      if (!incoming) return
      resetAll()
      try {
        validateVideoFile(incoming)
        setFile(incoming)
        setLargeWarning(incoming.size > LARGE_VIDEO_BYTES)
        const url = createTrackedObjectUrl(incoming)
        setOriginalUrl(url)
        const meta = await readVideo(incoming)
        if (!isSupportedVideoResolution(meta.width, meta.height)) {
          setResolutionWarning(
            `Unsupported video dimensions (${meta.width} × ${meta.height}). For the highest-quality cleanup, use the original Gemini/Omni export (720p or 1080p, landscape or portrait).`,
          )
        }
      } catch (err) {
        const message =
          err instanceof MediaValidationError ? err.message : 'Could not read this video. Please try another file.'
        setValidationError(message)
      }
    },
    [readVideo, resetAll],
  )

  const runProcess = useCallback(() => {
    if (!file) return
    void process(file, source, mode, override, detectMark, engine).catch(() => {})
  }, [file, source, mode, override, detectMark, engine, process])

  const downloadName = file ? `${file.name.replace(/\.[^.]+$/, '')}-cleaned.mp4` : 'cleaned.mp4'

  if (!webCodecsSupported) {
    return (
      <div className="mx-auto max-w-3xl px-6 pb-24">
        <Hero
          title="Clean your Gemini & Omni videos locally."
          subtitle="Restore visible corner marks while keeping your original resolution and quality."
        />
        <ErrorBanner message="Your browser does not support the required video processing API (WebCodecs). Try the latest Chrome or Edge. The image workflow still works in this browser." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24">
      <Hero
        title="Clean your Gemini & Omni videos locally."
        subtitle="Restore visible corner marks while keeping your original resolution, duration, frame rate, and audio — entirely in your browser."
      />

      <div className="space-y-5">
        <PrivacyNote />

        {!file && (
          <UploadDropzone accept="video/mp4,.mp4" formatsLabel="MP4 · 720p or 1080p · landscape or portrait" onFiles={handleFiles} />
        )}

        {validationError && <ErrorBanner message={validationError} onDismiss={() => setValidationError(null)} />}
        {resolutionWarning && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-secondary">
            {resolutionWarning} You can still try processing, or adjust the watermark region manually.
          </div>
        )}
        {largeWarning && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-secondary">
            This is a large video. Processing may be slow or memory-intensive. If it fails, try a shorter clip or close
            other tabs.
          </div>
        )}

        {metadata && metadata.kind === 'video' && (
          <>
            <MediaInspector metadata={metadata} />

            <section aria-label="Reconstruction engine" className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
              <EngineSelector engine={engine} onChange={setEngine} />
            </section>

            <CleanupControls
              source={source}
              onSourceChange={setSource}
              mode={mode}
              onModeChange={setMode}
              showMask={showMask}
              onShowMaskChange={setShowMask}
              detectMark={detectMark}
              onDetectMarkChange={setDetectMark}
              onCalibrate={() => setEditorOpen(true)}
              sourceOptions={SOURCE_OPTIONS}
            />

            {!result && !isProcessing && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={runProcess}
                  className="focus-ring rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface-0 hover:bg-accent-strong"
                >
                  Clean video
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="focus-ring rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
                >
                  Start over
                </button>
              </div>
            )}
          </>
        )}

        {isProcessing && progress && <ProgressBar progress={progress} />}
        {error && <ErrorBanner message={error} />}

        {result && originalUrl && metadata?.kind === 'video' && (
          <>
            <VideoCompare
              originalUrl={originalUrl}
              cleanedUrl={result.url}
              width={result.width}
              height={result.height}
              fps={result.fps}
              geometry={result.geometry}
              showMask={showMask}
            />
            <DownloadCard
              blob={result.blob}
              fileName={downloadName}
              notes={[
                `Original dimensions preserved (${result.width} × ${result.height}).`,
                `Duration and frame rate preserved (${result.duration.toFixed(2)}s, ~${result.fps.toFixed(1)} fps).`,
                result.audioPreserved
                  ? 'Audio stream copied through without re-encoding.'
                  : metadata.hasAudio
                    ? 'Audio could not be copied and was omitted (browser codec limitation).'
                    : 'Source had no audio track.',
                'Video re-encoded to apply the watermark restoration — encoding parameters may differ from the source. Not bit-for-bit identical.',
                result.engine === 'temporal'
                  ? `Temporal engine: ${Math.round((result.temporalCoverage ?? 0) * 100)}% of masked pixels were reconstructed from real background revealed in other frames; the rest were filled spatially.`
                  : methodNoteForMode(source, mode),
              ]}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => resetProcess()}
                className="focus-ring rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
              >
                Re-run with different settings
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="focus-ring rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
              >
                Clean another video
              </button>
            </div>
          </>
        )}
      </div>

      {editorOpen && metadata && originalUrl && (
        <WatermarkRegionEditor
          previewUrl={originalUrl}
          mediaKind="video"
          mediaWidth={metadata.width}
          mediaHeight={metadata.height}
          initialRegion={override ?? defaultRegionOverride(source, mode, metadata.width, metadata.height)}
          onSave={(r) => {
            setOverride(r)
            setEditorOpen(false)
          }}
          onResetToDefault={() => {
            setOverride(null)
            setEditorOpen(false)
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  )
}
