'use client'

import { useRef, useState } from 'react'
import type { MediaKind } from '@/lib/types'

interface UploaderProps {
  onFile: (file: File, kind: MediaKind) => void
}

function detectKind(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4')) return 'video'
  return null
}

export function Uploader({ onFile }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = (file: File | undefined) => {
    if (!file) return
    const kind = detectKind(file)
    if (!kind) {
      setError('Unsupported file. Use an image (PNG/JPG/WebP) or an MP4 video.')
      return
    }
    setError(null)
    onFile(file, kind)
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          handle(e.dataTransfer.files?.[0])
        }}
        className={`focus-ring flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors ${
          over ? 'border-accent bg-accent-soft' : 'border-border-subtle bg-surface-1 hover:border-border-strong'
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-accent">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M12 16V4m0 0 4 4m-4-4-4 4M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <p className="text-[15px] font-medium text-text-primary">Drop an image or video here</p>
          <p className="mt-1 text-sm text-text-muted">
            or <span className="text-accent">click to browse</span> · PNG, JPG, WebP, MP4
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,video/mp4"
          className="sr-only"
          onChange={(e) => {
            handle(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
