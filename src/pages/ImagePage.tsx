import { useCallback, useEffect, useState } from 'react'
import { CleanupControls } from '../components/CleanupControls'
import { DownloadCard } from '../components/DownloadCard'
import { ErrorBanner } from '../components/ErrorBanner'
import { Hero } from '../components/Hero'
import { ImageCompare } from '../components/ImageCompare'
import { MediaInspector } from '../components/MediaInspector'
import { PrivacyNote } from '../components/PrivacyNote'
import { ProgressBar } from '../components/ProgressBar'
import { UploadDropzone } from '../components/UploadDropzone'
import { WatermarkRegionEditor } from '../components/WatermarkRegionEditor'
import { useImageProcessor } from '../hooks/useImageProcessor'
import { useMediaMetadata } from '../hooks/useMediaMetadata'
import type { WatermarkSource } from '../profiles/types'
import { MediaValidationError, type CleanupMode, type ImageFormat, type WatermarkRegionOverride } from '../types'
import { methodNoteForMode } from '../processing/watermark/detect'
import { extensionForFormat } from '../utils/imageFormat'
import { createTrackedObjectUrl, revokeTrackedObjectUrl } from '../utils/objectUrl'
import { defaultRegionOverride } from '../utils/region'
import { LARGE_IMAGE_BYTES, validateImageFile } from '../utils/fileValidation'

export function ImagePage() {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<ImageFormat>('png')
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [source, setSource] = useState<WatermarkSource>('gemini')
  const [mode, setMode] = useState<CleanupMode>('auto')
  const [showMask, setShowMask] = useState(false)
  const [override, setOverride] = useState<WatermarkRegionOverride | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [largeWarning, setLargeWarning] = useState(false)

  const { metadata, readImage, reset: resetMeta } = useMediaMetadata()
  const { process, progress, result, error, isProcessing, reset: resetProcess } = useImageProcessor()

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
        const fmt = validateImageFile(incoming)
        setFormat(fmt)
        setFile(incoming)
        setLargeWarning(incoming.size > LARGE_IMAGE_BYTES)
        const url = createTrackedObjectUrl(incoming)
        setOriginalUrl(url)
        await readImage(incoming, fmt)
      } catch (err) {
        const message =
          err instanceof MediaValidationError ? err.message : 'Could not read this image. Please try another file.'
        setValidationError(message)
      }
    },
    [readImage, resetAll],
  )

  const runProcess = useCallback(() => {
    if (!file) return
    void process(file, format, source, mode, override).catch(() => {})
  }, [file, format, source, mode, override, process])

  const openEditor = useCallback(() => {
    if (metadata) setEditorOpen(true)
  }, [metadata])

  const downloadName = file
    ? `${file.name.replace(/\.[^.]+$/, '')}-cleaned.${extensionForFormat(format)}`
    : `cleaned.${extensionForFormat(format)}`

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24">
      <Hero
        title="Clean your Gemini & Omni images locally."
        subtitle="Restore visible corner marks while keeping your original resolution, format, and quality — entirely in your browser."
      />

      <div className="space-y-5">
        <PrivacyNote />

        {!file && (
          <UploadDropzone
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            formatsLabel="PNG, JPG, or WebP"
            onFiles={handleFiles}
          />
        )}

        {validationError && <ErrorBanner message={validationError} onDismiss={() => setValidationError(null)} />}

        {largeWarning && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-secondary">
            This is a large image. Processing may be slow or memory-intensive on this device.
          </div>
        )}

        {metadata && metadata.kind === 'image' && (
          <>
            <MediaInspector metadata={metadata} />

            <CleanupControls
              source={source}
              onSourceChange={setSource}
              mode={mode}
              onModeChange={setMode}
              showMask={showMask}
              onShowMaskChange={setShowMask}
              onCalibrate={openEditor}
            />

            {!result && !isProcessing && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={runProcess}
                  className="focus-ring rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface-0 hover:bg-accent-strong"
                >
                  Clean image
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

        {result && originalUrl && metadata?.kind === 'image' && (
          <>
            <ImageCompare
              originalUrl={originalUrl}
              cleanedUrl={result.url}
              width={result.width}
              height={result.height}
              geometry={result.geometry}
              showMask={showMask}
            />
            <DownloadCard
              blob={result.blob}
              fileName={downloadName}
              originalUrl={originalUrl}
              originalFileName={file?.name}
              notes={[
                `Original dimensions preserved (${result.width} × ${result.height}).`,
                `Output kept as ${format.toUpperCase()}${format === 'png' ? ' (lossless container).' : ' at high quality.'}`,
                result.geometry
                  ? `Restoration limited to ${result.pixelsModified.toLocaleString()} pixels in the watermark region — all other pixels untouched.`
                  : 'No watermark region matched this image; output equals the original.',
                methodNoteForMode(source, mode),
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
                Clean another image
              </button>
            </div>
          </>
        )}
      </div>

      {editorOpen && metadata && originalUrl && (
        <WatermarkRegionEditor
          previewUrl={originalUrl}
          mediaKind="image"
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
