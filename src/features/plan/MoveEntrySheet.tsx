import { useState } from 'react'
import { useRepository } from '../../data/RepositoryContext.tsx'
import { useRecipeMap, useSlots } from '../../data/hooks.ts'
import type { Meal, PlanEntry } from '../../domain/types.ts'
import { isRecipeEntry } from '../../domain/types.ts'
import {
  MEAL_LABELS,
  WEEKDAY_LONG,
  addDays,
  fromISODate,
  parseSlotKey,
  slotKey,
  todayISO,
} from '../../domain/planWindow.ts'
import { Button, Sheet } from '../../components/ui.tsx'
import DayPicker, { DAYS_AHEAD } from './DayPicker.tsx'

/**
 * Ein Gericht auf einen anderen Tag bringen.
 *
 * Geöffnet wird das Blatt durch **langes Drücken** auf ein belegtes Feld im
 * Essensplan. Vorher gab es das Verschieben nur als zwei getrennte Schritte —
 * im Blatt des alten Tages auf das X, im Blatt des neuen auf „Rezept
 * hinzufügen" —, und in der falschen Reihenfolge erkannte die Einkaufsliste es
 * nicht einmal als Verschieben, sondern als neues Gericht.
 *
 * **Kein Ziehen über den Kalender.** Der Plan scrollt über Monate; ein Gericht
 * mit dem Finger von heute auf nächsten Montag zu ziehen hieße, dabei zu
 * scrollen. Eine Liste der nächsten vierzehn Tage trifft jeden Platz mit einem
 * Tipp.
 */
export default function MoveEntrySheet({
  open,
  fromSlot,
  entries,
  onClose,
}: {
  open: boolean
  /** Der Platz, auf dem es gerade liegt — `slotKey`. */
  fromSlot: string
  entries: PlanEntry[]
  onClose: () => void
}) {
  const repository = useRepository()
  const recipesById = useRecipeMap()
  const [busy, setBusy] = useState(false)
  // Bei mehreren Gerichten auf einem Platz wird erst gefragt, welches gemeint
  // ist. Bei einem einzigen entfällt der Schritt.
  const [gewaehlt, setGewaehlt] = useState<number | null>(
    entries.length === 1 ? 0 : null,
  )

  // Derselbe Zeitraum, den `DayPicker` anbietet — gebraucht, um zu wissen, was
  // auf dem Zielplatz schon liegt. Ein Platz wird **ergänzt**, nicht ersetzt.
  const heute = todayISO()
  const { data: slots } = useSlots(heute, addDays(heute, DAYS_AHEAD - 1))

  const nameVon = (entry: PlanEntry) =>
    isRecipeEntry(entry)
      ? (recipesById.get(entry.recipeId)?.name ?? 'Gelöschtes Rezept')
      : entry.text

  async function move(datum: string, meal: Meal) {
    if (gewaehlt === null) return
    const entry = entries[gewaehlt]
    if (!entry) return
    const ziel = slotKey(datum, meal)
    if (ziel === fromSlot) return

    setBusy(true)
    try {
      /*
       * **Erst hinlegen, dann wegnehmen.** Bricht der zweite Schritt ab, steht
       * das Gericht doppelt da — das sieht man und kann es richten. Andersherum
       * wäre es weg, und niemand merkte es.
       *
       * Für die Einkaufsliste ist das Ergebnis dasselbe: Am Ende ist eine
       * Stelle im Plan weg und eine dazugekommen, und weil es dasselbe Rezept
       * ist, erkennt sie ein Verschieben und fragt nach, statt die Häkchen
       * stillschweigend fallen zu lassen.
       */
      const vorhanden = slots.find((slot) => slot.key === ziel)?.entries ?? []
      await repository.setSlot(ziel, [...vorhanden, entry])
      await repository.setSlot(
        fromSlot,
        entries.filter((_, index) => index !== gewaehlt),
      )
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const platz = parseSlotKey(fromSlot)
  const woher = platz
    ? `${WEEKDAY_LONG[fromISODate(platz.date).getDay()]}, ${MEAL_LABELS[platz.meal]}`
    : 'dem Plan'

  if (gewaehlt === null) {
    return (
      <Sheet open={open} onClose={onClose} title="Welches Gericht?">
        <p className="mb-3 px-1 text-sm text-ink-400">
          Auf {woher} liegt mehr als eines.
        </p>
        <ul className="divide-y divide-clay-200/70 overflow-hidden rounded-xl bg-surface ring-1 ring-clay-200">
          {entries.map((entry, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => setGewaehlt(index)}
                className="flex min-h-12 w-full items-center px-3 py-2 text-left transition-colors active:bg-clay-100"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                  {nameVon(entry)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" block className="mt-3" onClick={onClose}>
          Abbrechen
        </Button>
      </Sheet>
    )
  }

  const entry = entries[gewaehlt]
  return (
    <Sheet open={open} onClose={onClose} title="Wohin damit?">
      <p className="mb-3 px-1 text-sm text-ink-400">
        <span className="font-medium text-ink-900">
          {entry ? nameVon(entry) : 'Das Gericht'}
        </span>{' '}
        liegt auf {woher}.
      </p>
      <DayPicker
        disabled={busy}
        currentSlot={fromSlot}
        onPick={(datum, meal) => void move(datum, meal)}
      />
      <Button variant="ghost" block className="mt-3" onClick={onClose}>
        Abbrechen
      </Button>
    </Sheet>
  )
}
