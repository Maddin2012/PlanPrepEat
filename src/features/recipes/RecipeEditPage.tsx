import { useEffect, useId, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useIngredientMap, useRecipeMap } from '../../data/hooks.ts'
import { useRepository } from '../../data/RepositoryContext.tsx'
import type { UnitCode } from '../../domain/types.ts'
import { UNIT_LABELS, UNIT_ORDER } from '../../domain/units.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import {
  Button,
  Field,
  IconButton,
  Select,
  Sheet,
  Spinner,
  TextInput,
} from '../../components/ui.tsx'
import {
  CameraIcon,
  CloseIcon,
  ImageIcon,
  PlusIcon,
  TrashIcon,
} from '../../components/Icons.tsx'
import { ImageTooLargeError, preparePhoto } from '../../lib/image.ts'
import { StepsEditor, stepsFromText, stepsToText } from './StepsEditor.tsx'
import {
  emptyItemDraft,
  itemDraftFrom,
  resolveItems,
  type ItemDraft,
} from './ingredientDraft.ts'

type PhotoState =
  /** unverändert lassen */
  | { kind: 'keep' }
  /** entfernen */
  | { kind: 'clear' }
  /** neu setzen */
  | { kind: 'set'; full: string; thumb: string }

export default function RecipeEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const repository = useRepository()
  const recipes = useRecipeMap()
  const catalog = useIngredientMap()
  const existing = id ? recipes.get(id) : undefined

  const [name, setName] = useState('')
  const [servings, setServings] = useState('2')
  const [minutes, setMinutes] = useState('')
  const [steps, setSteps] = useState<string[]>([''])
  const [items, setItems] = useState<ItemDraft[]>([emptyItemDraft()])
  const [photo, setPhoto] = useState<PhotoState>({ kind: 'keep' })
  const [preview, setPreview] = useState<string | null>(null)

  const [ready, setReady] = useState(!id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Das vorhandene Rezept einmalig ins Formular übernehmen. Danach nicht mehr,
  // sonst würde eine Änderung der anderen Person die eigene Eingabe überschreiben.
  useEffect(() => {
    if (!id || ready || !existing) return
    setName(existing.name)
    setServings(String(existing.servings))
    setMinutes(existing.minutes > 0 ? String(existing.minutes) : '')
    setSteps(stepsFromText(existing.steps))
    setItems(
      existing.items.length > 0
        ? existing.items.map(itemDraftFrom)
        : [emptyItemDraft()],
    )
    setPreview(existing.thumb ?? null)
    setReady(true)
  }, [id, ready, existing])

  // Beim Bearbeiten das Vollbild nachladen, damit die Vorschau scharf ist.
  useEffect(() => {
    if (!id || !existing?.hasPhoto) return
    let active = true
    repository.loadPhoto(id).then((data) => {
      if (active && data) setPreview(data)
    })
    return () => {
      active = false
    }
  }, [id, existing?.hasPhoto, repository])

  if (id && !ready) return <Spinner label="Rezept wird geladen …" />

  async function pickPhoto(file: File) {
    setError(null)
    try {
      const prepared = await preparePhoto(file)
      setPhoto({ kind: 'set', full: prepared.full, thumb: prepared.thumb })
      setPreview(prepared.full)
    } catch (cause) {
      setError(
        cause instanceof ImageTooLargeError
          ? 'Dieses Bild ist zu groß. Nimm ein kleineres oder mach ein neues Foto.'
          : 'Das Bild konnte nicht gelesen werden.',
      )
    }
  }

  function removePhoto() {
    setPhoto({ kind: 'clear' })
    setPreview(null)
  }

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Das Rezept braucht einen Namen.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const resolved = await resolveItems(items, catalog, repository)
      const draft = {
        name: trimmed,
        servings: Math.max(1, Number.parseInt(servings, 10) || 1),
        minutes: Math.max(0, Number.parseInt(minutes, 10) || 0),
        steps: stepsToText(steps),
        items: resolved,
        thumb:
          photo.kind === 'set'
            ? photo.thumb
            : photo.kind === 'clear'
              ? undefined
              : existing?.thumb,
      }
      const update =
        photo.kind === 'set' ? photo.full : photo.kind === 'clear' ? null : undefined

      if (id) {
        await repository.updateRecipe(id, draft, update)
        navigate(`/rezepte/${id}`, { replace: true })
      } else {
        const created = await repository.createRecipe(draft, update)
        navigate(`/rezepte/${created}`, { replace: true })
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Speichern hat nicht geklappt.',
      )
      setSaving(false)
    }
  }

  async function remove() {
    if (!id) return
    await repository.deleteRecipe(id)
    navigate('/rezepte', { replace: true })
  }

  return (
    <>
      <PageHeader
        title={id ? 'Rezept bearbeiten' : 'Neues Rezept'}
        back
        actions={
          id && (
            <IconButton
              label="Rezept löschen"
              className="text-red-600"
              onClick={() => setConfirmDelete(true)}
            >
              <TrashIcon className="size-5" />
            </IconButton>
          )
        }
      />

      <form
        className="space-y-5 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <PhotoPicker preview={preview} onPick={pickPhoto} onRemove={removePhoto} />

        <Field label="Name">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nudelauflauf"
            autoFocus={!id}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Portionen" hint="Für so viele gelten die Mengen unten.">
            <TextInput
              type="number"
              inputMode="numeric"
              min={1}
              value={servings}
              onChange={(event) => setServings(event.target.value)}
            />
          </Field>
          <Field label="Dauer" hint="In Minuten, optional.">
            <TextInput
              type="number"
              inputMode="numeric"
              min={0}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              placeholder="30"
            />
          </Field>
        </div>

        <IngredientEditor
          items={items}
          onChange={setItems}
          knownNames={[...catalog.values()].map((entry) => entry.name)}
        />

        <StepsEditor steps={steps} onChange={setSteps} />

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
      </form>

      {/* Speichern bleibt in Daumenreichweite, egal wie lang das Formular wird. */}
      <div className="safe-bottom sticky bottom-0 border-t border-clay-200 bg-surface/95 p-4 backdrop-blur">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button className="flex-[2]" onClick={() => void save()} disabled={saving}>
            {saving ? 'Speichert …' : 'Speichern'}
          </Button>
        </div>
      </div>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Rezept löschen?"
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmDelete(false)}
            >
              Behalten
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => void remove()}>
              Löschen
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink-600">
          „{name}" wird für euch beide entfernt. Aus bereits geplanten Tagen
          verschwindet das Rezept ebenfalls.
        </p>
      </Sheet>
    </>
  )
}

