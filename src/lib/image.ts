/**
 * Bilder werden im Browser verkleinert und als Data-URL in Firestore abgelegt.
 *
 * Warum nicht Firebase Storage? Weil Storage bei neu angelegten Projekten ein
 * Abrechnungskonto mit Kreditkarte verlangt, Firestore aber nicht. Ein
 * Firestore-Dokument fasst 1 MiB — ein auf 1200 Pixel verkleinertes JPEG liegt
 * weit darunter, und wir erzwingen das unten zusätzlich.
 */

/** Obergrenze für die lange Kante des Vollbilds. */
const FULL_MAX_EDGE = 1200

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

/** Verkleinert ein ausgewähltes Bild auf Vollbild und Vorschau. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const bitmap = await loadBitmap(file)
  try {
    const thumb = encode(drawScaled(bitmap, THUMB_MAX_EDGE), 0.6)
    const full = encodeWithinLimit(bitmap)
    return { full, thumb }
  } finally {
    bitmap.close?.()
  }
}

/**
 * Kodiert das Vollbild und dreht so lange an Qualität und Größe, bis es unter
 * die Firestore-Grenze passt.
 */
function encodeWithinLimit(bitmap: ImageBitmap): string {
  for (const maxEdge of [FULL_MAX_EDGE, 900, 700]) {
    const canvas = drawScaled(bitmap, maxEdge)
    for (const quality of QUALITY_STEPS) {
      const encoded = encode(canvas, quality)
      if (encoded.length <= FULL_MAX_CHARS) return encoded
    }
  }
  throw new ImageTooLargeError()
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
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

function drawScaled(
  bitmap: ImageBitmap,
  maxEdge: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas steht nicht zur Verfügung.')
  // Weiß hinterlegen, sonst werden durchsichtige PNG-Bereiche im JPEG schwarz.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

function encode(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality)
}
