import { useSyncExternalStore } from 'react'
import type { ShoppingState } from '../domain/types.ts'
import { pushEntry, type UndoEntry } from '../domain/undoHistory.ts'

/**
 * Wo der Rückgängig-Stapel liegt: **neben** React, modulweit.
 *
 * Nicht in einem `useState` der Einkaufsliste — die Seite wird beim Wechsel auf
 * einen anderen Reiter abgebaut, und der Stapel wäre danach leer. Genau der
 * Fall soll aber funktionieren: „Ich hab mich verdrückt, war kurz im Rezept und
 * merke es erst jetzt."
 *
 * Gelesen wird über `useSyncExternalStore` — der dafür vorgesehene Weg, statt
 * ein eigenes Ereignissystem zu bauen.
 *
 * Der Stapel lebt so lange wie die geladene App und ist beim Schließen weg.
 * Das ist gewollt: Ein Stand von vorgestern über die heutige Liste zu legen
 * würde Schaden anrichten, nicht beheben.
 */

let stack: UndoEntry[] = []
const listeners = new Set<() => void>()

/** Was beim letzten eigenen Speichern hinausgegangen ist, in Vergleichsform. */
let ownEcho: string | null = null

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Den Stand vor einer Handlung wegsichern. */
export function pushUndo(label: string, state: ShoppingState): void {
  stack = pushEntry(stack, { label, state })
  emit()
}

/** Den obersten Stand herausnehmen — oder `null`, wenn nichts da ist. */
export function popUndo(): UndoEntry | null {
  const top = stack[0]
  if (!top) return null
  stack = stack.slice(1)
  emit()
  return top
}

/**
 * Den Stapel wegwerfen.
 *
 * Gerufen, wenn der Zustand sich von außen geändert hat — dann gehört er
 * jemand anders, und ein Rückgängig würde dessen Arbeit mitlöschen.
 */
export function clearUndo(): void {
  if (stack.length === 0) return
  stack = []
  emit()
}

/** Merken, was wir selbst gespeichert haben — zum Erkennen des eigenen Echos. */
export function rememberEcho(canonicalState: string): void {
  ownEcho = canonicalState
}

/**
 * Kam diese Fassung von uns selbst?
 *
 * Beim ersten Stand nach dem Laden ist noch nichts gemerkt; der zählt als
 * eigener, denn dann ist der Stapel ohnehin leer und es gibt nichts zu
 * verlieren.
 */
export function isOwnEcho(canonicalState: string): boolean {
  return ownEcho === null || ownEcho === canonicalState
}

/** Der Stapel als Zustand — leer heißt: Es gibt nichts zurückzunehmen. */
export function useUndo(): readonly UndoEntry[] {
  return useSyncExternalStore(subscribe, () => stack)
}
