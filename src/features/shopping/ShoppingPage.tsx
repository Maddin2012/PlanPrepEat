import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  pruneShoppingState,
} from '../../domain/aggregate.ts'
import { UNIT_LABELS, UNIT_ORDER, formatAmount } from '../../domain/units.ts'
import { formatShoppingListText } from '../../domain/exportList.ts'
import { formatPlanRange } from '../../domain/planWindow.ts'
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
  CalendarIcon,
  CartIcon,
  CheckIcon,
  CopyIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
} from '../../components/Icons.tsx'
import { canShare, copyText, shareText } from '../../lib/share.ts'
import { useSelectedPlan } from '../plan/selectedPlan.ts'
import { parseAmount } from '../recipes/ingredientDraft.ts'

export default function ShoppingPage() {
  const repository = useRepository()
  const { plan, loading: plansLoading } = useSelectedPlan()
  const { data: slots } = useSlots(plan?.id ?? null)
  const recipesById = useRecipeMap()
  const ingredients = useIngredientMap()
  const { data: state, loading: stateLoading } = useShoppingState(plan?.id ?? null)

  const [hideDone, setHideDone] = useState(false)
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [adding, setAdding] = useState(false)
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
      if (!plan) return
      const next = change(state)
      const live = liveShoppingKeys(planned)
      void repository.saveShoppingState(plan.id, pruneShoppingState(next, live))
    },
    [plan, state, planned, repository],
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

  const openCount = items.filter((item) => !item.checked).length
  const visible = hideDone ? items.filter((item) => !item.checked) : items

  function flash(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2600)
  }

  async function exportToKeep() {
    const text = formatShoppingListText(items, { startDate: plan?.startDate })
    const result = await shareText({ title: 'Einkaufsliste', text })
    if (result === 'copied') {
      flash('Kein Teilen möglich — Liste in die Zwischenablage kopiert.')
    } else if (result === 'failed') {
      flash('Das hat leider nicht geklappt.')
    }
  }

  async function copy() {
    const text = formatShoppingListText(items, { startDate: plan?.startDate })
    flash(
      (await copyText(text))
        ? 'Liste kopiert.'
        : 'Kopieren hat nicht geklappt.',
    )
  }

  if (plansLoading || (plan && stateLoading)) {
    return <Spinner label="Einkaufsliste wird geladen …" />
  }

  if (!plan) {
    return (
      <>
        <PageHeader title="Einkaufsliste" />
        <EmptyState
          icon={<CalendarIcon className="size-12" />}
          title="Noch kein Zeitraum"
          description="Die Einkaufsliste entsteht aus dem Essensplan. Leg dort einen Zeitraum an."
          action={
            <Link to="/plan">
              <Button>Zum Essensplan</Button>
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Einkaufsliste"
        subtitle={formatPlanRange(plan.startDate)}
        actions={
          <IconButton label="Eigenen Posten hinzufügen" onClick={() => setAdding(true)}>
            <PlusIcon className="size-5" />
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
                className="text-xs font-medium text-leaf-600"
              >
                {hideDone ? 'Erledigte einblenden' : 'Erledigte ausblenden'}
              </button>
            </div>
          ) : undefined
        }
      />

      {items.length === 0 ? (
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
      ) : (
        <div className="space-y-5 p-4">
          <ul className="divide-y divide-clay-200/70 overflow-hidden rounded-2xl bg-surface ring-1 ring-clay-200">
            {visible.map((item) => (
              <li key={item.key}>
                <ItemRow
                  item={item}
                  onToggle={() => toggle(item)}
                  onEdit={() => setEditing(item)}
                />
              </li>
            ))}
          </ul>

          <div className="space-y-2 pt-2">
            <Button block onClick={() => void exportToKeep()}>
              <ShareIcon className="size-5" />
              An Google Notizen senden
            </Button>
            <Button variant="secondary" block onClick={() => void copy()}>
              <CopyIcon className="size-5" />
              Als Text kopieren
            </Button>
            <p className="px-2 pt-1 text-center text-xs leading-relaxed text-ink-400">
              {canShare()
                ? 'Es öffnet sich der Teilen-Dialog — dort „Keep" antippen, und die Liste liegt als Notiz im Konto.'
                : 'Auf diesem Gerät gibt es keinen Teilen-Dialog. Die Liste wird stattdessen kopiert.'}
            </p>
          </div>
        </div>
      )}

      {editing && (
        <EditItemSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(amount) => {
            const key = editing.key
            update((current) => ({
              ...current,
              overrides: { ...current.overrides, [key]: amount },
            }))
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

      <AddItemSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(entry) => {
          update((current) => ({ ...current, manual: [...current.manual, entry] }))
          setAdding(false)
        }}
      />

      {toast && (
        <div className="pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl bg-ink-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}

function ItemRow({
  item,
  onToggle,
  onEdit,
}: {
  item: ShoppingItem
  onToggle: () => void
  onEdit: () => void
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
              ? 'border-leaf-600 bg-leaf-600 text-white'
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
            className="size-1.5 rounded-full bg-leaf-500"
          />
        )}
      </button>
    </div>
  )
}

function EditItemSheet({
  item,
  onClose,
  onSave,
  onReset,
  onRemove,
}: {
  item: ShoppingItem
  onClose: () => void
  onSave: (amount: number) => void
  onReset: () => void
  onRemove: () => void
}) {
  const [value, setValue] = useState(
    item.amount === null ? '' : String(item.amount).replace('.', ','),
  )

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
          <Button
            className="flex-[2]"
            onClick={() => onSave(parseAmount(value))}
          >
            Übernehmen
          </Button>
        </div>
      }
    >
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

function AddItemSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (item: ManualItem) => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<UnitCode>('stk')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    const parsed = parseAmount(amount)
    onAdd({
      id: newId(),
      name: trimmed,
      amount: parsed > 0 ? parsed : null,
      unit: parsed > 0 ? unit : null,
    })
    setName('')
    setAmount('')
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Eigener Posten"
      footer={
        <Button block disabled={!name.trim()} onClick={submit}>
          Hinzufügen
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Was fehlt?">
          <TextInput
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Klopapier"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Menge" hint="Optional.">
            <TextInput
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
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
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-400">
        Eigene Posten bleiben stehen, auch wenn ihr den Essensplan noch ändert.
      </p>
    </Sheet>
  )
}
