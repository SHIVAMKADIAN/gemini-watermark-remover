import { ALL_FORMATS, BlobSource, Input } from 'mediabunny'
import { getOrientation, MediaValidationError, type VideoMetadata } from '../../types'

export async function readVideoMetadata(file: File): Promise<VideoMetadata> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  try {
    const canRead = await input.canRead()
    if (!canRead) {
      throw new MediaValidationError(
        "This file couldn't be read. Please use an original, unedited MP4 export.",
        'decode-failed',
      )
    }

    const videoTrack = await input.getPrimaryVideoTrack()
    if (!videoTrack) {
      throw new MediaValidationError('No readable video track was found in this file.', 'decode-failed')
    }
    const audioTrack = await input.getPrimaryAudioTrack()

    const [width, height, duration, stats, codec] = await Promise.all([
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      input.computeDuration(),
      videoTrack.computePacketStats(),
      videoTrack.getCodec(),
    ])

    let audioCodec: string | null = null
    let sampleRate: number | null = null
    let numberOfChannels: number | null = null
    if (audioTrack) {
      ;[audioCodec, sampleRate, numberOfChannels] = await Promise.all([
        audioTrack.getCodec(),
        audioTrack.getSampleRate(),
        audioTrack.getNumberOfChannels(),
      ])
    }

    return {
      kind: 'video',
      fileName: file.name,
      fileSize: file.size,
      width,
      height,
      duration,
      fps: stats.averagePacketRate,
      videoCodec: codec,
      hasAudio: !!audioTrack,
      audioCodec,
      sampleRate,
      numberOfChannels,
      orientation: getOrientation(width, height),
      totalFrames: stats.packetCount,
    }
  } finally {
    input.dispose()
  }
}
