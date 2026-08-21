import { useCallback, useEffect, useState } from 'react'
import type { Plan } from '../../domain/types.ts'
import { usePlans } from '../../data/hooks.ts'
import { isWithinPlan, todayISO } from '../../domain/planWindow.ts'

const STORAGE_KEY = 'rezeptbuch:plan'

/**
 * Welchen Zeitraum die App gerade zeigt. Essensplan und Einkaufsliste greifen
 * beide darauf zu, damit die Liste immer zu dem Plan gehört, den man vor sich hat.
 *
 * Die Wahl wird gemerkt, aber nur so lange sie gültig ist: Ist der gemerkte
 * Zeitraum gelöscht worden, fällt die App auf den zurück, in dem heute liegt.
 */
export function useSelectedPlan(): {
  plans: Plan[]
  plan: Plan | null
  loading: boolean
  select: (planId: string) => void
} {
  const { data: plans, loading } = usePlans()
  const [planId, setPlanId] = useState<string | null>(() => readStored())

  const select = useCallback((next: string) => {
    setPlanId(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ohne localStorage merkt sich die App die Auswahl eben nur bis zum Neuladen.
    }
  }, [])

  const plan =
    plans.find((entry) => entry.id === planId) ?? defaultPlan(plans) ?? null

  // Ist die gemerkte Wahl weggefallen, den Ersatz gleich festschreiben.
  useEffect(() => {
    if (plan && plan.id !== planId) select(plan.id)
  }, [plan, planId, select])

  return { plans, plan, loading, select }
}

/** Der Zeitraum, in dem heute liegt — sonst der neueste. */
function defaultPlan(plans: Plan[]): Plan | undefined {
  const today = todayISO()
  return (
    plans.find((entry) => isWithinPlan(entry.startDate, today)) ?? plans[0]
  )
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
