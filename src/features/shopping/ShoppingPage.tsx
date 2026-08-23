import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useIngredientMap,
  useRecipeMap,
  useShoppingState,
  useSlots,
} from '../../data/hooks.ts'
import { useRepository } from '../../data/RepositoryContext.tsx'
import type {
  ManualItem,
  ShoppingItem,
  ShoppingState,
  UnitCode,
} from '../../domain/types.ts'
import {
  buildShoppingList,
  collectPlanned,
  liveShoppingKeys,
  manualKey,
  parseManualKey,
  pruneShoppingState,
} from '../../domain/aggregate.ts'
import { UNIT_LABELS, UNIT_ORDER, formatAmount } from '../../domain/units.ts'
import { formatShoppingListText } from '../../domain/exportList.ts'
import {
  formatRange,
  windowEnd,
  windowStart,
} from '../../domain/planWindow.ts'
import { newId } from '../../data/ids.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  Select,
  Sheet,
  Spinner,
  TextInput,
  cx,
} from '../../components/ui.tsx'
import {
  CartIcon,
  CheckIcon,
  CloseIcon,
  GripIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
} from '../../components/Icons.tsx'
import { shareText } from '../../lib/share.ts'
import { parseAmount } from '../recipes/ingredientDraft.ts'

export default function ShoppingPage() {
  const repository = useRepository()

  // Die Liste hängt fest an heute — sie folgt dem Kalender nicht, wenn dort
  // weit vorgeblättert wird. Wer im Supermarkt steht, will nicht plötzlich die
  // Zutaten vom nächsten Monat vor sich haben.
  const [from, to] = useMemo(() => [windowStart(), windowEnd()], [])

  const { data: slots } = useSlots(from, to)
  const recipesById = useRecipeMap()
  const ingredients = useIngredientMap()
  const { data: state, loading: stateLoading } = useShoppingState()

  const [hideDone, setHideDone] = useState(false)
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const planned = useMemo(
    () => collectPlanned(slots, recipesById),
    [slots, recipesById],
  )

  const items = useMemo(
    () => buildShoppingList(planned, ingredients, state),
    [planned, ingredients, state],
  )

  /**
   * Jede Änderung schreibt den ganzen Zustand zurück und räumt dabei auf, was
   * zu keinem Posten mehr gehört — sonst sammelten sich Häkchen von Rezepten an,
   * die längst nicht mehr im Plan stehen.
   */
  const update = useCallback(
    (change: (current: ShoppingState) => ShoppingState) => {
      const next = change(state)
      const live = liveShoppingKeys(planned)
      void repository.saveShoppingState(pruneShoppingState(next, live))
    },
    [state, planned, repository],
  )

  const toggle = useCallback(
    (item: ShoppingItem) => {
      update((current) => ({
        ...current,
        checked: { ...current.checked, [item.key]: !item.checked },
      }))
    },
    [update],
  )

  // Die Liste kommt schon sortiert an: offene zuerst, dann die abgehakten.
  const open = items.filter((item) => !item.checked)
  const done = items.filter((item) => item.checked)
  const openCount = open.length

  /**
   * Verschieben. Beim ersten Mal wird die aktuelle Reihenfolge aller Posten
   * festgeschrieben — vorher ist `order` leer und alles steht alphabetisch.
   * Abgehakte hängen hinten dran, damit sie ihre Position behalten, wenn das
   * Häkchen später wieder wegfällt.
   */
  const move = useCallback(
    (fromKey: string, toKey: string) => {
      const keys = [...open.map((item) => item.key), ...done.map((item) => item.key)]
      const from = keys.indexOf(fromKey)
      const to = keys.indexOf(toKey)
      if (from === -1 || to === -1 || from === to) return

      keys.splice(to, 0, ...keys.splice(from, 1))
      update((current) => ({ ...current, order: keys }))
    },
    [open, done, update],
  )

  /**
   * Einen eigenen Posten anlegen — nur der Name, wie in Google Notizen. Menge
   * und Einheit kommen bei Bedarf hinterher über das Antippen der Zeile.
   *
   * Er soll unten in der offenen Liste stehen, wo man ihn hingeschrieben hat.
   * Dafür wird — wie beim ersten Verschieben auch — die aktuelle Reihenfolge
   * festgeschrieben und der neue Schlüssel ans Ende der offenen Posten gehängt.
   * Ab dann ist die Liste von Hand sortiert statt alphabetisch.
   */
  const addManual = useCallback(
    (name: string) => {
      const entry: ManualItem = {
        id: newId(),
        name,
        amount: null,
        unit: null,
      }
      const order = [
        ...open.map((item) => item.key),
        manualKey(entry.id),
        ...done.map((item) => item.key),
      ]
      update((current) => ({
        ...current,
        manual: [...current.manual, entry],
        order,
      }))
    },
    [open, done, update],
  )

  function flash(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2600)
  }

  /**
   * Ein Symbol für beides: `shareText` weicht auf die Zwischenablage aus, wenn
   * das Gerät keinen Teilen-Dialog hat. Auf dem Handy öffnet sich also Android,
   * am Rechner wird kopiert.
   */
  async function exportList() {
    const text = formatShoppingListText(items, { from, to })
    const result = await shareText({ title: 'Einkaufsliste', text })
    if (result === 'copied') flash('Liste in die Zwischenablage kopiert.')
    else if (result === 'failed') flash('Das hat leider nicht geklappt.')
  }

  if (stateLoading) {
    return <Spinner label="Einkaufsliste wird geladen …" />
  }

  return (
    <>
      <PageHeader
        brand
        title="Einkaufsliste"
        subtitle={formatRange(from, to)}
        actions={
          <IconButton
            label="Liste exportieren"
            className="bg-accent text-on-accent active:bg-accent-strong"
            onClick={() => void exportList()}
          >
            <ShareIcon className="size-5" />
          </IconButton>
        }
        below={
          items.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-ink-500">
                {openCount === 0
                  ? 'Alles erledigt'
                  : `${openCount} von ${items.length} offen`}
              </span>
              <button
                type="button"
                onClick={() => setHideDone(!hideDone)}
                className="text-xs font-medium text-accent-text"
              >
                {hideDone ? 'Erledigte einblenden' : 'Erledigte ausblenden'}
              </button>
            </div>
          ) : undefined
        }
      />

      {items.length === 0 && (
        <EmptyState
          icon={<CartIcon className="size-12" />}
          title="Die Liste ist noch leer"
          description="Plan ein paar Rezepte ein — die Zutaten landen dann automatisch hier."
          action={
            <Link to="/plan">
              <Button variant="secondary">Zum Essensplan</Button>
            </Link>
          }
        />
      )}

      {/* Die Eingabezeile steht auch bei leerer Liste da: Sonst käme man ohne
          eingeplante Rezepte gar nicht an einen eigenen Posten heran. */}
      <div className="space-y-5 px-4 pt-4 pb-6">
        <div className="space-y-2">
          <SortableList
            items={open}
            onMove={move}
            onToggle={toggle}
            onEdit={setEditing}
          />
          <AddItemRow onAdd={addManual} />
        </div>

        {!hideDone && done.length > 0 && (
          <section>
            <h2 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">
              Erledigt ({done.length})
            </h2>
            <ul className="divide-y divide-clay-200/70 overflow-hidden rounded-2xl bg-surface ring-1 ring-clay-200">
              {done.map((item) => (
                <li key={item.key}>
                  <ItemRow
                    item={item}
                    onToggle={() => toggle(item)}
                    onEdit={() => setEditing(item)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {editing && (
        <EditItemSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            const item = editing
            const id = parseManualKey(item.key)

            update((current) =>
              // Bei einem eigenen Posten wird der Posten selbst geändert, bei
              // einem aus dem Rezept berechneten nur die Menge überschrieben.
              id
                ? {
                    ...current,
                    manual: current.manual.map((entry) =>
                      entry.id === id
                        ? {
                            ...entry,
                            name: values.name ?? entry.name,
                            amount: values.amount,
                            // Eine Einheit ohne Menge sagt nichts aus.
                            unit: values.amount === null ? null : values.unit,
                          }
                        : entry,
                    ),
                  }
                : {
                    ...current,
                    overrides: {
                      ...current.overrides,
                      [item.key]: values.amount ?? 0,
                    },
                  },
            )
            setEditing(null)
          }}
          onReset={() => {
            const key = editing.key
            update((current) => {
              const { [key]: _dropped, ...rest } = current.overrides
              return { ...current, overrides: rest }
            })
            setEditing(null)
          }}
          onRemove={() => {
            const item = editing
            update((current) =>
              item.manual
                ? {
                    ...current,
                    manual: current.manual.filter(
                      (entry) => manualKey(entry.id) !== item.key,
                    ),
                  }
                : { ...current, removed: [...current.removed, item.key] },
            )
            setEditing(null)
          }}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl bg-overlay px-4 py-3 text-center text-sm text-on-overlay shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}

/**
 * Die Zeile zum Anlegen eigener Posten, nach dem Vorbild von Google Notizen.
 *
 * Ruhend steht dort nur „+ Listeneintrag". Ein Tipp macht daraus eine Zeile im
 * Zuschnitt der Liste mit Textfeld und einem X zum Verwerfen — kein Formular,
 * kein Blatt, das sich über die Liste legt. Enter legt den Posten an und öffnet
 * gleich die nächste Zeile, damit man mehrere hintereinander schreiben kann.
 */
function AddItemRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [writing, setWriting] = useState(false)
  const [name, setName] = useState('')

  function open() {
    setName('')
    setWriting(true)
  }

  function discard() {
    setName('')
    setWriting(false)
  }

  /** Legt den Posten an, sofern etwas dasteht. Meldet, ob es dazu kam. */
  function commit(): boolean {
    const trimmed = name.trim()
    if (!trimmed) return false
    onAdd(trimmed)
    setName('')
    return true
  }

  if (!writing) {
    return (
      <button
        type="button"
        onClick={open}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-ink-400 transition-colors active:bg-clay-100"
      >
        <PlusIcon className="size-5 shrink-0" />
        <span className="text-sm">Listeneintrag</span>
      </button>
    )
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl bg-surface ring-1 ring-clay-200">
      <span className="flex items-center pl-3">
        <span className="size-6 shrink-0 rounded-md border-2 border-clay-300" />
      </span>

      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Listeneintrag"
        aria-label="Neuer Listeneintrag"
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-ink-900 outline-none placeholder:text-ink-400"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            // Nach dem Anlegen bleibt der Fokus stehen, die Zeile ist wieder
            // leer — so schreibt man mehrere Posten hintereinander.
            if (!commit()) discard()
          } else if (event.key === 'Escape') {
            discard()
          }
        }}
        onBlur={() => {
          // Wegtippen zählt als Übernehmen, wenn etwas dasteht — sonst wäre das
          // Getippte weg, obwohl man es sichtbar hingeschrieben hat.
          commit()
          setWriting(false)
        }}
      />

      <button
        type="button"
        aria-label="Eintrag verwerfen"
        // Vor dem Verlassen des Feldes zuschlagen: onBlur würde sonst zuerst
        // laufen und den Posten anlegen, den dieser Knopf gerade wegwerfen soll.
        onMouseDown={(event) => event.preventDefault()}
        onClick={discard}
        className="flex shrink-0 items-center px-3 text-ink-400 transition-colors active:text-ink-600"
      >
        <CloseIcon className="size-5" />
      </button>
    </div>
  )
}

function ItemRow({
  item,
  onToggle,
  onEdit,
  handle,
}: {
  item: ShoppingItem
  onToggle: () => void
  onEdit: () => void
  /** Der Anfasser zum Verschieben, nur bei offenen Posten. */
  handle?: ReactNode
}) {
  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={item.checked}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left transition-colors active:bg-clay-50"
      >
        <span
          className={cx(
            'flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
            item.checked
              ? 'border-accent bg-accent text-on-accent'
              : 'border-clay-300',
          )}
        >
          {item.checked && <CheckIcon className="size-4" strokeWidth={2.5} />}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cx(
              'block truncate',
              item.checked ? 'text-ink-400 line-through' : 'text-ink-900',
            )}
          >
            {item.name}
          </span>
          {item.sources.length > 1 && !item.checked && (
            <span className="block truncate text-xs text-ink-400">
              {item.sources.join(' · ')}
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`${item.name} bearbeiten`}
        className={cx(
          'flex shrink-0 items-center gap-1 px-3 text-sm font-medium tabular-nums transition-colors active:bg-clay-50',
          item.checked ? 'text-ink-400' : 'text-ink-600',
        )}
      >
        {formatAmount(item.amount, item.unit) || '–'}
        {item.edited && (
          <span
            title="Menge von Hand geändert"
            className="size-1.5 rounded-full bg-accent"
          />
        )}
      </button>

      {handle}
    </div>
  )
}

