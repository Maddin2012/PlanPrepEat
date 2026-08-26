/**
 * Bilder werden im Browser verkleinert und als Data-URL in Firestore abgelegt.
 *
 * Warum nicht Firebase Storage? Weil Storage bei neu angelegten Projekten ein
 * Abrechnungskonto mit Kreditkarte verlangt, Firestore aber nicht. Ein
 * Firestore-Dokument fasst 1 MiB — ein auf 1200 Pixel verkleinertes JPEG liegt
 * weit darunter, und wir erzwingen das unten zusätzlich.
 */

import type { Rect } from './crop.ts'

/** Obergrenze für die lange Kante des Vollbilds. */
const FULL_MAX_EDGE = 1200

/**
 * Das Seitenverhältnis, in dem Fotos gespeichert werden.
 *
 * Ein festes Verhältnis für alles ist der Preis dafür, dass „was du siehst"
 * stimmt: Rezeptliste, Vorschau und Rezeptseite zeigen denselben Ausschnitt,
 * weil er schon im Bild steckt und nicht erst beim Anzeigen entsteht.
 */
export const PHOTO_ASPECT = 4 / 3

/** Das Vorschaubild wird in der Rezeptliste 64 Pixel groß gezeigt. */
const THUMB_MAX_EDGE = 320

/**
 * Sicherheitsabstand zum 1-MiB-Limit von Firestore. Data-URLs sind wegen der
 * Base64-Kodierung rund ein Drittel größer als die eigentlichen Bilddaten.
 */
const FULL_MAX_CHARS = 700_000

const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.45, 0.35]

export interface PreparedPhoto {
  /** Vollbild für die Rezeptansicht. */
  full: string
  /** Winziges Vorschaubild, das mit im Rezeptdokument liegt. */
  thumb: string
}

export class ImageTooLargeError extends Error {
  constructor() {
    super('Das Bild ließ sich nicht klein genug rechnen.')
    this.name = 'ImageTooLargeError'
  }
}

/**
 * Backt den gewählten Ausschnitt ins Bild ein und verkleinert ihn.
 *
 * `crop` ist der Bereich in Bildpunkten, den der Zuschneide-Bildschirm
 * ermittelt hat (`sourceRect` aus `crop.ts`). Ohne Angabe wird mittig auf
 * `PHOTO_ASPECT` beschnitten — der Fall tritt nur ein, wenn der Bildschirm
 * übersprungen wurde.
 */
export function preparePhotoFrom(
  bitmap: ImageBitmap,
  crop?: Rect,
): PreparedPhoto {
  const area = crop ?? centeredCrop(bitmap)
  return {
    thumb: encode(drawCropped(bitmap, area, THUMB_MAX_EDGE), 0.6),
    full: encodeWithinLimit(bitmap, area),
  }
}

/** Der bequeme Weg für den Fall, dass nur eine Datei vorliegt. */
export async function preparePhoto(
  file: File,
  crop?: Rect,
): Promise<PreparedPhoto> {
  const bitmap = await loadBitmap(file)
  try {
    return preparePhotoFrom(bitmap, crop)
  } finally {
    bitmap.close?.()
  }
}

/** Der größte mittige Ausschnitt im Zielverhältnis. */
function centeredCrop(bitmap: ImageBitmap): Rect {
  const width = Math.min(bitmap.width, bitmap.height * PHOTO_ASPECT)
  const height = width / PHOTO_ASPECT
  return {
    x: (bitmap.width - width) / 2,
    y: (bitmap.height - height) / 2,
    width,
    height,
  }
}

/**
 * Kodiert das Vollbild und dreht so lange an Qualität und Größe, bis es unter
 * die Firestore-Grenze passt.
 */
function encodeWithinLimit(bitmap: ImageBitmap, crop: Rect): string {
  for (const maxEdge of [FULL_MAX_EDGE, 900, 700]) {
    const canvas = drawCropped(bitmap, crop, maxEdge)
    for (const quality of QUALITY_STEPS) {
      const encoded = encode(canvas, quality)
      if (encoded.length <= FULL_MAX_CHARS) return encoded
    }
  }
  throw new ImageTooLargeError()
}

export async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    // `from-image` dreht hochkant aufgenommene Handyfotos richtig herum.
    return createImageBitmap(file, { imageOrientation: 'from-image' })
  }
  return loadViaImageElement(file)
}

/** Notlösung für Browser ohne createImageBitmap. */
function loadViaImageElement(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image as unknown as ImageBitmap)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Das Bild konnte nicht gelesen werden.'))
    }
    image.src = url
  })
}

/** Zeichnet den Ausschnitt in eine Fläche, deren lange Kante `maxEdge` misst. */
function drawCropped(
  bitmap: ImageBitmap,
  crop: Rect,
  maxEdge: number,
): HTMLCanvasElement {
  // Nie über die Größe des Ausschnitts hinaus vergrößern — das brächte keine
  // Schärfe, nur Bytes.
  const scale = Math.min(1, maxEdge / Math.max(crop.width, crop.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(crop.width * scale))
  canvas.height = Math.max(1, Math.round(crop.height * scale))

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas steht nicht zur Verfügung.')
  // Weiß hinterlegen, sonst werden durchsichtige PNG-Bereiche im JPEG schwarz.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas
}

function encode(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality)
}
