/**
 * Wann ist eine Fingerbewegung ein Wischen — und wohin?
 *
 * Der ganze Unterschied zwischen „gewischt" und „gescrollt" steckt in drei
 * Zahlen. Sie stehen hier und nicht in der Geste selbst, damit sie sich ohne
 * Browser prüfen lassen: Ob eine Bewegung von 40 Pixeln nach rechts bei 30
 * Pixeln nach unten ein Reiterwechsel sein soll, ist eine Rechenfrage, keine
 * Frage der Ereignisse.
 */

/** Kürzer ist ein Wackeln beim Tippen, kein Wischen. */
export const SWIPE_MIN = 60

/**
 * Waagerecht muss deutlich mehr sein als senkrecht.
 *
 * Ohne das würde jedes schräge Scrollen den Reiter wechseln — und man scrollt
 * mit dem Daumen fast nie exakt senkrecht.
 */
export const SWIPE_RATIO = 1.5

/**
 * Länger dauert kein Wischen.
 *
 * Wer den Finger eine Sekunde lang langsam über den Bildschirm zieht, will
 * etwas anderes: lesen, etwas antippen, sich neu ausrichten.
 */
export const SWIPE_MAX_MS = 800

export type SwipeDirection = 'links' | 'rechts'

export interface SwipeMotion {
  /** Wie weit der Finger waagerecht gewandert ist. Negativ heißt nach links. */
  dx: number
  /** Wie weit senkrecht. */
  dy: number
  /** Wie lange die Bewegung gedauert hat. */
  ms: number
}

/**
 * Die Richtung, oder `null`, wenn es kein Wischen war.
 *
 * `'links'` heißt: Der Finger ist nach links gefahren — dorthin, wo der
 * nächste Reiter herkommt.
 */
export function swipeVerdict({ dx, dy, ms }: SwipeMotion): SwipeDirection | null {
  if (ms > SWIPE_MAX_MS) return null
  if (Math.abs(dx) < SWIPE_MIN) return null
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return null
  return dx < 0 ? 'links' : 'rechts'
}

/**
 * Der Reiter, auf dem man nach dem Wischen landet — oder `null`.
 *
 * `null` heißt: Hier passiert nichts. Am Rand wird **nicht** umgebrochen. Wer
 * von der Einkaufsliste aus weiterwischt und im Rezeptbuch landet, weiß nicht
 * mehr, wo er ist; ein Wisch, der nichts tut, sagt dagegen deutlich „hier ist
 * Schluss".
 */
export function nextTab(
  tabs: readonly string[],
  current: string,
  richtung: SwipeDirection,
): string | null {
  const index = tabs.indexOf(current)
  if (index === -1) return null

  const ziel = richtung === 'links' ? index + 1 : index - 1
  return ziel >= 0 && ziel < tabs.length ? tabs[ziel] : null
}