function PhotoPicker({
  preview,
  onPick,
  onRemove,
}: {
  preview: string | null
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const cameraId = useId()
  const galleryId = useId()

  function receive(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onPick(file)
    // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
    event.target.value = ''
  }

  return (
    <div>
      {/*
        Zwei Felder statt einem: `capture` schickt den Tipp direkt in die
        Kamera-App, nimmt dabei aber die Galerie-Auswahl weg. Ein Feld kann also
        entweder das eine oder das andere — für beides braucht es beide.
        Am Rechner wird `capture` ignoriert, dort öffnen beide denselben Dialog.
      */}
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={receive}
      />
      <input
        id={galleryId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={receive}
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-clay-200">
          <img src={preview} alt="" className="h-44 w-full object-cover" />
          <div className="absolute top-2 right-2 flex gap-2">
            <label
              htmlFor={cameraId}
              className={ROUND_BUTTON}
              aria-label="Neues Foto aufnehmen"
            >
              <CameraIcon className="size-4.5" />
            </label>
            <label
              htmlFor={galleryId}
              className={ROUND_BUTTON}
              aria-label="Anderes Bild aus der Galerie"
            >
              <ImageIcon className="size-4.5" />
            </label>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Bild entfernen"
              className={ROUND_BUTTON}
            >
              <CloseIcon className="size-4.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-28 overflow-hidden rounded-2xl border-2 border-dashed border-clay-200 bg-surface">
          <label htmlFor={cameraId} className={PICK_AREA}>
            <CameraIcon className="size-6" />
            <span className="text-sm font-medium">Foto aufnehmen</span>
          </label>
          <span className="my-3 w-px shrink-0 bg-clay-200" />
          <label htmlFor={galleryId} className={PICK_AREA}>
            <ImageIcon className="size-6" />
            <span className="text-sm font-medium">Aus der Galerie</span>
          </label>
        </div>
      )}
    </div>
  )
}

const ROUND_BUTTON =
  'flex size-9 items-center justify-center rounded-full bg-ink-900/60 text-white backdrop-blur'

const PICK_AREA =
  'flex flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 text-ink-400 transition-colors active:bg-clay-50'

function IngredientEditor({
  items,
  onChange,
  knownNames,
}: {
  items: ItemDraft[]
  onChange: (items: ItemDraft[]) => void
  knownNames: string[]
}) {
  const listId = useId()

  function patch(key: string, changes: Partial<ItemDraft>) {
    onChange(
      items.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    )
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink-600">Zutaten</h2>
        <span className="text-xs text-ink-400">
          Menge leer lassen = „nach Gefühl"
        </span>
      </div>

      <datalist id={listId}>
        {knownNames.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>

      {/*
        Zwei Zeilen statt einer: Name, Menge, Einheit und Löschknopf passen auf
        einem 390 Pixel breiten Handy nicht nebeneinander, ohne dass der
        Zutatenname unlesbar schmal wird. Die Breiten steuert durchgehend das
        Raster — die Felder selbst füllen nur ihre Zelle aus.
      */}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.key}
            className="space-y-2 rounded-xl bg-surface p-2 ring-1 ring-clay-200"
          >
            <TextInput
              value={item.name}
              list={listId}
              aria-label="Zutat"
              onChange={(event) => patch(item.key, { name: event.target.value })}
              placeholder="Zwiebeln"
              className="ring-0"
            />

            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <TextInput
                value={item.amount}
                inputMode="decimal"
                onChange={(event) =>
                  patch(item.key, { amount: event.target.value })
                }
                placeholder="200"
                aria-label="Menge"
                className="text-center ring-0"
              />
              <Select
                value={item.unit}
                aria-label="Einheit"
                onChange={(event) =>
                  patch(item.key, { unit: event.target.value as UnitCode })
                }
                className="ring-0"
              >
                {UNIT_ORDER.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABELS[unit]}
                  </option>
                ))}
              </Select>
              <IconButton
                label="Zutat entfernen"
                className="size-10 text-ink-400"
                onClick={() =>
                  onChange(
                    items.length === 1
                      ? [emptyItemDraft()]
                      : items.filter((entry) => entry.key !== item.key),
                  )
                }
              >
                <CloseIcon className="size-4.5" />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        block
        className="mt-2"
        onClick={() =>
          onChange([...items, emptyItemDraft(items.at(-1)?.unit ?? 'g')])
        }
      >
        <PlusIcon className="size-5" />
        Zutat hinzufügen
      </Button>
    </section>
  )
}
