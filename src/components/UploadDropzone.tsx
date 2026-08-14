import { useCallback, useId, useRef, useState } from 'react'
import { cn } from '../utils/cn'

interface UploadDropzoneProps {
  accept: string
  multiple?: boolean
  formatsLabel: string
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function UploadDropzone({ accept, multiple, formatsLabel, onFiles, disabled }: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      onFiles(Array.from(fileList))
    },
    [onFiles],
  )

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          if (!disabled) handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'focus-ring group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors',
          disabled && 'cursor-not-allowed opacity-50',
          isDragOver
            ? 'border-accent bg-accent-soft'
            : 'border-border-subtle bg-surface-1 hover:border-border-strong hover:bg-surface-2',
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-accent"
        >
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
          <p className="text-[15px] font-medium text-text-primary">Drop your Gemini or Omni file here</p>
          <p className="mt-1 text-sm text-text-muted">
            or <span className="text-accent">click to browse</span>
          </p>
        </div>
        <p className="text-xs text-text-muted">{formatsLabel}</p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
          className="sr-only"
        />
      </label>
    </div>
  )
}
