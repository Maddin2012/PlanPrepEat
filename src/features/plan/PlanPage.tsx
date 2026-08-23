import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRecipeMap, useRecipes, useSlots } from '../../data/hooks.ts'
import { useRepository } from '../../data/RepositoryContext.tsx'
import type { ISODate, Meal, PlanEntry } from '../../domain/types.ts'
import {
  MEALS,
  MEAL_LABELS,
  PAGE_DAYS,
  addDays,
  calendarDays,
  formatMonth,
  slotKey,
  todayISO,
  windowEnd,
  windowStart,
  type CalendarDay,
} from '../../domain/planWindow.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Button, cx } from '../../components/ui.tsx'
import { PlusIcon } from '../../components/Icons.tsx'
import SlotSheet from './SlotSheet.tsx'

export default function PlanPage() {
  const repository = useRepository()
  const { data: recipes } = useRecipes()
  const recipesById = useRecipeMap()

  // Der geladene Ausschnitt. Er startet beim Fenster um heute herum und
  // wächst beim Scrollen an beiden Enden.
  const [range, setRange] = useState(() => ({
    from: windowStart(),
    to: windowEnd(),
  }))
  const { data: slots } = useSlots(range.from, range.to)

  const [editing, setEditing] = useState<{ date: ISODate; meal: Meal } | null>(
    null,
  )

  const today = todayISO()
  const days = useMemo(
    () => calendarDays(range.from, range.to),
    [range.from, range.to],
  )
  const entriesByKey = useMemo(
    () => new Map(slots.map((slot) => [slot.key, slot.entries])),
    [slots],
  )

  const gridRef = useRef<HTMLDivElement | null>(null)
  const todayRef = useRef<HTMLDivElement | null>(null)
  /** Höhe des Scrollbereichs vor dem Anhängen oben, zum Nachziehen danach. */
  const pendingScrollFix = useRef<number | null>(null)
  /** Sperrt weiteres Nachladen, bis die neuen Tage gezeichnet sind. */
  const loading = useRef(false)
  /** Erst scharf, wenn der Anfangssprung zu heute vorbei ist. */
  const [armed, setArmed] = useState(false)

  const scroller = useCallback(
    () => gridRef.current?.closest('main') ?? null,
    [],
  )

  const scrollToToday = useCallback((behavior: ScrollBehavior = 'smooth') => {
    todayRef.current?.scrollIntoView({ behavior, block: 'center' })
  }, [])

  // Beim Öffnen direkt bei heute stehen, nicht drei Tage davor. Erst danach
  // darf nachgeladen werden — sonst feuern beide Marken schon beim ersten
  // Zeichnen und es stünden auf Anhieb Wochen statt zwölf Tage da.
  useEffect(() => {
    scrollToToday('auto')
    const timer = setTimeout(() => setArmed(true), 250)
    return () => clearTimeout(timer)
    // Nur beim ersten Rendern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Nachladen beim Scrollen an die Ränder.
   *
   * Bewusst über den Scrollabstand und nicht über einen IntersectionObserver:
   * Bei zwölf Tagen sind beide Enden zwangsläufig im Blick, ein Beobachter
   * würde also sofort nachfüllen, bis der Bildschirm voll ist. Gewollt sind
   * aber zwölf Tage, bis jemand tatsächlich scrollt.
   */
  useEffect(() => {
    if (!armed) return
    const root = scroller()
    if (!root) return

    const NEAR_EDGE = 300

    const onScroll = () => {
      if (loading.current) return

      if (root.scrollTop < NEAR_EDGE) {
        loading.current = true
        // Neue Tage über dem Sichtfeld schieben den Inhalt nach unten.
        // Die Höhe vorher merken, um danach exakt gegenzusteuern.
        pendingScrollFix.current = root.scrollHeight
        setRange((current) => ({
          ...current,
          from: addDays(current.from, -PAGE_DAYS),
        }))
        return
      }

      const fromBottom = root.scrollHeight - root.scrollTop - root.clientHeight
      if (fromBottom < NEAR_EDGE) {
        loading.current = true
        setRange((current) => ({
          ...current,
          to: addDays(current.to, PAGE_DAYS),
        }))
      }
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [scroller, armed])

  /**
   * Nach dem Anhängen oben die Scrollposition um die gewachsene Höhe
   * nachziehen — sonst rutscht der Tag unter dem Finger weg. Erst danach
   * ist der nächste Nachschub freigegeben.
   */
  useLayoutEffect(() => {
    const root = scroller()
    const before = pendingScrollFix.current

    if (before !== null && root) {
      pendingScrollFix.current = null
      root.scrollTop += root.scrollHeight - before
    }

    loading.current = false
  }, [days, scroller])

  async function saveSlot(date: ISODate, meal: Meal, entries: PlanEntry[]) {
    await repository.setSlot(slotKey(date, meal), entries)
  }

  const editingEntries = editing
    ? (entriesByKey.get(slotKey(editing.date, editing.meal)) ?? [])
    : []

  return (
    <>
      <PageHeader
        title="Essensplan"
        subtitle="Drei Tage zurück, acht voraus"
        actions={
          <Button
            variant="secondary"
            className="px-3 text-sm"
            onClick={() => scrollToToday()}
          >
            Heute
          </Button>
        }
      />

      <div className="p-3" ref={gridRef}>
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
              todayRef={day.date === today ? todayRef : undefined}
              entriesByKey={entriesByKey}
              recipeName={(id) => recipesById.get(id)?.name}
              onOpen={(meal) => setEditing({ date: day.date, meal })}
            />
          ))}
        </div>

        <p className="py-6 text-center text-xs leading-relaxed text-ink-400">
          Tippe auf ein Feld, um ein Rezept einzuplanen.
          <br />
          Der Kalender läuft in beide Richtungen weiter.
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
    </>
  )
}

function DayRow({
  day,
  todayRef,
  entriesByKey,
  recipeName,
  onOpen,
}: {
  day: CalendarDay
  todayRef?: React.RefObject<HTMLDivElement | null>
  entriesByKey: Map<string, PlanEntry[]>
  recipeName: (id: string) => string | undefined
  onOpen: (meal: Meal) => void
}) {
  return (
    <>
      <div
        ref={todayRef}
        className={cx(
          'flex flex-col items-center justify-center rounded-lg py-2',
          day.isToday && 'bg-leaf-600 text-white',
          !day.isToday && day.isPast && 'text-ink-400',
          !day.isToday && !day.isPast && day.isWeekend && 'bg-clay-100 text-ink-600',
          !day.isToday && !day.isPast && !day.isWeekend && 'text-ink-500',
          // Der Monatserste bekommt etwas Luft davor.
          day.startsMonth && 'mt-4',
        )}
      >
        <span className="text-[0.65rem] font-semibold tracking-wide uppercase">
          {day.weekdayShort}
        </span>
        <span className="text-xs tabular-nums">
          {day.dayLabel.replace(/\.$/, '')}
        </span>
        {day.startsMonth && (
          <span className="mt-0.5 text-[0.55rem] text-ink-400">
            {formatMonth(day.date).split(' ')[0].slice(0, 3)}
          </span>
        )}
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
              // Vergangene Tage treten zurück, ohne unbenutzbar zu werden.
              day.isPast && 'opacity-55',
              day.startsMonth && 'mt-4',
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
