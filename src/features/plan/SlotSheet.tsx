import { useMemo, useState } from 'react'
import type { Meal, PlanEntry, Recipe } from '../../domain/types.ts'
import { MEAL_LABELS, formatDayShort, fromISODate, WEEKDAY_LONG } from '../../domain/planWindow.ts'
import { Button, EmptyState, IconButton, Sheet, TextInput } from '../../components/ui.tsx'
import { BookIcon, CloseIcon, PlusIcon, SearchIcon } from '../../components/Icons.tsx'
import { Stepper } from '../recipes/RecipeDetailPage.tsx'

/**
 * Was auf einem Mahlzeiten-Platz liegt, bearbeiten: Rezepte hinzufügen,
 * Portionen anpassen, wieder entfernen. Ein Platz darf mehrere Rezepte fassen —
 * Hauptgericht und Beilage sind schließlich zwei.
 */
export default function SlotSheet({
  open,
  onClose,
  date,
  meal,
  entries,
  recipes,
  onSave,
}: {
  open: boolean
  onClose: () => void
  date: string
  meal: Meal
  entries: PlanEntry[]
  recipes: Recipe[]
  onSave: (entries: PlanEntry[]) => void
}) {
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')

  const byId = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  )

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de')
    if (!needle) return recipes
    return recipes.filter((recipe) =>
      recipe.name.toLocaleLowerCase('de').includes(needle),
    )
  }, [recipes, query])

  const weekday = WEEKDAY_LONG[fromISODate(date).getDay()]
  const title = `${weekday}, ${formatDayShort(date)} · ${MEAL_LABELS[meal]}`

  function close() {
    setPicking(false)
    setQuery('')
    onClose()
  }

  function add(recipe: Recipe) {
    onSave([...entries, { recipeId: recipe.id, servings: recipe.servings }])
    setPicking(false)
    setQuery('')
  }

  function setServings(index: number, servings: number) {
    onSave(
      entries.map((entry, position) =>
        position === index ? { ...entry, servings } : entry,
      ),
    )
  }

  function remove(index: number) {
    onSave(entries.filter((_, position) => position !== index))
  }

  if (picking) {
    return (
      <Sheet open={open} onClose={close} title="Rezept auswählen">
        <div className="relative mb-3">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-400" />
          {/* Kein Autofokus: Sonst klappt sofort die Tastatur auf und deckt die
              Rezeptliste bis auf eine Zeile zu. Zuerst soll man sehen, was da
              ist — gesucht wird erst, wenn das Rezeptbuch dafür groß genug ist. */}
          <TextInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rezept suchen"
            className="pl-10"
          />
        </div>

        {matches.length === 0 ? (
          <EmptyState
            icon={<BookIcon className="size-10" />}
            title={recipes.length === 0 ? 'Noch keine Rezepte' : 'Nichts gefunden'}
            description={
              recipes.length === 0
                ? 'Leg zuerst im Rezeptbuch ein Rezept an.'
                : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-clay-200/70 overflow-hidden rounded-xl bg-surface ring-1 ring-clay-200">
            {matches.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => add(recipe)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors active:bg-clay-100"
                >
                  {recipe.thumb ? (
                    <img
                      src={recipe.thumb}
                      alt=""
                      className="size-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-leaf-50 text-leaf-300">
                      <BookIcon className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink-900">
                      {recipe.name}
                    </span>
                    <span className="block text-xs text-ink-400">
                      {recipe.servings} Portionen
                      {recipe.minutes > 0 && ` · ${recipe.minutes} Min.`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button variant="ghost" block className="mt-3" onClick={() => setPicking(false)}>
          Zurück
        </Button>
      </Sheet>
    )
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      footer={
        <Button block onClick={close}>
          Fertig
        </Button>
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          title="Noch nichts geplant"
          description="Such dir ein Rezept aus dem Rezeptbuch aus."
        />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, index) => {
            const recipe = byId.get(entry.recipeId)
            return (
              <li
                key={`${entry.recipeId}-${index}`}
                className="rounded-xl bg-surface p-3 ring-1 ring-clay-200"
              >
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 font-medium text-ink-900">
                    {recipe?.name ?? 'Gelöschtes Rezept'}
                  </p>
                  <IconButton
                    label="Vom Plan nehmen"
                    className="size-8 text-ink-400"
                    onClick={() => remove(index)}
                  >
                    <CloseIcon className="size-4.5" />
                  </IconButton>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-ink-500">Portionen</span>
                  <Stepper
                    label="Portionen"
                    value={entry.servings}
                    min={1}
                    max={24}
                    onChange={(value) => setServings(index, value)}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Button variant="secondary" block className="mt-3" onClick={() => setPicking(true)}>
        <PlusIcon className="size-5" />
        Rezept hinzufügen
      </Button>
    </Sheet>
  )
}
