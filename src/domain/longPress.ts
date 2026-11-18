/**
 * Wann ist eine Berührung ein **langer Druck**?
 *
 * Dieselbe Trennung wie beim Wischen (`swipe.ts`): Die Zahlen stehen hier und
 * nicht in der Geste, damit sich ohne Browser prüfen lässt, ob 480 Millisekunden
 * mit 12 Pixeln Wackeln noch als langer Druck durchgehen.
 *
 * Der lange Druck und das Wischen kommen sich dabei nicht ins Gehege: Ein
 * Wischen verlangt mindestens 60 Pixel Weg, ein langer Druck bricht schon bei
 * 10 ab. Was das eine ist, kann das andere nicht sein.
 */

/**
 * Wie lange gedrückt werden muss.
 *
 * Eine halbe Sekunde ist der Wert, den Android und iOS für ihr eigenes
 * Gedrückthalten nehmen — die Hand kennt ihn also schon. Kürzer, und ein
 * bedächtiger Tipp löst versehentlich aus; länger, und es fühlt sich an, als
 * reagiere die App nicht.
 */
export const LONG_PRESS_MS = 500

/**
 * Wie weit der Finger dabei wandern darf.
 *
 * Niemand hält absolut still, und auf einem Telefon in der Hand schon gar
 * nicht. Mehr als diese paar Pixel heißt aber: Hier wird gescrollt oder
 * gewischt, nicht gedrückt.
 */
export const LONG_PRESS_SLOP = 10

export interface PressMotion {
  /** Wie weit der Finger waagerecht gewandert ist. */
  dx: number
  /** Wie weit senkrecht. */
  dy: number
  /** Wie lange gedrückt wurde. */
  ms: number
}

/**
 * War das ein langer Druck?
 *
 * Gemessen wird der Abstand vom Startpunkt, nicht der zurückgelegte Weg: Wer
 * mit dem Daumen kreist und wieder dort landet, wo er angefangen hat, hat
 * gedrückt und nicht gewischt.
 */
export function isLongPress({ dx, dy, ms }: PressMotion): boolean {
  if (ms < LONG_PRESS_MS) return false
  return Math.hypot(dx, dy) <= LONG_PRESS_SLOP
}
