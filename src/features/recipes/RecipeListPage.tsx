import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecipes } from '../../data/hooks.ts'
import type { Recipe } from '../../domain/types.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import {
  BookIcon,
  ClockIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from '../../components/Icons.tsx'
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  Spinner,
  TextInput,
} from '../../components/ui.tsx'

export default function RecipeListPage() {
  const { data: recipes, loading } = useRecipes()
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  const tags = useMemo(() => collectTags(recipes), [recipes])
  const visible = useMemo(
    () => filterRecipes(recipes, query, tag),
    [recipes, query, tag],
  )

  return (
    <>
      <PageHeader
        title="Rezeptbuch"
        subtitle={
          recipes.length > 0
            ? `${recipes.length} ${recipes.length === 1 ? 'Rezept' : 'Rezepte'}`
            : undefined
        }
        actions={
          <>
            <Link to="/einstellungen">
              <IconButton label="Einstellungen">
                <SettingsIcon className="size-5" />
              </IconButton>
            </Link>
            <Link to="/rezepte/neu">
              <IconButton
                label="Rezept hinzufügen"
                className="bg-leaf-600 text-white active:bg-leaf-700"
              >
                <PlusIcon className="size-5" />
              </IconButton>
            </Link>
          </>
        }
        below={
          recipes.length > 4 ? (
            <div className="space-y-2.5">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-400" />
                <TextInput
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rezept oder Zutat suchen"
                  className="pl-10"
                />
              </div>

              {tags.length > 0 && (
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
                  <Chip active={tag === null} onClick={() => setTag(null)}>
                    Alle
                  </Chip>
                  {tags.map((entry) => (
                    <Chip
                      key={entry}
                      active={tag === entry}
                      onClick={() => setTag(tag === entry ? null : entry)}
                    >
                      {entry}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <Spinner label="Rezepte werden geladen …" />
      ) : recipes.length === 0 ? (
        <EmptyState
          icon={<BookIcon className="size-12" />}
          title="Noch keine Rezepte"
          description="Leg dein erstes Rezept an — danach kannst du es im Essensplan einplanen und die Einkaufsliste entsteht von selbst."
          action={
            <Link to="/rezepte/neu">
              <Button>
                <PlusIcon className="size-5" />
                Erstes Rezept anlegen
              </Button>
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nichts gefunden"
          description="Zu dieser Suche gibt es kein Rezept."
        />
      ) : (
        <ul className="divide-y divide-clay-200/70 px-4">
          {visible.map((recipe) => (
            <li key={recipe.id}>
              <RecipeRow recipe={recipe} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function RecipeRow({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      to={`/rezepte/${recipe.id}`}
      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors active:bg-clay-100"
    >
      <Thumb recipe={recipe} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink-900">{recipe.name}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
          <span>
            {recipe.items.length}{' '}
            {recipe.items.length === 1 ? 'Zutat' : 'Zutaten'}
          </span>
          {recipe.minutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {recipe.minutes} Min.
            </span>
          )}
        </p>
        {recipe.tags.length > 0 && (
          <p className="mt-1 truncate text-xs text-leaf-600">
            {recipe.tags.join(' · ')}
          </p>
        )}
      </div>
    </Link>
  )
}

function Thumb({ recipe }: { recipe: Recipe }) {
  if (recipe.thumb) {
    return (
      <img
        src={recipe.thumb}
        alt=""
        loading="lazy"
        className="size-14 shrink-0 rounded-xl object-cover ring-1 ring-clay-200"
      />
    )
  }
  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf-300 ring-1 ring-clay-200">
      <BookIcon className="size-6" />
    </div>
  )
}

function collectTags(recipes: Recipe[]): string[] {
  const seen = new Set<string>()
  for (const recipe of recipes) for (const tag of recipe.tags) seen.add(tag)
  return [...seen].sort((a, b) => a.localeCompare(b, 'de'))
}

/** Sucht in Rezeptnamen, Zutaten und Schlagwörtern. */
function filterRecipes(
  recipes: Recipe[],
  query: string,
  tag: string | null,
): Recipe[] {
  const needle = query.trim().toLocaleLowerCase('de')
  return recipes.filter((recipe) => {
    if (tag && !recipe.tags.includes(tag)) return false
    if (!needle) return true
    return (
      recipe.name.toLocaleLowerCase('de').includes(needle) ||
      recipe.tags.some((entry) => entry.toLocaleLowerCase('de').includes(needle)) ||
      recipe.items.some((item) =>
        item.name.toLocaleLowerCase('de').includes(needle),
      )
    )
  })
}
