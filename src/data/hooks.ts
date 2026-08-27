import { useEffect, useMemo, useState } from 'react'
import type {
  ISODate,
  Ingredient,
  PlanSlot,
  Recipe,
  ShoppingState,
} from '../domain/types.ts'
import { emptyShoppingState } from '../domain/types.ts'
import { useRepository } from './RepositoryContext.tsx'

/**
 * Die Hooks abonnieren jeweils einen Datenbestand und werfen bei jeder Änderung
 * einen neuen Wert aus — egal ob sie vom eigenen Gerät kommt oder von der
 * anderen Person. `loading` ist true, bis der erste Stand eingetroffen ist.
 */
export interface Loaded<T> {
  data: T
  loading: boolean
}

export function useIngredients(): Loaded<Ingredient[]> {
  const repository = useRepository()
  const [state, setState] = useState<Loaded<Ingredient[]>>({
    data: [],
    loading: true,
  })

  useEffect(() => {
    setState((current) => ({ ...current, loading: true }))
    return repository.subscribeIngredients((data) =>
      setState({ data, loading: false }),
    )
  }, [repository])

  return state
}

/** Der Zutatenkatalog als Nachschlagewerk nach Kennung. */
export function useIngredientMap(): Map<string, Ingredient> {
  const { data } = useIngredients()
  return useMemo(
    () => new Map(data.map((ingredient) => [ingredient.id, ingredient])),
    [data],
  )
}

export function useRecipes(): Loaded<Recipe[]> {
  const repository = useRepository()
  const [state, setState] = useState<Loaded<Recipe[]>>({
    data: [],
    loading: true,
  })

  useEffect(() => {
    setState((current) => ({ ...current, loading: true }))
    return repository.subscribeRecipes((data) =>
      setState({ data, loading: false }),
    )
  }, [repository])

  return state
}

export function useRecipeMap(): Map<string, Recipe> {
  const { data } = useRecipes()
  return useMemo(() => new Map(data.map((recipe) => [recipe.id, recipe])), [data])
}

/** Die Mahlzeiten-Plätze eines Datumsbereichs, beide Enden eingeschlossen. */
export function useSlots(from: ISODate, to: ISODate): Loaded<PlanSlot[]> {
  const repository = useRepository()
  const [state, setState] = useState<Loaded<PlanSlot[]>>({
    data: [],
    loading: true,
  })

  useEffect(() => {
    // Beim Nachladen im Kalender nicht auf „lädt" zurückfallen — sonst
    // flackert das halbe Raster weg, obwohl das meiste schon dasteht.
    return repository.subscribeSlots(from, to, (data) =>
      setState({ data, loading: false }),
    )
  }, [repository, from, to])

  return state
}

export function useShoppingState(): Loaded<ShoppingState> {
  const repository = useRepository()
  const [state, setState] = useState<Loaded<ShoppingState>>({
    data: emptyShoppingState(),
    loading: true,
  })

  useEffect(() => {
    return repository.subscribeShoppingState((data) =>
      setState({ data, loading: false }),
    )
  }, [repository])

  return state
}

/** Wer im Haushalt mitisst — die Namen für die Marke am Planeintrag. */
export function usePeople(): Loaded<string[]> {
  const repository = useRepository()
  const [state, setState] = useState<Loaded<string[]>>({
    data: [],
    loading: true,
  })

  useEffect(() => {
    return repository.subscribePeople((data) => setState({ data, loading: false }))
  }, [repository])

  return state
}

/** Merkt sich, ob das Gerät gerade Netz hat — für den Offline-Hinweis. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return online
}
