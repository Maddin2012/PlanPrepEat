import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NO_SWIPE } from '../../lib/gesture.ts'
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
  buildStruckItems,
  collectPlanned,
  liveShoppingKeys,
  manualKey,
  parseManualKey,
  orderKey,
  pruneShoppingState,
  reorderStore,
} from '../../domain/aggregate.ts'
import { clearMark, setMark } from '../../domain/shoppingMarks.ts'
import { canonical } from '../../domain/undoHistory.ts'
import {
  clearUndo,
  isOwnEcho,
  popUndo,
  pushUndo,
  rememberEcho,
  useUndo,
} from '../../lib/undoStore.ts'
import { UNIT_LABELS, UNIT_ORDER, formatAmount } from '../../domain/units.ts'
import { formatShoppingListText } from '../../domain/exportList.ts'
import {
  formatRange,
  windowEnd,
  windowStart,
  todayISO,
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
  UndoIcon,
} from '../../components/Icons.tsx'
import { findByName, suggestNames } from '../../domain/shoppingNames.ts'
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
  /**
   * Der Rückgängig-Stapel. Er liegt außerhalb dieser Seite und übersteht
   * deshalb einen Wechsel auf einen anderen Reiter — siehe `lib/undoStore.ts`.
   */
  const undoStack = useUndo()
  // Welcher Posten gerade kurz hervorgehoben wird — nach dem Versuch, ihn ein
  // zweites Mal anzulegen.
  const [highlight, setHighlight] = useState<string | null>(null)

  const planned = useMemo(
    () => collectPlanned(slots, recipesById),
    [slots, recipesById],
  )

  const items = useMemo(
    () => buildShoppingList(planned, ingredients, state),
    [planned, ingredients, state],
  )

  /**
   * Die gestrichenen Posten — die sollen **sichtbar** sein.
   *
   * Vorher verschwand ein gestrichener Posten lautlos und für immer. Dass hier
   * eine zweite Liste steht, ist der Kern der Reparatur: Was nicht auf der
   * Einkaufsliste landet, muss irgendwo stehen, wo man es sieht und
   * zurückholen kann.
   */
  const struck = useMemo(
    () => buildStruckItems(planned, ingredients, state),
    [planned, ingredients, state],
  )

  /**
   * Woraus die Vorschläge beim Tippen kommen: der Zutatenkatalog — alles, was
   * je in einem Rezept stand — und die Namen, die gerade auf der Liste stehen.
   * Der Katalog ist die eigentliche Quelle; die Liste kommt dazu, damit ein
   * eben erst von Hand getippter Posten sofort wiedergefunden wird.
   */
  const knownNames = useMemo(
    () => [
      ...[...ingredients.values()].map((zutat) => zutat.name),
      ...items.map((item) => item.name),
    ],
    [ingredients, items],
  )

  /**
   * Jede Änderung schreibt den ganzen Zustand zurück und räumt dabei auf, was
   * zu keinem Posten mehr gehört — sonst sammelten sich Häkchen von Rezepten an,
   * die längst nicht mehr im Plan stehen.
   *
   * **Hier hängt auch das Rückgängig.** Weil alles auf dieser Seite durch
   * diesen einen Trichter läuft, genügt es, davor den Stand wegzusichern. Die
   * Beschriftung sagt, was zurückgenommen würde; sie steht später in der
   * Meldung, damit man liest, was wiederhergestellt wurde.
   */
  const update = useCallback(
    (label: string, change: (current: ShoppingState) => ShoppingState) => {
      const next = pruneShoppingState(change(state), liveShoppingKeys(planned))
      pushUndo(label, state)
      rememberEcho(canonical(next))
      void repository.saveShoppingState(next)
    },
    [state, planned, repository],
  )

  /**
   * Hat jemand **anderes** die Liste geändert, fliegt der Stapel weg.
   *
   * Der Haushalt hängt an derselben Liste. Käme über die Verbindung die
   * Änderung der anderen Person an und Martin tippte danach auf Rückgängig,
   * würde er ihre Arbeit mitlöschen. Erkannt wird das daran, dass der
   * ankommende Stand nicht das eigene Echo ist.
   *
   * Im Zweifel verschwindet der Knopf, statt falsch zu handeln.
   *
   * **Solange noch geladen wird, wird nicht geurteilt.** Beim Wechsel auf
   * diesen Reiter wird die Seite neu aufgebaut und steht einen Augenblick mit
   * einem leeren Zustand da, bevor der echte eintrifft. Ohne diese Zeile hielte
   * die App diesen leeren Stand für eine fremde Änderung und würfe den Stapel
   * weg — genau der Fall, für den Martin ihn haben wollte.
   */
  useEffect(() => {
    if (stateLoading) return
    if (!isOwnEcho(canonical(state))) clearUndo()
  }, [state, stateLoading])

  /** Einen Schritt zurück. */
  const undo = useCallback(() => {
    const letzter = popUndo()
    if (!letzter) return
    rememberEcho(canonical(letzter.state))
    void repository.saveShoppingState(letzter.state)
    flash(`Rückgängig: ${letzter.label}`)
  }, [repository])

  const toggle = useCallback(
    (item: ShoppingItem) => {
      update(
        item.checked ? `${item.name} wieder offen` : `${item.name} abgehakt`,
        (current) => ({
          ...current,
          // Das Häkchen trägt den Tag, an dem es gesetzt wurde, und gilt eine
          // Woche. Wegnehmen heißt: die Marke löschen, nicht `false` hinschreiben.
          checked: item.checked
            ? clearMark(current.checked, item.key)
            : setMark(current.checked, item.key, todayISO()),
        }),
      )
    },
    [update],
  )

  /** Eine Streichung aufheben — der Posten steht gleich wieder oben. */
  const restore = useCallback(
    (item: ShoppingItem) => {
      update(`${item.name} zurück auf die Liste`, (current) => ({
        ...current,
        removed: clearMark(current.removed, item.key),
      }))
      flash(`${item.name} steht wieder auf der Liste.`)
    },
    [update],
  )

  // Die Liste kommt schon sortiert an: offene zuerst, dann die abgehakten.
  const open = items.filter((item) => !item.checked)
  const done = items.filter((item) => item.checked)
  const openCount = open.length

  /**
   * Verschieben — und damit die Ladenreihenfolge fortschreiben.
   *
   * Beim ersten Mal wird die aktuelle Reihenfolge festgeschrieben; vorher ist
   * die Runde leer und alles steht alphabetisch. Abgehakte hängen hinten dran,
   * damit sie ihre Position behalten, wenn das Häkchen später wieder wegfällt.
   *
   * Gemerkt wird über `orderKey`, also je Zutat statt je Listenschlüssel — und
   * über `reorderStore`, damit Zutaten, die gerade nicht auf der Liste stehen,
   * ihren Platz behalten. Ein schlichtes Ersetzen hätte sie verloren.
   *
   * **Die abgehakten Posten fließen hier nicht ein.** Sie hingen früher hinten
   * dran, und zwar mit dem Ziel, ihre Position zu behalten — erreicht wurde das
   * Gegenteil: `reorderStore` füllt jeden sichtbaren Platz neu, also auch den
   * von Zucker, wenn man oben Mehl verschiebt. Lässt man sie weg, bleibt ihr
   * Platz unberührt, und das Verschieben ordnet nur das um, was man gerade
   * sehen und anfassen kann.
   */
  const move = useCallback(
    (fromKey: string, toKey: string) => {
      const keys = open.map((item) => item.key)
      const from = keys.indexOf(fromKey)
      const to = keys.indexOf(toKey)
      if (from === -1 || to === -1 || from === to) return

      keys.splice(to, 0, ...keys.splice(from, 1))
      const visible = [...new Set(keys.map(orderKey))]
      update('Reihenfolge geändert', (current) => ({
        ...current,
        storeOrder: reorderStore(current.storeOrder, visible),
      }))
    },
    [open, update],
  )

  /**
   * Einen eigenen Posten anlegen — nur der Name, wie in Google Notizen. Menge
   * und Einheit kommen bei Bedarf hinterher über das Antippen der Zeile.
   *
   * Er soll unten in der offenen Liste stehen, wo man ihn hingeschrieben hat.
   * Dafür wird — wie beim Verschieben auch — die aktuelle Reihenfolge in die
   * Ladenrunde geschrieben, mit dem neuen Schlüssel am Ende der offenen Posten.
   * Ab dann ist die Liste von Hand sortiert statt alphabetisch.
   */
  const addManual = useCallback(
    (name: string) => {
      /*
       * **Erst nachsehen, ob der Name schon dasteht.** Vorher wurde hier
       * bedingungslos ein neuer Posten angelegt, und aus zweimal „Avocado"
       * wurden zwei Zeilen — auch dann, wenn die erste aus einem Rezept kam:
       * Abgeleitete und eigene Posten liegen in getrennten Schlüsselräumen, der
       * Name ist das Einzige, was sie verbindet.
       *
       * Gibt es ihn schon, wird der vorhandene **wieder geöffnet**: Häkchen
       * weg, damit er aus „Erledigt" zurück nach oben kommt. Genau das ist das
       * Wiederverwenden, um das es geht.
       *
       * Auch ein **gestrichener** Posten zählt als vorhanden: Dessen Streichung
       * wird aufgehoben, statt daneben einen eigenen Posten mit demselben Namen
       * anzulegen. Sonst stünde „Kartoffeln" zweimal in der App — einmal
       * gestrichen und einmal von Hand.
       */
      const gestrichenerPosten = findByName(struck, name)
      if (gestrichenerPosten) {
        update(`${name.trim()} zurück auf die Liste`, (current) => ({
          ...current,
          removed: clearMark(current.removed, gestrichenerPosten),
          checked: clearMark(current.checked, gestrichenerPosten),
        }))
        setHighlight(gestrichenerPosten)
        setTimeout(() => setHighlight(null), 2600)
        flash(`${name.trim()} steht wieder auf der Liste.`)
        return
      }

      const vorhanden = findByName(items, name)
      if (vorhanden) {
        update(`${name.trim()} wieder offen`, (current) => ({
          ...current,
          checked: clearMark(current.checked, vorhanden),
        }))
        setHighlight(vorhanden)
        setTimeout(() => setHighlight(null), 2600)
        flash(`${name.trim()} steht schon auf der Liste.`)
        return
      }

      const entry: ManualItem = {
        id: newId(),
        name,
        amount: null,
        unit: null,
      }
      const visible = [
        ...new Set(
          [...open.map((item) => item.key), manualKey(entry.id)].map(orderKey),
        ),
      ]
      update(`${name} angelegt`, (current) => ({
        ...current,
        manual: [...current.manual, entry],
        storeOrder: reorderStore(current.storeOrder, visible),
      }))
    },
    [items, open, update],
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
          // Auch bei leerer Liste: Wer seinen einzigen eigenen Posten gelöscht
          // hat, braucht den Rückgängig-Knopf gerade dann.
          items.length > 0 || undoStack.length > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs text-ink-500">
                {items.length === 0
                  ? ''
                  : openCount === 0
                    ? 'Alles erledigt'
                    : `${openCount} von ${items.length} offen`}
              </span>

              <div className="flex shrink-0 items-center gap-3">
                {undoStack.length > 0 && (
                  // Die Beschriftung steht nicht im Knopf — bei 390 px wäre
                  // „Rückgängig: Kartoffeln abgehakt" neben allem anderen nicht
                  // unterzubringen. Sie steht in der Vorlesehilfe und nach dem
                  // Tippen in der Meldung.
                  <button
                    type="button"
                    onClick={undo}
                    aria-label={`Rückgängig: ${undoStack[0].label}`}
                    className="flex items-center gap-1 text-xs font-medium text-accent-text"
                  >
                    <UndoIcon className="size-4" />
                    Rückgängig
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHideDone(!hideDone)}
                    className="text-xs font-medium text-accent-text"
                  >
                    {hideDone ? 'Erledigte einblenden' : 'Erledigte ausblenden'}
                  </button>
                )}
              </div>
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
            highlight={highlight}
            onMove={move}
            onToggle={toggle}
            onEdit={setEditing}
          />
          <AddItemRow onAdd={addManual} names={knownNames} />
        </div>

        {!hideDone && done.length > 0 && (
          <section>
            <h2 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">
              Erledigt ({done.length})
            </h2>
            <ul className="divide-y divide-clay-200/70 overflow-hidden rounded-2xl bg-surface ring-1 ring-clay-200">
              {done.map((item) => (
                <li key={item.key} className={cx(item.key === highlight && 'ring-1 ring-accent')}>
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

        {/*
          Die gestrichenen Posten — der Block, an dem dieser Fehler gescheitert
          wäre. Vorher waren sie weg, ohne Spur: kein Hinweis, keine Liste, kein
          Weg zurück, und das auf Dauer und in jedem Rezept. Jetzt stehen sie
          hier, durchgestrichen, und ein Tipp holt einen zurück.

          Bewusst **nicht** von „Erledigte ausblenden" betroffen: Erledigtes hat
          man gekauft, Gestrichenes fehlt — das soll man sehen.
        */}
        {struck.length > 0 && (
          <section>
            <h2 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-ink-400 uppercase">
              Brauche ich diese Woche nicht ({struck.length})
            </h2>
            <ul className="divide-y divide-clay-200/70 overflow-hidden rounded-2xl bg-surface ring-1 ring-clay-200">
              {struck.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => restore(item)}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors active:bg-clay-100"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-400 line-through">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-accent-text">
                      Zurück auf die Liste
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 px-1 text-xs leading-relaxed text-ink-400">
              Nach einer Woche stehen sie von selbst wieder oben.
            </p>
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

            update(`${item.name} geändert`, (current) =>
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
            update(`${editing.name} auf die berechnete Menge zurück`, (current) => {
              const { [key]: _dropped, ...rest } = current.overrides
              return { ...current, overrides: rest }
            })
            setEditing(null)
          }}
          onRemove={() => {
            const item = editing
            update(
              item.manual
                ? `${item.name} gelöscht`
                : `${item.name} gestrichen`,
              (current) =>
              item.manual
                ? {
                    ...current,
                    manual: current.manual.filter(
                      (entry) => manualKey(entry.id) !== item.key,
                    ),
                  }
                : {
                    ...current,
                    // Die Streichung gilt eine Woche und ist unten im eigenen
                    // Block sichtbar — nicht mehr eine stille Sperre auf Dauer.
                    removed: setMark(current.removed, item.key, todayISO()),
                  },
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
function AddItemRow({
  onAdd,
  names,
}: {
  onAdd: (name: string) => void
  /** Woraus die Vorschläge kommen: Zutatenkatalog plus die aktuelle Liste. */
  names: string[]
}) {
  const [writing, setWriting] = useState(false)
  const [name, setName] = useState('')
  const feld = useRef<HTMLInputElement>(null)

  const vorschlaege = useMemo(() => suggestNames(names, name), [names, name])

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

  /** Einen Vorschlag übernehmen und gleich weiterschreiben können. */
  function take(vorschlag: string) {
    onAdd(vorschlag)
    setName('')
    feld.current?.focus()
  }

  return (
    <div>
    <div className="flex items-stretch overflow-hidden rounded-2xl bg-surface ring-1 ring-clay-200">
      <span className="flex items-center pl-3">
        <span className="size-6 shrink-0 rounded-md border-2 border-clay-300" />
      </span>

      <input
        autoFocus
        ref={feld}
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

      {/*
        Vorschläge aus dem Zutatenkatalog. Sie finden auch über eine
        Buchstabenfolge („AVC" → „Avocado"), was ein `<datalist>` wie im
        Rezeptformular nicht kann — deshalb steht hier eine eigene Liste.
      */}
      {vorschlaege.length > 0 && (
        <ul
          aria-label="Vorschläge"
          className="mt-1.5 flex flex-wrap gap-1.5 px-1"
        >
          {vorschlaege.map((vorschlag) => (
            <li key={vorschlag}>
              <button
                type="button"
                // Wie beim Verwerfen-Knopf: Ohne das liefe erst `onBlur` und
                // legte den halb getippten Text als eigenen Posten an.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => take(vorschlag)}
                className="min-h-9 rounded-full bg-clay-100 px-3 text-sm text-ink-700 transition-colors active:bg-clay-200"
              >
                {vorschlag}
              </button>
            </li>
          ))}
        </ul>
      )}
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
  highlight,
  onToggle,
  onEdit,
}: {
  items: ShoppingItem[]
  /** Der Posten, der gerade kurz hervorgehoben wird, oder `null`. */
  highlight: string | null
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
              highlight={item.key === highlight}
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
  highlight,
  onToggle,
  onEdit,
}: {
  item: ShoppingItem
  highlight: boolean
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
      ref={(element) => {
        setNodeRef(element)
        // Der wiedergefundene Posten rückt ins Bild — er kann weit unten
        // stehen, und ohne das sähe man nur die Meldung.
        if (highlight) {
          element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        'bg-surface',
        // Die gezogene Zeile über die anderen legen, sonst verschwindet sie
        // beim Vorbeiziehen unter der Nachbarzeile.
        isDragging && 'relative z-10 shadow-lg ring-1 ring-accent',
        highlight && 'relative z-10 ring-1 ring-accent',
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
            // Hier wird gezogen, nicht gewischt: Ohne diese Marke wechselte
            // beim Umsortieren der Reiter.
            {...{ [NO_SWIPE]: true }}
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
          {item.manual ? 'Posten löschen' : 'Brauche ich diese Woche nicht'}
        </Button>
        {!item.manual && (
          // Der Knopf soll sagen, was er tut. Vorher hieß er „Brauche ich
          // nicht" und sperrte die Zutat dauerhaft — in jedem Rezept, ohne
          // Hinweis und ohne Weg zurück.
          <p className="px-1 text-xs leading-relaxed text-ink-400">
            Der Posten rutscht unten in einen eigenen Block und steht nach einer
            Woche von selbst wieder auf der Liste.
          </p>
        )}
      </div>
    </Sheet>
  )
}
