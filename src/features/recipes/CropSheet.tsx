import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, Sheet } from '../../components/ui.tsx'
import {
  CENTERED,
  clampView,
  coverScale,
  sourceRect,
  type CropView,
  type Rect,
  type Size,
} from '../../lib/crop.ts'
import { PHOTO_ASPECT } from '../../lib/image.ts'

/**
 * Den Bildausschnitt wählen.
 *
 * Vorher hat die App gar nichts abgeschnitten — beschnitten wurde erst beim
 * Anzeigen, und zwar in jeder Ansicht anders. Hier wird der Ausschnitt einmal
 * bestimmt und beim Speichern fest eingebacken; danach zeigen Rezeptliste,
 * Vorschau und Rezeptseite dasselbe.
 *
 * Die Rechnung liegt in `crop.ts` und ist dort geprüft. Was hier steht, sind
 * nur die Gesten und das, was man sieht.
 */
export default function CropSheet({
  open,
  bitmap,
  onCancel,
  onConfirm,
}: {
  open: boolean
  /** Das geladene Bild — schon dekodiert, damit es nicht zweimal geschieht. */
  bitmap: ImageBitmap | null
  onCancel: () => void
  onConfirm: (crop: Rect) => void
}) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [frame, setFrame] = useState<Size>({ width: 0, height: 0 })
  const [view, setView] = useState<CropView>(CENTERED)

  const image: Size = bitmap
    ? { width: bitmap.width, height: bitmap.height }
    : { width: 1, height: 1 }

  // Jedes neue Bild fängt mittig und unvergrößert an.
  useEffect(() => {
    setView(CENTERED)
  }, [bitmap])

  // Die Rahmengröße steht erst nach dem Zeichnen fest, und die Rechnung
  // braucht sie in denselben Punkten, in denen der Finger zieht.
  useLayoutEffect(() => {
    const element = frameRef.current
    if (!element) return
    const messen = () =>
      setFrame({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    messen()
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(element)
    return () => beobachter.disconnect()
  }, [open])

  /**
   * Ziehen und Zusammenziehen.
   *
   * Beides über Zeigereignisse in einer Ablage: Ein Finger verschiebt, zwei
   * verändern den Zoom. Der Browser darf die Geste nicht als Scrollen
   * beanspruchen — dafür `touch-none` am Rahmen.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ distance: number; zoom: number } | null>(null)

  function abstand(): number {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function onPointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      gesture.current = { distance: abstand(), zoom: view.zoom }
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const next = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, next)

    if (pointers.current.size >= 2 && gesture.current) {
      const factor = abstand() / (gesture.current.distance || 1)
      setView((current) =>
        clampView({ ...current, zoom: gesture.current!.zoom * factor }, image, frame),
      )
      return
    }

    setView((current) =>
      clampView(
        {
          ...current,
          offsetX: current.offsetX + (next.x - previous.x),
          offsetY: current.offsetY + (next.y - previous.y),
        },
        image,
        frame,
      ),
    )
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) gesture.current = null
  }

  // Wie das Bild im Rahmen liegt — dieselbe Rechnung wie beim Zuschneiden,
  // nur andersherum angewandt.
  const scale = coverScale(image, frame) * view.zoom
  const drawn = {
    width: image.width * scale,
    height: image.height * scale,
  }

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title="Bildausschnitt wählen"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            className="flex-1"
            disabled={!bitmap || frame.width === 0}
            onClick={() => bitmap && onConfirm(sourceRect(view, image, frame))}
          >
            Übernehmen
          </Button>
        </div>
      }
    >
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // touch-none: Sonst nimmt der Browser die Wischgeste fürs Scrollen,
        // bevor sie hier ankommt.
        className="relative w-full touch-none overflow-hidden rounded-xl bg-overlay select-none"
        style={{ aspectRatio: String(PHOTO_ASPECT) }}
      >
        {bitmap && frame.width > 0 && (
          <ImageLayer bitmap={bitmap} drawn={drawn} view={view} />
        )}

        {/* Das Raster: Es zeigt, was im Bild bleibt. Alles außerhalb des
            Rahmens ist ohnehin nicht zu sehen — der Rahmen *ist* der
            Ausschnitt. */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/35" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/35" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/35" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/35" />
          <div className="absolute inset-0 ring-2 ring-white/60 ring-inset" />
        </div>
      </div>

      {/* Der Regler ist nicht nur eine Notlösung für den Rechner: Mit einer
          Hand am Handy ist er bequemer als zwei Finger. */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-600">
          Größe
        </span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={view.zoom}
          aria-label="Größe"
          onChange={(event) =>
            setView((current) =>
              clampView(
                { ...current, zoom: Number(event.target.value) },
                image,
                frame,
              ),
            )
          }
          className="w-full accent-accent"
        />
      </label>

      <p className="mt-2 text-xs leading-relaxed text-ink-400">
        Schieb das Bild mit dem Finger, bis der Ausschnitt sitzt. Genau dieser
        Bereich wird gespeichert und überall angezeigt.
      </p>
    </Sheet>
  )
}

/**
 * Das Bild selbst.
 *
 * Über ein Canvas statt eines `<img>`: Aus dem `ImageBitmap` gäbe es sonst
 * keinen Weg zu einer Adresse, ohne es ein zweites Mal zu kodieren.
 */
function ImageLayer({
  bitmap,
  drawn,
  view,
}: {
  bitmap: ImageBitmap
  drawn: Size
  view: CropView
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  }, [bitmap])

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-1/2 left-1/2"
      style={{
        width: `${drawn.width}px`,
        height: `${drawn.height}px`,
        transform: `translate(-50%, -50%) translate(${view.offsetX}px, ${view.offsetY}px)`,
      }}
    />
  )
}
