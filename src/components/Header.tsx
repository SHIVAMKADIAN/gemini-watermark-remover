import { cn } from '../utils/cn'
import type { AppTab } from '../App'

interface HeaderProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
}

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'batch', label: 'Batch' },
]

export function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle/80 bg-surface-0/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-semibold text-surface-0"
          >
            OC
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-text-primary">OmniClean</span>
        </div>

        <nav aria-label="Primary" className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface-1 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={cn(
                'focus-ring rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-surface-3 text-text-primary'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <span className="hidden text-xs text-text-muted sm:block">Local-first · no uploads</span>
      </div>
    </header>
  )
}
