/**
 * Die Rechnung hinter dem Zuschneiden.
 *
 * Reine Funktionen, ohne Browser: Was hier falsch ist, sieht man am Ergebnis
 * kaum — ein leicht verschobener Ausschnitt fällt niemandem auf, eine weiße
 * Ecke am Bildrand hingegen sofort. Deshalb liegt die Rechnung getrennt von
 * den Gesten und wird geprüft.
 */

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

/**
 * Wie das Bild gerade im Rahmen liegt.
 *
 * `zoom` ist 1, wenn das Bild den Rahmen gerade eben ausfüllt — nicht 1 für
 * „Originalgröße". Das ist der Bezugspunkt, der hier zählt: Kleiner als 1 darf
 * es nie werden, sonst entsteht eine leere Ecke.
 *
 * `offsetX`/`offsetY` verschieben die Bildmitte gegenüber der Rahmenmitte, in
 * **Rahmenpunkten** — derselben Einheit, in der der Finger zieht.
 */
export interface CropView {
  zoom: number
  offsetX: number
  offsetY: number
}

export const CENTERED: CropView = { zoom: 1, offsetX: 0, offsetY: 0 }

/** Der Faktor, mit dem das Bild den Rahmen gerade eben bedeckt. */
export function coverScale(image: Size, frame: Size): number {
  return Math.max(frame.width / image.width, frame.height / image.height)
}

/** Wie weit man das Bild bei diesem Zoom höchstens verschieben darf. */
function slack(image: Size, frame: Size, zoom: number): Size {
  const scale = coverScale(image, frame) * zoom
  return {
    width: Math.max(0, (image.width * scale - frame.width) / 2),
    height: Math.max(0, (image.height * scale - frame.height) / 2),
  }
}

const MAX_ZOOM = 4

/**
 * Hält Zoom und Verschiebung im Erlaubten.
 *
 * Der Kern des Ganzen: Ohne diese Grenze zieht man das Bild aus dem Rahmen
 * heraus und bekommt weiße Ecken ins Foto eingebacken. Bei Zoom 1 ist in einer
 * Richtung meist gar kein Spiel — ein 4:3-Bild in einem 4:3-Rahmen sitzt in
 * beiden Richtungen genau, da darf sich nichts bewegen.
 */
export function clampView(view: CropView, image: Size, frame: Size): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom))
  const room = slack(image, frame, zoom)
  return {
    zoom,
    offsetX: clamp(view.offsetX, -room.width, room.width),
    offsetY: clamp(view.offsetY, -room.height, room.height),
  }
}

/**
 * Welcher Bildbereich im Rahmen landet — in Bildpunkten, fertig für
 * `drawImage`.
 *
 * Die Ansicht wird vorher durch `clampView` geschickt: Der Aufrufer soll sich
 * nicht darauf verlassen müssen, das selbst getan zu haben.
 */
export function sourceRect(view: CropView, image: Size, frame: Size): Rect {
  const safe = clampView(view, image, frame)
  const scale = coverScale(image, frame) * safe.zoom

  // Wie viel vom Bild durch den Rahmen zu sehen ist.
  const width = Math.min(image.width, frame.width / scale)
  const height = Math.min(image.height, frame.height / scale)

  // Die Verschiebung zeigt in Rahmenpunkten nach rechts; das Fenster ins Bild
  // wandert dabei nach links. Daher das Minus.
  const x = (image.width - width) / 2 - safe.offsetX / scale
  const y = (image.height - height) / 2 - safe.offsetY / scale

  return {
    x: clamp(x, 0, image.width - width),
    y: clamp(y, 0, image.height - height),
    width,
    height,
  }
}

function clamp(value: number, min: number, max: number): number {
  // Das `+ 0` macht aus einer negativen Null eine gewöhnliche. Die entsteht,
  // sobald die Grenze selbst 0 ist (ein Bild, das genau in den Rahmen passt),
  // und stünde sonst als „-0px" in der Verschiebung.
  return Math.min(max, Math.max(min, value)) + 0
}
