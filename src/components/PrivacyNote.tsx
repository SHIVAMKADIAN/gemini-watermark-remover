export function PrivacyNote() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-1 px-4 py-3 text-sm text-text-secondary">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="mt-0.5 h-4 w-4 shrink-0 text-accent"
      >
        <path
          d="M10 1.5 3 4.3v4.9c0 4.2 2.9 7.9 7 9.3 4.1-1.4 7-5.1 7-9.3V4.3L10 1.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M7.2 10 9.3 12l3.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p>
        <span className="font-medium text-text-primary">Your media stays on your device.</span> Processing happens
        locally in your browser — files are never uploaded, and nothing about them is sent anywhere.
      </p>
    </div>
  )
}
