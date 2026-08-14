import { useCallback, useState } from 'react'
import { readImageMetadata } from '../processing/image/metadata'
import { readVideoMetadata } from '../processing/video/metadata'
import type { ImageFormat, MediaMetadata } from '../types'

export function useMediaMetadata() {
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readImage = useCallback(async (file: File, format: ImageFormat) => {
    setIsReading(true)
    setError(null)
    try {
      const meta = await readImageMetadata(file, format)
      setMetadata(meta)
      return meta
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read this file.'
      setError(message)
      throw err
    } finally {
      setIsReading(false)
    }
  }, [])

  const readVideo = useCallback(async (file: File) => {
    setIsReading(true)
    setError(null)
    try {
      const meta = await readVideoMetadata(file)
      setMetadata(meta)
      return meta
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read this file.'
      setError(message)
      throw err
    } finally {
      setIsReading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setMetadata(null)
    setError(null)
  }, [])

  return { metadata, isReading, error, readImage, readVideo, reset }
}
