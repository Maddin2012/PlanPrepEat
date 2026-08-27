import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepository } from '../../data/RepositoryContext.tsx'
import { useSlots } from '../../data/hooks.ts'
import type { Meal, Recipe } from '../../domain/types.ts'
import {
  MEALS,
  MEAL_LABELS,
  WEEKDAY_LONG,
  addDays,
  formatDayShort,
  fromISODate,
  slotKey,
  todayISO,
} from '../../domain/planWindow.ts'
import { Button, Sheet, cx } from '../../components/ui.tsx'

/** So weit voraus lässt sich vom Rezept aus planen — zwei Wochen reichen. */
const DAYS_AHEAD = 14

/**
 * Ein Rezept vom Rezeptbuch aus einplanen.
 *
 * Vorher musste man sich den Namen merken, in den Essensplan wechseln, den Tag
 * suchen und das Rezept dort noch einmal auswählen. Hier steht die Liste der
 * nächsten Tage, ein Tipp genügt.
 *
 * Der Platz wird **ergänzt**, nicht ersetzt: Steht dort schon etwas, kommt das
 * Rezept dazu — ein Platz darf mehrere fassen, Hauptgericht und Beilage sind
 * schließlich zwei.
 */
export default function AddToPlanSheet({
  open,
  recipe,
  servings,
  onClose,
}: {
  open: boolean
  recipe: Recipe
  /** Die gerade eingestellte Portionszahl, nicht die des Rezepts. */
  servings: number
  onClose: () => void
}) {
  const repository = useRepository()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const [von, bis] = useMemo(() => {
    const heute = todayISO()
    return [heute, addDays(heute, DAYS_AHEAD - 1)]
  }, [])

  const { data: slots } = useSlots(von, bis)
  const belegt = useMemo(
    () => new Map(slots.map((slot) => [slot.key, slot.entries])),
    [slots],
  )

  const tage = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(von, i)),
    [von],
  )

  async function add(datum: string, meal: Meal) {
    setBusy(true)
    const key = slotKey(datum, meal)
    const vorhanden = belegt.get(key) ?? []
    await repository.setSlot(key, [
      ...vorhanden,
      { recipeId: recipe.id, servings },
    ])
    onClose()
    navigate('/plan')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Wann soll es das geben?">
      <ul className="space-y-2">
        {tage.map((datum, index) => {
          const wochentag = WEEKDAY_LONG[fromISODate(datum).getDay()]
          return (
            <li
              key={datum}
              className="flex items-center gap-2 rounded-xl bg-surface p-2 ring-1 ring-clay-200"
            >
              <span className="w-28 shrink-0 pl-1 text-sm">
                <span className="block font-medium text-ink-900">
                  {index === 0 ? 'Heute' : index === 1 ? 'Morgen' : wochentag}
                </span>
                <span className="block text-xs text-ink-400 tabular-nums">
                  {formatDayShort(datum)}
                </span>
              </span>

              {MEALS.map((meal) => {
                const anzahl = (belegt.get(slotKey(datum, meal)) ?? []).length
                return (
                  <Button
                    key={meal}
                    variant="secondary"
                    className="min-w-0 flex-1"
                    disabled={busy}
                    onClick={() => void add(datum, meal)}
                  >
                    <span className="truncate">
                      {MEAL_LABELS[meal]}
                      {/* Was schon dort liegt, muss sichtbar sein — sonst legt
                          man versehentlich ein drittes Gericht auf denselben
                          Platz. */}
                      {anzahl > 0 && (
                        <span className={cx('ml-1 text-xs text-ink-400')}>
                          ({anzahl})
                        </span>
                      )}
                    </span>
                  </Button>
                )
              })}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
