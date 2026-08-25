import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRecipeMap, useRecipes, useSlots } from '../../data/hooks.ts'
import { useRepository } from '../../data/RepositoryContext.tsx'
import type { ISODate, Meal, PlanEntry } from '../../domain/types.ts'
import { isRecipeEntry } from '../../domain/types.ts'
import {
  EXTEND_DAYS,
  MEALS,
  MEAL_LABELS,
  addDays,
  calendarDays,
  calendarRange,
  formatMonth,
  slotKey,
  windowStart,
  type CalendarDay,
} from '../../domain/planWindow.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Button, cx } from '../../components/ui.tsx'
import { PlusIcon } from '../../components/Icons.tsx'
import SlotSheet from './SlotSheet.tsx'

/** Abstand zwischen der klebenden Kopfzeile und der angesprungenen Zeile. */
const HEADER_GAP = 8

export default function PlanPage() {
  const repository = useRepository()
  const { data: recipes } = useRecipes()
  const recipesById = useRecipeMap()

  /**
   * Der geladene Bereich — beim Öffnen ein halbes Jahr am Stück.
   *
   * Früher wurden beim Scrollen laufend Tage angehängt. Genau daran ist es
   * zweimal gescheitert: Wer den Inhalt oberhalb des Sichtfelds verändert,
   * während das Gerät noch scrollt, verschiebt dem Benutzer die Ansicht unter
   * der Hand — und auf dem Handy scrollt es nach dem Wisch von allein weiter.
   * Jetzt steht beim Scrollen alles schon da, und weiter geht es nur auf einen
   * bewussten Tipp am Rand.
   */
  const [range, setRange] = useState(calendarRange)
  const { data: slots, loading: slotsLoading } = useSlots(range.from, range.to)

  const [editing, setEditing] = useState<{ date: ISODate; meal: Meal } | null>(
    null,
  )

  /** Der Tag, der beim Öffnen ganz oben steht: drei Tage vor heute. */
  const startOfView = useMemo(() => windowStart(), [])

  const days = useMemo(
    () => calendarDays(range.from, range.to),
    [range.from, range.to],
  )
  const entriesByKey = useMemo(
    () => new Map(slots.map((slot) => [slot.key, slot.entries])),
    [slots],
  )

  const gridRef = useRef<HTMLDivElement | null>(null)
  /** Jede Datumszelle, nach Datum — daran hängt das Anspringen einer Zeile. */
  const rows = useRef(new Map<ISODate, HTMLDivElement>())
  /** Merkt beim Verlängern nach oben, welche Zeile wo stehen bleiben soll. */
  const anchor = useRef<{ date: ISODate; top: number } | null>(null)
  const opened = useRef(false)

  const scroller = useCallback(
    () => gridRef.current?.closest('main') ?? null,
    [],
  )

  /** Abstand einer Datumszelle vom oberen Rand des Scrollbereichs. */
  const offsetOf = useCallback(
    (date: ISODate): number | null => {
      const root = scroller()
      const row = rows.current.get(date)
      if (!root || !row) return null
      return row.getBoundingClientRect().top - root.getBoundingClientRect().top
    },
    [scroller],
  )

  /**
   * Setzt die Zeile eines Datums direkt unter die Kopfzeile.
   *
   * Bewusst sofort und nicht weich: Eine laufende Bewegung wird auf dem Handy
   * von jeder Berührung abgebrochen, und dann sieht der Knopf „Heute" aus, als
   * täte er nichts. Und bewusst über die gemessene Position statt über
   * scrollIntoView — so hängt nichts an geratenen Abständen zur Kopfzeile.
   */
  const showRowAtTop = useCallback(
    (date: ISODate) => {
      const root = scroller()
      const offset = offsetOf(date)
      if (!root || offset === null) return
      const header = root.querySelector('header')?.offsetHeight ?? 0
      root.scrollTop += offset - header - HEADER_GAP
    },
    [scroller, offsetOf],
  )

  /**
   * Beim Öffnen an die gewohnte Stelle, und nach dem Verlängern nach oben die
   * gemerkte Zeile wieder dorthin, wo sie stand.
   *
   * Die Position wird absolut wiederhergestellt und nicht über die gewachsene
   * Höhe des Inhalts nachgezogen. Das ist der Unterschied, auf den es ankommt:
   * Zieht der Browser von sich aus mit nach (Chrome tut das), landet ein
   * absoluter Wert trotzdem an derselben Stelle, eine Differenz dagegen doppelt
   * daneben.
   */
  useLayoutEffect(() => {
    if (!opened.current) {
      showRowAtTop(startOfView)
      // Solange die eingeplanten Gerichte noch nicht da sind, kann eine Zeile
      // darüber noch wachsen und alles nach unten schieben. Bis dahin wird die
      // Stelle bei jedem Durchlauf neu gesetzt.
      if (!slotsLoading) opened.current = true
      return
    }

    const saved = anchor.current
    if (!saved) return

    const root = scroller()
    const offset = offsetOf(saved.date)
    if (root && offset !== null) root.scrollTop += offset - saved.top

    // Erst im nächsten Bild loslassen: Die Plätze des neuen Bereichs treffen
    // gleich nach dem Zeichnen ein und können die Zeilen darüber noch einmal
    // wachsen lassen. Bis dahin wird weiter nachgezogen — steht schon alles
    // richtig, ist die Korrektur null.
    requestAnimationFrame(() => {
      anchor.current = null
    })
  }, [
    days,
    entriesByKey,
    slotsLoading,
    startOfView,
    scroller,
    offsetOf,
    showRowAtTop,
  ])

  /** Hängt Tage an. Nach oben wird die sichtbare Zeile vorher gemerkt. */
  function extend(direction: 'earlier' | 'later') {
    if (direction === 'later') {
      setRange((current) => ({
        ...current,
        to: addDays(current.to, EXTEND_DAYS),
      }))
      return
    }

    const first = days[0]
    const top = first ? offsetOf(first.date) : null
    anchor.current = first && top !== null ? { date: first.date, top } : null
    setRange((current) => ({
      ...current,
      from: addDays(current.from, -EXTEND_DAYS),
    }))
  }

  async function saveSlot(date: ISODate, meal: Meal, entries: PlanEntry[]) {
    await repository.setSlot(slotKey(date, meal), entries)
  }

  const editingEntries = editing
    ? (entriesByKey.get(slotKey(editing.date, editing.meal)) ?? [])
    : []

  return (
    <>
      <PageHeader
        brand
        title="Essensplan"
        actions={
          <Button
            variant="secondary"
            className="px-3 text-sm"
            onClick={() => showRowAtTop(startOfView)}
          >
            Heute
          </Button>
        }
      />

      {/* overflow-anchor aus: Beim Verlängern soll ausschließlich die Logik
          oben die Position setzen, nicht zusätzlich der Browser. */}
      <div className="p-3 [overflow-anchor:none]" ref={gridRef}>
        <EdgeButton onClick={() => extend('earlier')}>
          {EXTEND_DAYS} Tage früher
        </EdgeButton>

        <div className="mt-3 grid grid-cols-[3rem_1fr_1fr] gap-1.5">
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
              registerRow={(element) => {
                if (element) rows.current.set(day.date, element)
                else rows.current.delete(day.date)
              }}
              entriesByKey={entriesByKey}
              recipeName={(id) => recipesById.get(id)?.name}
              onOpen={(meal) => setEditing({ date: day.date, meal })}
            />
          ))}
        </div>

        <p className="pt-6 pb-3 text-center text-xs leading-relaxed text-ink-400">
          Tippe auf ein Feld, um ein Rezept einzuplanen.
        </p>

        <EdgeButton onClick={() => extend('later')}>
          {EXTEND_DAYS} Tage später
        </EdgeButton>
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

function EdgeButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-dashed border-clay-200 py-2.5 text-xs font-medium text-ink-400 active:bg-clay-50"
    >
      {children}
    </button>
  )
}

function DayRow({
  day,
  registerRow,
  entriesByKey,
  recipeName,
  onOpen,
}: {
  day: CalendarDay
  registerRow: (element: HTMLDivElement | null) => void
  entriesByKey: Map<string, PlanEntry[]>
  recipeName: (id: string) => string | undefined
  onOpen: (meal: Meal) => void
}) {
  return (
    <>
      <div
        ref={registerRow}
        className={cx(
          'flex flex-col items-center justify-center rounded-lg py-2',
          day.isToday && 'bg-accent text-on-accent',
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
                  key={index}
                  className="block text-xs leading-snug font-medium text-ink-900"
                >
                  <span className="line-clamp-2">
                    {isRecipeEntry(entry)
                      ? (recipeName(entry.recipeId) ?? 'Gelöscht')
                      : entry.text}
                  </span>
                  {/* Ein freier Eintrag hat keine Portionen — die Zeile fällt
                      weg, statt „0 Portionen" zu behaupten. */}
                  {isRecipeEntry(entry) && (
                    <span className="text-[0.65rem] font-normal text-ink-400">
                      {entry.servings} Portionen
                    </span>
                  )}
                </span>
              ))
            )}
          </button>
        )
      })}
    </>
  )
}
