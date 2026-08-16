'use client'

import { useEffect, useState } from 'react'
import { Uploader } from '@/components/Uploader'
import { RegionSelector } from '@/components/RegionSelector'
import { JobPanel } from '@/components/JobPanel'
import { API_BASE, createJob, fetchHealth } from '@/lib/api'
import type { MediaKind, Region } from '@/lib/types'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<MediaKind>('image')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [region, setRegion] = useState<Region | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<'ok' | 'down' | 'checking'>('checking')

  useEffect(() => {
    fetchHealth()
      .then(() => setHealth('ok'))
      .catch(() => setHealth('down'))
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const onFile = (f: File, k: MediaKind) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setKind(k)
    setPreviewUrl(URL.createObjectURL(f))
    setRegion(null)
    setJobId(null)
    setError(null)
  }

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setRegion(null)
    setJobId(null)
    setError(null)
  }

  const submit = async () => {
    if (!file || !region || region.w <= 0 || region.h <= 0) return
    setSubmitting(true)
    setError(null)
    try {
      const job = await createJob({ file, kind, region })
      setJobId(job.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit job.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !!file && !!region && region.w > 0.01 && region.h > 0.01 && !jobId

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-semibold text-surface-0">
            WM
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Remover Studio</span>
        </div>
        <span className={`text-xs ${health === 'ok' ? 'text-success' : health === 'down' ? 'text-danger' : 'text-text-muted'}`}>
          {health === 'ok' ? 'API online' : health === 'down' ? 'API offline' : 'checking…'}
        </span>
      </header>

      <div className="mx-auto max-w-2xl pt-6 pb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Remove watermarks & objects</h1>
        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-text-secondary">
          Upload media, drag a box over what to remove, and the server reconstructs the background
          (LaMa · ProPainter · classical fallback).
        </p>
      </div>

      {health === 'down' && (
        <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          Can’t reach the API at <code className="text-text-primary">{API_BASE}</code>. Start it with{' '}
          <code className="text-text-primary">wmserver</code> and set{' '}
          <code className="text-text-primary">NEXT_PUBLIC_API_BASE</code> if it isn’t on :8000.
        </div>
      )}

      <div className="space-y-5">
        {!file && <Uploader onFile={onFile} />}

        {file && previewUrl && !jobId && (
          <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-medium text-text-primary">Mark the region to remove</h2>
            <RegionSelector url={previewUrl} kind={kind} region={region} onChange={setRegion} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="focus-ring rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface-0 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : `Remove from ${kind}`}
              </button>
              <button
                type="button"
                onClick={reset}
                className="focus-ring rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
              >
                Start over
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </section>
        )}

        {jobId && previewUrl && (
          <>
            <JobPanel jobId={jobId} kind={kind} originalUrl={previewUrl} />
            <button
              type="button"
              onClick={reset}
              className="focus-ring rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
            >
              Clean another file
            </button>
          </>
        )}
      </div>

      <footer className="mt-16 border-t border-border-subtle/60 pt-6 text-center text-xs text-text-muted">
        Server-backed processing — your media is uploaded to the configured API for inpainting.
      </footer>
    </main>
  )
}
