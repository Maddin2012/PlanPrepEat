import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRecipeMap, useRecipes } from '../../data/hooks.ts'
import { useRepository } from '../../data/RepositoryContext.tsx'
import { scaleItems } from '../../domain/scaling.ts'
import { formatAmount } from '../../domain/units.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Button, EmptyState, Spinner } from '../../components/ui.tsx'
import { ClockIcon, UsersIcon } from '../../components/Icons.tsx'

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const repository = useRepository()
  const { loading } = useRecipes()
  const recipe = useRecipeMap().get(id ?? '')

  const [servings, setServings] = useState<number | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)

  // Der Portionsregler startet bei der Angabe des Rezepts, bleibt danach aber
  // beim selbst gewählten Wert stehen.
  useEffect(() => {
    if (recipe && servings === null) setServings(recipe.servings)
  }, [recipe, servings])

  useEffect(() => {
    if (!id || !recipe?.hasPhoto) return
    let active = true
    repository.loadPhoto(id).then((data) => {
      if (active) setPhoto(data)
    })
    return () => {
      active = false
    }
  }, [id, recipe?.hasPhoto, repository])

  const shown = servings ?? recipe?.servings ?? 1
  const items = useMemo(
    () => (recipe ? scaleItems(recipe, shown) : []),
    [recipe, shown],
  )

  if (loading && !recipe) return <Spinner label="Rezept wird geladen …" />

  if (!recipe) {
    return (
      <>
        <PageHeader title="Rezept" back="/rezepte" />
        <EmptyState
          title="Rezept nicht gefunden"
          description="Vielleicht wurde es gerade gelöscht."
          action={
            <Link to="/rezepte">
              <Button variant="secondary">Zum Rezeptbuch</Button>
            </Link>
          }
        />
      </>
    )
  }

  const steps = recipe.steps.split('\n').filter((line) => line.trim())
  const scaled = shown !== recipe.servings

  return (
    <>
      <PageHeader
        title={recipe.name}
        back="/rezepte"
        actions={
          <Link
            to={`/rezepte/${recipe.id}/bearbeiten`}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-accent-text transition-colors active:bg-clay-100"
          >
            Bearbeiten
          </Link>
        }
      />

      {(photo ?? recipe.thumb) && (
        <img
          src={photo ?? recipe.thumb}
          alt=""
          className="h-52 w-full object-cover"
        />
      )}

      <div className="space-y-6 p-4">
        {recipe.minutes > 0 && (
          <p className="inline-flex items-center gap-1.5 text-sm text-ink-500">
            <ClockIcon className="size-4" />
            {recipe.minutes} Minuten
          </p>
        )}

        <section className="rounded-2xl bg-surface p-4 ring-1 ring-clay-200">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-ink-700">
              <UsersIcon className="size-4.5 text-ink-400" />
              Portionen
            </div>
            <Stepper
              value={shown}
              onChange={setServings}
              min={1}
              max={24}
              label="Portionen"
            />
          </div>
          {scaled && (
            <p className="mt-2 text-xs text-ink-400">
              Mengen umgerechnet — im Rezept stehen {recipe.servings}.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-600">Zutaten</h2>
          {items.length === 0 ? (
            <p className="text-sm text-ink-400">Keine Zutaten hinterlegt.</p>
          ) : (
            <ul className="divide-y divide-clay-200/70 overflow-hidden rounded-2xl bg-surface ring-1 ring-clay-200">
              {items.map((item, index) => (
                <li
                  key={`${item.ingredientId}-${index}`}
                  className="flex items-baseline gap-3 px-4 py-2.5"
                >
                  <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums text-ink-700">
                    {item.amount > 0 ? formatAmount(item.amount, item.unit) : ''}
                  </span>
                  <span className="min-w-0 flex-1 text-ink-900">
                    {item.name}
                    {item.note && (
                      <span className="text-ink-400"> · {item.note}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {steps.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-ink-600">Zubereitung</h2>

            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li
                  key={index}
                  className="flex gap-3 rounded-2xl bg-surface p-4 ring-1 ring-clay-200"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 leading-relaxed text-ink-900">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </>
  )
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  label: string
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-clay-100 p-1">
      <button
        type="button"
        aria-label={`${label} verringern`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex size-9 items-center justify-center rounded-full bg-surface text-lg leading-none font-medium text-ink-700 ring-1 ring-clay-200 disabled:text-ink-400 disabled:opacity-50"
      >
        −
      </button>
      <span
        aria-live="polite"
        className="w-8 text-center text-base font-semibold tabular-nums text-ink-900"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`${label} erhöhen`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex size-9 items-center justify-center rounded-full bg-surface text-lg leading-none font-medium text-ink-700 ring-1 ring-clay-200 disabled:text-ink-400 disabled:opacity-50"
      >
        +
      </button>
    </div>
  )
}
