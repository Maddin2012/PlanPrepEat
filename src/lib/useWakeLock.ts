import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hält den Bildschirm wach, solange man am Herd steht und mitliest.
 *
 * Android nimmt die Sperre zurück, sobald man in eine andere App wechselt —
 * deshalb wird sie beim Zurückkommen neu angefordert.
 */
export function useWakeLock(): {
  supported: boolean
  active: boolean
  toggle: () => void
} {
  const supported =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [active, setActive] = useState(false)
  const sentinel = useRef<WakeLockSentinel | null>(null)

  const release = useCallback(async () => {
    try {
      await sentinel.current?.release()
    } catch {
      // Bereits freigegeben — nichts zu tun.
    }
    sentinel.current = null
    setActive(false)
  }, [])

  const request = useCallback(async () => {
    if (!supported) return
    try {
      sentinel.current = await navigator.wakeLock.request('screen')
      sentinel.current.addEventListener('release', () => setActive(false))
      setActive(true)
    } catch {
      setActive(false)
    }
  }, [supported])

  const toggle = useCallback(() => {
    if (active) void release()
    else void request()
  }, [active, release, request])

  // Nach einem App-Wechsel zurückholen, sonst geht der Bildschirm doch aus.
  useEffect(() => {
    if (!active) return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !sentinel.current) {
        void request()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [active, request])

  // Beim Verlassen der Seite immer freigeben.
  useEffect(() => () => void release(), [release])

  return { supported, active, toggle }
}
