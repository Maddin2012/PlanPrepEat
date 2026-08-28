import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { swipeVerdict, type SwipeDirection } from '../domain/swipe.ts'

/**
 * Waagerecht wischen.
 *
 * Die Entscheidung, ob eine Bewegung ein Wischen war, steht in
 * `src/domain/swipe.ts`. Hier steht nur, **welche** Bewegungen überhaupt bis
 * dorthin kommen — und das ist der Teil, an dem so etwas üblicherweise
 * schiefgeht:
 *
 * - **Nur Finger.** Mit der Maus zu „wischen" ist keine Geste, sondern in aller
 *   Regel der Versuch, Text zu markieren.
 * - **Nur ein Finger.** Kommt ein zweiter dazu, wird verworfen: Das ist ein
 *   Zoom, kein Wischen.
 * - **Nicht dort, wo schon gezogen wird.** Auf der Einkaufsliste und bei den
 *   Zubereitungsschritten hängen dnd-kit-Anfasser. Beginnt die Bewegung auf
 *   einem davon, hält sich diese Geste heraus — sonst würde beim Umsortieren
 *   der Reiter wechseln.
 *
 * Das Bild läuft **nicht** mit dem Finger mit. Das wäre schöner, ist hier aber
 * nicht zu haben: Eine Transformation auf dem Inhalt macht daraus den
 * Bezugsrahmen für alles `fixed` darin — und genau darin liegen die
 * Diktat-Leiste und die Vorlese-Leiste. Sie würden mitwandern.
 */

/** Bereiche, die ihre Fingerbewegung selbst brauchen, tragen das. */
export const NO_SWIPE = 'data-swipe-aus'

interface Start {
  id: number
  x: number
  y: number
  zeit: number
}

export function useHorizontalSwipe(options: {
  /** Ausgeschaltet zieht die Geste gar nichts an sich. */
  enabled: boolean
  onSwipe: (richtung: SwipeDirection) => void
}) {
  const start = useRef<Start | null>(null)

  function onPointerDown(event: ReactPointerEvent) {
    if (!options.enabled) return

    // Ein zweiter Finger, während der erste noch unterwegs ist: verwerfen.
    if (start.current !== null) {
      start.current = null
      return
    }

    if (event.pointerType === 'mouse') return
    if ((event.target as Element | null)?.closest?.(`[${NO_SWIPE}]`)) return

    start.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      zeit: Date.now(),
    }
  }

  function onPointerUp(event: ReactPointerEvent) {
    const begonnen = start.current
    start.current = null
    if (!begonnen || begonnen.id !== event.pointerId) return

    const richtung = swipeVerdict({
      dx: event.clientX - begonnen.x,
      dy: event.clientY - begonnen.y,
      ms: Date.now() - begonnen.zeit,
    })
    if (richtung) options.onSwipe(richtung)
  }

  return {
    onPointerDown,
    onPointerUp,
    // Abgebrochen wird die Geste auch, wenn das Gerät sie an sich zieht — beim
    // Scrollen etwa. Ohne das bliebe der Startpunkt liegen und die nächste
    // Berührung würde mit einem uralten Anfang verrechnet.
    onPointerCancel: () => {
      start.current = null
    },
  }
}
