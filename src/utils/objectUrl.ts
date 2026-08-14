/**
 * Tracks Blob object URLs created by the app so they can be reliably
 * revoked. Nothing in this app should call `URL.createObjectURL` directly —
 * always go through here so cleanup is guaranteed on unmount/reset.
 */
const registry = new Set<string>()

export function createTrackedObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  registry.add(url)
  return url
}

export function revokeTrackedObjectUrl(url: string | null | undefined): void {
  if (!url) return
  if (registry.has(url)) {
    URL.revokeObjectURL(url)
    registry.delete(url)
  }
}

export function revokeAllTrackedObjectUrls(): void {
  for (const url of registry) URL.revokeObjectURL(url)
  registry.clear()
}

export function trackedObjectUrlCount(): number {
  return registry.size
}
