import { useMemo, useState } from 'react'
import { useRecipeMap, useRecipes, useSlots } from '../../data/hooks.ts'
import { useRepository } from '../../data/RepositoryContext.tsx'
import type { Meal, PlanEntry } from '../../domain/types.ts'
import {
  MEALS,
  MEAL_LABELS,
  formatPlanRange,
  isWednesday,
  mostRecentWednesday,
  planDays,
  slotKey,
  suggestNextStart,
  todayISO,
} from '../../domain/planWindow.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  Sheet,
  Spinner,
  TextInput,
  cx,
} from '../../components/ui.tsx'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from '../../components/Icons.tsx'
import SlotSheet from './SlotSheet.tsx'
import { useSelectedPlan } from './selectedPlan.ts'

export default function PlanPage() {
  const repository = useRepository()
  const { plans, plan, loading, select } = useSelectedPlan()
  const { data: recipes } = useRecipes()
  const recipesById = useRecipeMap()
  const { data: slots } = useSlots(plan?.id ?? null)

  const [editing, setEditing] = useState<{ date: string; meal: Meal } | null>(
    null,
  )
  const [creating, setCreating] = useState(false)

  const entriesByKey = useMemo(
    () => new Map(slots.map((slot) => [slot.key, slot.entries])),
    [slots],
  )

  const days = useMemo(
    () => (plan ? planDays(plan.startDate) : []),
    [plan],
  )

  // Die Liste kommt neueste zuerst — für „vorheriger/nächster" ist die
  // Reihenfolge auf dem Kalender die richtige.
  const ordered = useMemo(
    () => [...plans].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [plans],
  )
  const position = plan ? ordered.findIndex((entry) => entry.id === plan.id) : -1

  async function saveSlot(date: string, meal: Meal, entries: PlanEntry[]) {
    if (!plan) return
    await repository.setSlot(plan.id, slotKey(date, meal), entries)
  }

  async function createPlan(startDate: string) {
    const created = await repository.createPlan(startDate)
    select(created)
    setCreating(false)
  }

  if (loading) return <Spinner label="Essensplan wird geladen …" />

  if (!plan) {
    const suggestion = mostRecentWednesday(todayISO())
    return (
      <>
        <PageHeader title="Essensplan" />
        <EmptyState
          icon={<CalendarIcon className="size-12" />}
          title="Noch kein Zeitraum angelegt"
          description={`Ein Zeitraum läuft von Mittwoch bis zum Sonntag der Folgewoche. Vorschlag: ${formatPlanRange(suggestion)}.`}
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={() => void createPlan(suggestion)}>
                Zeitraum anlegen
              </Button>
              <Button variant="ghost" onClick={() => setCreating(true)}>
                Anderes Startdatum
              </Button>
            </div>
          }
        />
        <NewPlanSheet
          open={creating}
          onClose={() => setCreating(false)}
          onCreate={createPlan}
          lastStart={null}
        />
      </>
    )
  }

  const editingEntries = editing
    ? (entriesByKey.get(slotKey(editing.date, editing.meal)) ?? [])
    : []

  return (
    <>
      <PageHeader
        title="Essensplan"
        subtitle={formatPlanRange(plan.startDate)}
        actions={
          <IconButton label="Neuer Zeitraum" onClick={() => setCreating(true)}>
            <PlusIcon className="size-5" />
          </IconButton>
        }
        below={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              className="px-3"
              disabled={position <= 0}
              onClick={() => select(ordered[position - 1].id)}
            >
              <ChevronLeftIcon className="size-5" />
              <span className="sr-only">Vorheriger Zeitraum</span>
            </Button>

            <span className="text-xs text-ink-400">
              Zeitraum {position + 1} von {ordered.length}
            </span>

            <Button
              variant="secondary"
              className="px-3"
              disabled={position < 0 || position >= ordered.length - 1}
              onClick={() => select(ordered[position + 1].id)}
            >
              <span className="sr-only">Nächster Zeitraum</span>
              <ChevronRightIcon className="size-5" />
            </Button>
          </div>
        }
      />

      <div className="p-3">
        <div className="grid grid-cols-[3rem_1fr_1fr] gap-1.5">
          <div />
          {MEALS.map((meal) => (
            <div
              key={meal}
              className="pb-1 text-center text-xs font-semibold tracking-wide text-ink-500 uppercase"
            >
              {meal === 'lunch' ? 'Mittag' : 'Abend'}
            </div>
          ))}

          {days.map((day) => (
            <DayRow
              key={day.date}
              day={day}
              entriesByKey={entriesByKey}
              recipeName={(id) => recipesById.get(id)?.name}
              onOpen={(meal) => setEditing({ date: day.date, meal })}
            />
          ))}
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-ink-400">
          Tippe auf ein Feld, um ein Rezept einzuplanen.
          <br />
          Die Einkaufsliste aktualisiert sich dabei von selbst.
        </p>
      </div>

      {editing && (
        <SlotSheet
          open
          onClose={() => setEditing(null)}
          date={editing.date}
          meal={editing.meal}
          entries={editingEntries}
          recipes={recipes}
          onSave={(entries) =>
            void saveSlot(editing.date, editing.meal, entries)
          }
        />
      )}

      <NewPlanSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={createPlan}
        lastStart={ordered.at(-1)?.startDate ?? null}
      />
    </>
  )
}

