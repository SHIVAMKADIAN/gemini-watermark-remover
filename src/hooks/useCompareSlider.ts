import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/** Shared drag logic for a vertical before/after divider (0..1 position). */
export function useCompareSlider(initial = 0.5) {
  const [position, setPosition] = useState(initial)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const frac = (clientX - rect.left) / rect.width
    setPosition(Math.min(1, Math.max(0, frac)))
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      dragging.current = true
      ;(e.target as Element).setPointerCapture(e.pointerId)
      updateFromClientX(e.clientX)
    },
    [updateFromClientX],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragging.current) return
      updateFromClientX(e.clientX)
    },
    [updateFromClientX],
  )

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPosition((p) => Math.max(0, p - 0.02))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPosition((p) => Math.min(1, p + 0.02))
    }
  }, [])

  return { position, setPosition, containerRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown }
}
