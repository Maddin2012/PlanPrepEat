import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { LONG_PRESS_MS, LONG_PRESS_SLOP } from '../domain/longPress.ts'

/**
 * Lange drücken.
 *
 * Die Schwellen stehen in `domain/longPress.ts`. Hier steht nur, **welche**
 * Berührungen überhaupt bis dorthin kommen — und vor allem der Teil, an dem so
 * etwas üblicherweise schiefgeht.
 *
 * **Der Klick danach.** Auf ein `pointerup` folgt ein ganz gewöhnliches
 * `click`, auch wenn vorher eine halbe Sekunde gedrückt wurde — sonst öffnete
 * sich hinter dem Verschiebe-Blatt noch das Bearbeiten-Blatt. Deshalb wird
 * genau dieser eine Klick geschluckt.
 *
 * **Ehrlich dazu:** Die Browserprobe kommt an diesen Fall nicht heran. Sobald
 * das Blatt offen ist, liegt es über dem Feld, und der Klick erreicht den
 * Knopf ohnehin nicht mehr; ohne das Schlucken läuft die Probe genauso grün
 * durch. Es bleibt trotzdem stehen — ob der Klick ankommt, entscheidet das
 * Gerät, und ein doppelt geöffnetes Blatt wäre auf einem fremden Telefon
 * schwer zu finden. Ungeprüfte Vorsicht, als solche benannt.
 *
 * **Warum nicht auf `pointerup` entschieden wird**, wie beim Wischen: Ein
 * langer Druck soll sich melden, *während* der Finger liegt — man hält, es
 * passiert etwas, man lässt los. Würde erst beim Loslassen ausgelöst, wäre es
 * ein langsamer Tipp und nichts, worauf man sich verlassen kann. Also ein
 * Zeitgeber, und der braucht Aufräumen.
 *
 * **Maus zählt mit.** Beim Wischen ist das ausgeschlossen (mit der Maus zu
 * wischen heißt meist, Text markieren zu wollen); hier kostet es nichts und
 * macht die Browserprobe geradeaus.
 */
export function useLongPress(options: {
  enabled?: boolean
  onLongPress: () => void
}) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Nach einem ausgelösten Druck genau **einen** Klick schlucken.
  const schlucken = useRef(false)

  const abbrechen = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    start.current = null
  }

  // Ein Zeitgeber, der nach dem Ausbauen noch feuert, griffe auf eine Seite zu,
  // die es nicht mehr gibt.
  useEffect(() => abbrechen, [])

  function onPointerDown(event: ReactPointerEvent) {
    if (options.enabled === false) return

    // Ein zweiter Finger, während der erste noch liegt: verwerfen. Das ist ein
    // Zoom oder ein Verrutschen, kein Druck.
    if (start.current !== null) {
      abbrechen()
      return
    }

    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    timer.current = setTimeout(() => {
      timer.current = null
      if (start.current === null) return
      start.current = null
      schlucken.current = true
      options.onLongPress()
    }, LONG_PRESS_MS)
  }

  function onPointerMove(event: ReactPointerEvent) {
    const begonnen = start.current
    if (!begonnen || begonnen.id !== event.pointerId) return
    const weg = Math.hypot(
      event.clientX - begonnen.x,
      event.clientY - begonnen.y,
    )
    if (weg > LONG_PRESS_SLOP) abbrechen()
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: abbrechen,
    onPointerCancel: abbrechen,
    onClick: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!schlucken.current) return false
      schlucken.current = false
      event.preventDefault()
      event.stopPropagation()
      return true
    },
  }
}