function DayRow({
  day,
  entriesByKey,
  recipeName,
  onOpen,
}: {
  day: ReturnType<typeof planDays>[number]
  entriesByKey: Map<string, PlanEntry[]>
  recipeName: (id: string) => string | undefined
  onOpen: (meal: Meal) => void
}) {
  return (
    <>
      <div
        className={cx(
          // Die Trennlinie markiert den Übergang in die zweite Woche.
          'flex flex-col items-center justify-center rounded-lg py-2',
          day.isToday && 'bg-leaf-600 text-white',
          !day.isToday && day.isWeekend && 'bg-clay-100 text-ink-600',
          !day.isToday && !day.isWeekend && 'text-ink-500',
          day.startsSecondWeek && 'mt-3',
        )}
      >
        <span className="text-[0.65rem] font-semibold tracking-wide uppercase">
          {day.weekdayShort}
        </span>
        <span className="text-xs tabular-nums">
          {day.dayLabel.replace(/\.$/, '')}
        </span>
      </div>

      {MEALS.map((meal) => {
        const entries = entriesByKey.get(slotKey(day.date, meal)) ?? []
        return (
          <button
            key={meal}
            type="button"
            onClick={() => onOpen(meal)}
            aria-label={`${MEAL_LABELS[meal]} am ${day.weekdayLong}, ${day.dayLabel} bearbeiten`}
            className={cx(
              'flex min-h-16 flex-col justify-center gap-1 rounded-lg p-2 text-left transition-colors',
              entries.length > 0
                ? 'bg-surface ring-1 ring-clay-200 active:bg-clay-50'
                : 'border border-dashed border-clay-200 text-ink-400 active:bg-clay-50',
              day.startsSecondWeek && 'mt-3',
            )}
          >
            {entries.length === 0 ? (
              <PlusIcon className="mx-auto size-4 opacity-50" />
            ) : (
              entries.map((entry, index) => (
                <span
                  key={`${entry.recipeId}-${index}`}
                  className="block text-xs leading-snug font-medium text-ink-900"
                >
                  <span className="line-clamp-2">
                    {recipeName(entry.recipeId) ?? 'Gelöscht'}
                  </span>
                  <span className="text-[0.65rem] font-normal text-ink-400">
                    {entry.servings} Portionen
                  </span>
                </span>
              ))
            )}
          </button>
        )
      })}
    </>
  )
}

/**
 * Neuen Zeitraum anlegen. Vorgeschlagen wird der Mittwoch eine Woche nach dem
 * letzten Plan; ein anderes Datum ist möglich, muss aber ein Mittwoch sein.
 */
function NewPlanSheet({
  open,
  onClose,
  onCreate,
  lastStart,
}: {
  open: boolean
  onClose: () => void
  onCreate: (startDate: string) => void | Promise<void>
  lastStart: string | null
}) {
  const suggestion = suggestNextStart(lastStart)
  const [value, setValue] = useState(suggestion)

  const valid = isWednesday(value)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Neuer Zeitraum"
      footer={
        <Button block disabled={!valid} onClick={() => void onCreate(value)}>
          Anlegen
        </Button>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-ink-600">
        Ein Zeitraum umfasst 12 Tage: Mittwoch bis Sonntag und weiter bis zum
        Sonntag der Folgewoche.
      </p>

      <Field
        label="Startdatum"
        hint={
          valid
            ? formatPlanRange(value)
            : 'Der Zeitraum muss an einem Mittwoch beginnen.'
        }
      >
        <TextInput
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>

      {!valid && (
        <Button
          variant="ghost"
          block
          className="mt-3"
          onClick={() => setValue(mostRecentWednesday(value))}
        >
          Auf den Mittwoch davor setzen
        </Button>
      )}
    </Sheet>
  )
}
