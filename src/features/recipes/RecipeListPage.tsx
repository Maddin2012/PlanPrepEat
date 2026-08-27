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
  EmptyState,
  IconButton,
  Spinner,
  TextInput,
} from '../../components/ui.tsx'
import AddToPlanSheet from './AddToPlanSheet.tsx'

export default function RecipeListPage() {
  const { data: recipes, loading } = useRecipes()
  const [query, setQuery] = useState('')

  // **Ein** Blatt für die ganze Seite, nicht eines je Zeile: Das Blatt fragt die
  // belegten Plätze der nächsten zwei Wochen ab, und dieselbe Abfrage dreißigmal
  // nebeneinander wäre reine Verschwendung.
  const [planning, setPlanning] = useState<Recipe | null>(null)

  const visible = useMemo(
    () => filterRecipes(recipes, query),
    [recipes, query],
  )

  return (
    <>
      <PageHeader
        brand
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
                className="bg-accent text-on-accent active:bg-accent-strong"
              >
                <PlusIcon className="size-5" />
              </IconButton>
            </Link>
          </>
        }
        below={
          recipes.length > 4 ? (
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
            <li key={recipe.id} className="flex items-center gap-1">
              <RecipeRow recipe={recipe} />
              <IconButton
                label={`Einplanen: ${recipe.name}`}
                className="text-accent-text"
                onClick={() => setPlanning(recipe)}
              >
                <PlusIcon className="size-5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {/* Erst beim Antippen eingehängt — vorher gibt es kein Rezept, für das es
          etwas abzufragen gäbe. */}
      {planning && (
        <AddToPlanSheet
          open
          recipe={planning}
          servings={planning.servings}
          onClose={() => setPlanning(null)}
        />
      )}
    </>
  )
}

function RecipeRow({ recipe }: { recipe: Recipe }) {
  return (
    // Der Verweis umfasst **nicht** mehr die ganze Zeile: Ein Knopf darf nicht
    // in einem Verweis stehen, und der Tipp aufs Plus spränge sonst zusätzlich
    // ins Rezept.
    <Link
      to={`/rezepte/${recipe.id}`}
      className="-ml-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl py-3 pl-2 transition-colors active:bg-clay-100"
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
        className="h-14 w-[4.67rem] shrink-0 rounded-xl object-cover ring-1 ring-clay-200"
      />
    )
  }
  return (
    // Dieselbe Fläche wie das Bildchen, sonst stünden die Rezeptnamen je nach
    // Foto unterschiedlich weit eingerückt.
    <div className="flex h-14 w-[4.67rem] shrink-0 items-center justify-center rounded-xl bg-accent-soft text-clay-300 ring-1 ring-clay-200">
      <BookIcon className="size-6" />
    </div>
  )
}

/** Sucht in Rezeptnamen und in den Zutaten. */
function filterRecipes(recipes: Recipe[], query: string): Recipe[] {
  const needle = query.trim().toLocaleLowerCase('de')
  if (!needle) return recipes
  return recipes.filter(
    (recipe) =>
      recipe.name.toLocaleLowerCase('de').includes(needle) ||
      recipe.items.some((item) =>
        item.name.toLocaleLowerCase('de').includes(needle),
      ),
  )
}
