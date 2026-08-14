import type { MediaMetadata } from '../types'
import { formatAspectRatio, formatBytes, formatDuration, formatFps, formatResolution } from '../utils/format'

interface MediaInspectorProps {
  metadata: MediaMetadata
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text-primary">{value}</dd>
    </div>
  )
}

export function MediaInspector({ metadata }: MediaInspectorProps) {
  const isVideo = metadata.kind === 'video'

  return (
    <section aria-label="Media information" className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <h2 className="mb-4 text-sm font-medium text-text-primary">Media information</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Filename" value={metadata.fileName} />
        <Field label="File size" value={formatBytes(metadata.fileSize)} />
        <Field label="Resolution" value={formatResolution(metadata.width, metadata.height)} />
        <Field label="Aspect ratio" value={formatAspectRatio(metadata.width, metadata.height)} />
        <Field label="Orientation" value={metadata.orientation} />
        {isVideo ? (
          <>
            <Field label="Duration" value={formatDuration(metadata.duration)} />
            <Field label="Frame rate" value={formatFps(metadata.fps)} />
            <Field label="Video codec" value={metadata.videoCodec ?? 'Unknown'} />
            <Field label="Audio" value={metadata.hasAudio ? (metadata.audioCodec ?? 'Present') : 'None'} />
            {metadata.hasAudio && metadata.sampleRate && (
              <Field
                label="Audio format"
                value={`${metadata.sampleRate.toLocaleString()} Hz · ${metadata.numberOfChannels ?? '?'} ch`}
              />
            )}
          </>
        ) : (
          <>
            <Field label="Format" value={metadata.format.toUpperCase()} />
            <Field label="Transparency" value={metadata.hasAlpha ? 'Yes' : 'No'} />
          </>
        )}
      </dl>
    </section>
  )
}