/**
 * Der verschiebbare Teil der Liste — die offenen Posten.
 *
 * Gezogen wird ausschließlich am Anfasser rechts. Läge der Griff auf der ganzen
 * Zeile, kämen sich Wischen zum Scrollen und Ziehen zum Sortieren dauernd in
 * die Quere, und Antippen zum Abhaken gleich mit.
 */
function SortableList({
  items,
  onMove,
  onToggle,
  onEdit,
}: {
  items: ShoppingItem[]
  onMove: (fromKey: string, toKey: string) => void
  onToggle: (item: ShoppingItem) => void
  onEdit: (item: ShoppingItem) => void
}) {
  const sensors = useSensors(
    // Erst nach ein paar Pixeln Bewegung greifen, sonst zählt schon ein
    // Antippen des Griffs als Ziehen.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (items.length === 0) return null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) {
          onMove(String(active.id), String(over.id))
        }
      }}
    >
      <SortableContext
        items={items.map((item) => item.key)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="divide-y divide-clay-200/70 overflow-hidden rounded-2xl bg-surface ring-1 ring-clay-200">
          {items.map((item) => (
            <SortableRow
              key={item.key}
              item={item}
              onToggle={() => onToggle(item)}
              onEdit={() => onEdit(item)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  item,
  onToggle,
  onEdit,
}: {
  item: ShoppingItem
  onToggle: () => void
  onEdit: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        'bg-surface',
        // Die gezogene Zeile über die anderen legen, sonst verschwindet sie
        // beim Vorbeiziehen unter der Nachbarzeile.
        isDragging && 'relative z-10 shadow-lg ring-1 ring-accent',
      )}
    >
      <ItemRow
        item={item}
        onToggle={onToggle}
        onEdit={onEdit}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`${item.name} verschieben`}
            // touch-none verhindert, dass der Browser die Geste als Scrollen
            // beansprucht, bevor dnd-kit sie überhaupt zu sehen bekommt.
            className="flex shrink-0 touch-none items-center px-2.5 text-clay-300 transition-colors active:text-ink-500"
            {...attributes}
            {...listeners}
          >
            <GripIcon className="size-5" />
          </button>
        }
      />
    </li>
  )
}

