'use client'

import { useEffect, useRef, useState } from 'react'
import { getJob, resultUrl } from '@/lib/api'
import type { JobView, MediaKind } from '@/lib/types'

interface JobPanelProps {
  jobId: string
  kind: MediaKind
  originalUrl: string
}

export function JobPanel({ jobId, kind, originalUrl }: JobPanelProps) {
  const [job, setJob] = useState<JobView | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const j = await getJob(jobId)
        if (!active) return
        setJob(j)
        if (j.status !== 'done' && j.status !== 'error') {
          timer.current = setTimeout(poll, 700)
        }
      } catch (err) {
        if (active) setJob((prev) => prev ?? errorView(jobId, kind, String(err)))
      }
    }
    void poll()
    return () => {
      active = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [jobId, kind])

  const pct = Math.round((job?.progress ?? 0) * 100)
  const done = job?.status === 'done'
  const errored = job?.status === 'error'

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-primary">Result</h2>
        <span className="text-xs text-text-muted">
          {job?.backend ? `backend: ${job.backend}` : ''}
          {job?.coverage != null ? ` · temporal coverage ${Math.round(job.coverage * 100)}%` : ''}
        </span>
      </div>

      {!done && !errored && (
        <div aria-live="polite">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-text-primary">{job?.message || 'Queued…'}</span>
            <span className="tabular-nums text-text-secondary">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {errored && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          {job?.error || 'Processing failed.'}
        </p>
      )}

      {done && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <figure>
              <figcaption className="mb-1 text-xs text-text-muted">Original</figcaption>
              <Media kind={kind} url={originalUrl} />
            </figure>
            <figure>
              <figcaption className="mb-1 text-xs text-text-muted">Cleaned</figcaption>
              <Media kind={kind} url={resultUrl(jobId)} />
            </figure>
          </div>
          <a
            href={resultUrl(jobId)}
            download
            className="focus-ring inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 hover:bg-accent-strong"
          >
            Download cleaned {kind}
          </a>
        </div>
      )}
    </section>
  )
}

function Media({ kind, url }: { kind: MediaKind; url: string }) {
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-full rounded-lg border border-border-subtle object-contain" />
  }
  return <video src={url} controls playsInline className="w-full rounded-lg border border-border-subtle" />
}

function errorView(id: string, kind: MediaKind, msg: string): JobView {
  return {
    id,
    kind,
    status: 'error',
    progress: 0,
    message: 'Failed',
    backend: null,
    coverage: null,
    error: msg,
    result_available: false,
  }
}
