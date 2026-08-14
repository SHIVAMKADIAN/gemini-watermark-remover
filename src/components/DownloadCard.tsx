import { formatBytes } from '../utils/format'

interface DownloadCardProps {
  blob: Blob
  fileName: string
  notes: string[]
  originalUrl?: string
  originalFileName?: string
}

export function DownloadCard({ blob, fileName, notes, originalUrl, originalFileName }: DownloadCardProps) {
  const download = () => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoke on next tick so the download has started.
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <section aria-label="Download" className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Your cleaned file is ready</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {fileName} · {formatBytes(blob.size)}
          </p>
        </div>
        <div className="flex gap-2">
          {originalUrl && originalFileName && (
            <a
              href={originalUrl}
              download={originalFileName}
              className="focus-ring rounded-lg border border-border-subtle px-3.5 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
            >
              Download original
            </a>
          )}
          <button
            type="button"
            onClick={download}
            className="focus-ring rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 hover:bg-accent-strong"
          >
            Download clean file
          </button>
        </div>
      </div>
      {notes.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border-subtle pt-4">
          {notes.map((note) => (
            <li key={note} className="flex items-start gap-2 text-xs text-text-muted">
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success">
                <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {note}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