/** Was das Blatt zurückmeldet. Wohin es gehört, entscheidet die Seite. */
interface ItemEdit {
  /** Nur bei eigenen Posten — abgeleitete tragen den Namen der Zutat. */
  name?: string
  /** null heißt „ohne Mengenangabe". */
  amount: number | null
  unit: UnitCode | null
}

/**
 * Einen Posten bearbeiten.
 *
 * Bei einem eigenen Posten steht hier alles, was er hat — Name, Menge, Einheit.
 * Das ist seit dem Wegfall des Hinzufügen-Blattes die einzige Stelle dafür: Die
 * Zeile unter der Liste legt bewusst nur den Namen an, wie in Google Notizen.
 * Bei einem aus dem Rezept berechneten Posten geht es nur um die Menge; Name
 * und Einheit kommen aus der Zutat und wären hier fehl am Platz.
 */
function EditItemSheet({
  item,
  onClose,
  onSave,
  onReset,
  onRemove,
}: {
  item: ShoppingItem
  onClose: () => void
  onSave: (values: ItemEdit) => void
  onReset: () => void
  onRemove: () => void
}) {
  const [name, setName] = useState(item.name)
  const [value, setValue] = useState(
    item.amount === null ? '' : String(item.amount).replace('.', ','),
  )
  const [unit, setUnit] = useState<UnitCode>(item.unit ?? 'stk')

  function submit() {
    const parsed = parseAmount(value)
    onSave({
      name: item.manual ? name.trim() || item.name : undefined,
      amount: parsed > 0 ? parsed : null,
      unit,
    })
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Abbrechen
          </Button>
          <Button className="flex-[2]" onClick={submit}>
            Übernehmen
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {item.manual && (
          <Field label="Name">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        )}

        {item.manual ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Menge" hint="Optional.">
              <TextInput
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="1"
              />
            </Field>
            <Field label="Einheit">
              <Select
                value={unit}
                onChange={(event) => setUnit(event.target.value as UnitCode)}
              >
                {UNIT_ORDER.map((entry) => (
                  <option key={entry} value={entry}>
                    {UNIT_LABELS[entry]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <Field
            label="Menge"
            hint={
              item.unit
                ? `In ${UNIT_LABELS[item.unit]}. Gilt nur für diese Einkaufsliste, das Rezept bleibt unverändert.`
                : 'Gilt nur für diese Einkaufsliste.'
            }
          >
            <TextInput
              autoFocus
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
        )}
      </div>

      {item.sources.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-ink-400">
          Kommt aus: {item.sources.join(', ')}
        </p>
      )}

      <div className="mt-5 space-y-2">
        {item.edited && (
          <Button variant="secondary" block onClick={onReset}>
            Auf die berechnete Menge zurücksetzen
          </Button>
        )}
        <Button variant="ghost" block className="text-red-600" onClick={onRemove}>
          <TrashIcon className="size-5" />
          {item.manual ? 'Posten löschen' : 'Brauche ich nicht'}
        </Button>
      </div>
    </Sheet>
  )
}
