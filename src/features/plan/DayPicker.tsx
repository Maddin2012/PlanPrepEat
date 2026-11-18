import { useMemo } from 'react'
import { useSlots } from '../../data/hooks.ts'
import type { Meal } from '../../domain/types.ts'
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
import { Button, cx } from '../../components/ui.tsx'

/** So weit voraus lässt sich planen — zwei Wochen reichen. */
export const DAYS_AHEAD = 14

/**
 * Die Liste „welcher Tag, welche Mahlzeit".
 *
 * Eigener Baustein, weil zwei Blätter dieselbe Frage stellen: **Einplanen**
 * vom Rezeptbuch aus („Wann soll es das geben?") und **Verschieben** vom
 * Essensplan aus („Wohin damit?"). Zweimal hingeschrieben liefen die beiden
 * auseinander — und dann hieße dasselbe Bild an zwei Stellen etwas anderes.
 *
 * Wie viel auf einem Platz schon liegt, steht in Klammern dabei. Ohne das legt
 * man versehentlich ein drittes Gericht auf denselben Platz.
 */
export default function DayPicker({
  onPick,
  disabled,
  /** Dieser Platz ist der, an dem es gerade liegt — er wird markiert. */
  currentSlot,
}: {
  onPick: (datum: string, meal: Meal) => void
  disabled?: boolean
  currentSlot?: string
}) {
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

  return (
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
              const key = slotKey(datum, meal)
              const anzahl = (belegt.get(key) ?? []).length
              const hier = key === currentSlot
              return (
                <Button
                  key={meal}
                  variant="secondary"
                  className={cx('min-w-0 flex-1', hier && 'ring-1 ring-accent')}
                  // Der Platz, an dem es schon liegt, ist kein Ziel.
                  disabled={disabled || hier}
                  onClick={() => onPick(datum, meal)}
                >
                  <span className="truncate">
                    {MEAL_LABELS[meal]}
                    {anzahl > 0 && (
                      <span className="ml-1 text-xs text-ink-400">
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
  )
}
