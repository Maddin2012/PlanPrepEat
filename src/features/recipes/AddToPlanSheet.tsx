import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepository } from '../../data/RepositoryContext.tsx'
import { useSlots } from '../../data/hooks.ts'
import type { Meal, Recipe } from '../../domain/types.ts'
import { addDays, slotKey, todayISO } from '../../domain/planWindow.ts'
import { Sheet } from '../../components/ui.tsx'
import DayPicker, { DAYS_AHEAD } from '../plan/DayPicker.tsx'

/**
 * Ein Rezept vom Rezeptbuch aus einplanen.
 *
 * Geöffnet wird es über das Pluszeichen an der Zeile im Rezeptbuch — dort geht
 * man die Rezepte durch, wenn man den Plan füllt. Vorher musste man sich den
 * Namen merken, in den Essensplan wechseln, den Tag suchen und das Rezept dort
 * noch einmal auswählen. Hier steht die Liste der nächsten Tage, ein Tipp
 * genügt.
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
  /**
   * Mit wie vielen Portionen der Eintrag angelegt wird. Aus der Liste heraus die
   * Angabe des Rezepts; ändern lässt sie sich danach im Plan am Eintrag selbst.
   */
  servings: number
  onClose: () => void
}) {
  const repository = useRepository()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  // Derselbe Zeitraum, den `DayPicker` zeigt — hier nur, um nachzusehen, was
  // auf dem gewählten Platz schon liegt.
  const heute = todayISO()
  const { data: slots } = useSlots(heute, addDays(heute, DAYS_AHEAD - 1))
  const belegt = new Map(slots.map((slot) => [slot.key, slot.entries]))

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
      <DayPicker disabled={busy} onPick={(datum, meal) => void add(datum, meal)} />
    </Sheet>
  )
}
