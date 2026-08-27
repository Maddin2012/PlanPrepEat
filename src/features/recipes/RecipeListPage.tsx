import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecipes } from '../../data/hooks.ts'
import type { Recipe } from '../../domain/types.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import {
  BookIcon,
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
        <ul className="grid grid-cols-2 gap-3 px-4">
          {visible.map((recipe) => (
            // Der Knopf sitzt **neben** dem Verweis, nicht darin — verschachtelte
            // Bedienelemente sind ungültig. Über die Kachel gelegt wird er erst
            // hier, mit `absolute`.
            <li key={recipe.id} className="relative">
              <RecipeTile recipe={recipe} />
              <IconButton
                label={`Einplanen: ${recipe.name}`}
                // Auf einem Foto ist jede Farbe möglich. Die dunkle Scheibe
                // darunter ist der einzige Weg, das Plus überall lesbar zu
                // halten — deshalb `overlay`, das in beiden Fassungen dunkel ist.
                className="absolute top-1 right-1 bg-overlay/70 text-on-overlay active:bg-overlay"
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

/**
 * Eine Kachel: Bild oben, Name darunter.
 *
 * Zwei Spalten statt einer Zeilenliste — ein Rezeptbuch schlägt man nach Bildern
 * auf, nicht nach Namen. `h-full` sorgt dafür, dass die beiden Kacheln einer
 * Reihe gleich hoch aussehen, auch wenn der eine Name zwei Zeilen braucht und
 * der andere eine.
 */
function RecipeTile({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      to={`/rezepte/${recipe.id}`}
      className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-clay-200 transition-colors active:bg-clay-100"
    >
      <Thumb recipe={recipe} />

      <div className="p-2.5">
        <p className="line-clamp-2 text-sm leading-snug font-medium text-ink-900">
          {recipe.name}
        </p>
        <p className="mt-1 truncate text-xs text-ink-500">
          {recipe.items.length}{' '}
          {recipe.items.length === 1 ? 'Zutat' : 'Zutaten'}
          {recipe.minutes > 0 && ` · ${recipe.minutes} Min.`}
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
        className="aspect-[4/3] w-full object-cover"
      />
    )
  }
  return (
    // Dieselbe Fläche wie das Foto: Ohne sie stünden Kacheln mit und ohne Bild
    // unterschiedlich hoch nebeneinander.
    <div className="flex aspect-[4/3] w-full items-center justify-center bg-accent-soft text-clay-300">
      <BookIcon className="size-8" />
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
