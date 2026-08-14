import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTrackedObjectUrl,
  revokeAllTrackedObjectUrls,
  revokeTrackedObjectUrl,
  trackedObjectUrlCount,
} from './objectUrl'

let counter = 0
const globalUrl = globalThis.URL as unknown as {
  createObjectURL: (b: Blob) => string
  revokeObjectURL: (u: string) => void
}
globalUrl.createObjectURL = vi.fn(() => `blob:mock/${counter++}`)
globalUrl.revokeObjectURL = vi.fn()

afterEach(() => {
  revokeAllTrackedObjectUrls()
  vi.clearAllMocks()
})

describe('tracked object URLs', () => {
  it('tracks created URLs', () => {
    const before = trackedObjectUrlCount()
    createTrackedObjectUrl(new Blob(['a']))
    createTrackedObjectUrl(new Blob(['b']))
    expect(trackedObjectUrlCount()).toBe(before + 2)
  })

  it('revokes a specific URL and stops tracking it', () => {
    const url = createTrackedObjectUrl(new Blob(['a']))
    const count = trackedObjectUrlCount()
    revokeTrackedObjectUrl(url)
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(url)
    expect(trackedObjectUrlCount()).toBe(count - 1)
  })

  it('ignores untracked or null URLs', () => {
    revokeTrackedObjectUrl(null)
    revokeTrackedObjectUrl('blob:not-tracked')
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('revokes everything on cleanup', () => {
    createTrackedObjectUrl(new Blob(['a']))
    createTrackedObjectUrl(new Blob(['b']))
    revokeAllTrackedObjectUrls()
    expect(trackedObjectUrlCount()).toBe(0)
  })
})
