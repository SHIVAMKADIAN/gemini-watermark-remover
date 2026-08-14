import { describe, expect, it } from 'vitest'
import { queueReducer, type QueueItem } from './batchQueue'

function fakeFile(name: string): File {
  return new File([new Uint8Array(10)], name, { type: 'video/mp4' })
}

describe('queueReducer', () => {
  it('adds files as waiting items', () => {
    const state = queueReducer([], { type: 'add', files: [fakeFile('a.mp4'), fakeFile('b.mp4')] })
    expect(state).toHaveLength(2)
    expect(state[0].status).toBe('waiting')
    expect(state[0].progress).toBe(0)
  })

  it('marks an item processing on start', () => {
    let state = queueReducer([], { type: 'add', files: [fakeFile('a.mp4')] })
    state = queueReducer(state, { type: 'start', id: state[0].id })
    expect(state[0].status).toBe('processing')
  })

  it('updates progress without changing status', () => {
    let state = queueReducer([], { type: 'add', files: [fakeFile('a.mp4')] })
    state = queueReducer(state, { type: 'start', id: state[0].id })
    state = queueReducer(state, { type: 'progress', id: state[0].id, progress: 0.5, message: 'Halfway' })
    expect(state[0].progress).toBe(0.5)
    expect(state[0].message).toBe('Halfway')
    expect(state[0].status).toBe('processing')
  })

  it('completes an item with a result', () => {
    let state = queueReducer([], { type: 'add', files: [fakeFile('a.mp4')] })
    const blob = new Blob([new Uint8Array(4)])
    state = queueReducer(state, {
      type: 'complete',
      id: state[0].id,
      blob,
      url: 'blob:x',
      fps: 30,
      duration: 5,
      audioPreserved: true,
      geometry: null,
    })
    expect(state[0].status).toBe('complete')
    expect(state[0].resultBlob).toBe(blob)
    expect(state[0].audioPreserved).toBe(true)
  })

  it('isolates a failure to a single item, leaving siblings intact', () => {
    let state = queueReducer([], { type: 'add', files: [fakeFile('a.mp4'), fakeFile('b.mp4')] })
    const failId = state[0].id
    const okId = state[1].id
    state = queueReducer(state, { type: 'error', id: failId, error: 'boom' })
    const failed = state.find((i) => i.id === failId) as QueueItem
    const ok = state.find((i) => i.id === okId) as QueueItem
    expect(failed.status).toBe('error')
    expect(failed.error).toBe('boom')
    expect(ok.status).toBe('waiting')
  })

  it('removes and clears items', () => {
    let state = queueReducer([], { type: 'add', files: [fakeFile('a.mp4'), fakeFile('b.mp4')] })
    state = queueReducer(state, { type: 'remove', id: state[0].id })
    expect(state).toHaveLength(1)
    state = queueReducer(state, { type: 'clear' })
    expect(state).toHaveLength(0)
  })
})
