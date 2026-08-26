import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  pendingEntries,
  toChangelog,
  type ChangeEntry,
} from '../data/changelog.ts'

/**
 * Updates: melden, nachsehen, einspielen.
 *
 * Vorher tauschte sich die App stillschweigend aus — man musste sie schließen,
 * wieder öffnen und in den Einstellungen den Stand ablesen, um zu wissen, ob
 * etwas angekommen war. Jetzt sagt sie Bescheid und lässt sich auf Knopfdruck
 * aktualisieren.
 */

export type CheckState = 'idle' | 'checking' | 'aktuell' | 'fehlgeschlagen'

interface UpdateValue {
  /** Ein Update ist heruntergeladen und wartet darauf, übernommen zu werden. */
  ready: boolean
  state: CheckState
  /** Was im wartenden Update steckt — leer, solange nichts abgerufen wurde. */
  pending: ChangeEntry[]
  /** Von Hand nach einem Update sehen. */
  check: () => Promise<void>
  /** Übernehmen und die App neu laden. */
  install: () => void
}

const UpdateContext = createContext<UpdateValue | null>(null)

export function UpdateProvider({ children }: { children: ReactNode }) {
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const [state, setState] = useState<CheckState>('idle')
  const [pending, setPending] = useState<ChangeEntry[]>([])

  const {
    needRefresh: [ready],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      registration.current = reg ?? null
    },
    onNeedRefresh() {
      void loadPending().then(setPending)
    },
  })

  /**
   * Nachsehen, ob es etwas Neues gibt.
   *
   * `update()` fragt den Server nach einer neuen Fassung des Service Workers.
   * Gibt es eine, lädt sie im Hintergrund und meldet sich über `onNeedRefresh`
   * — deshalb wird hier nicht auf ein Ergebnis gewartet, sondern nur gesagt,
   * dass gerade nichts Neues da war.
   */
  const check = useCallback(async () => {
    setState('checking')
    try {
      const reg = registration.current
      if (!reg) {
        setState('fehlgeschlagen')
        return
      }
      await reg.update()
      // Kurz Luft lassen: Findet sich etwas, kommt `onNeedRefresh` gleich noch.
      await new Promise((fertig) => setTimeout(fertig, 800))
      setState('aktuell')
    } catch {
      // Kein Netz, oder der Server war nicht erreichbar.
      setState('fehlgeschlagen')
    }
  }, [])

  const install = useCallback(() => {
    void updateServiceWorker(true)
  }, [updateServiceWorker])

  const value = useMemo<UpdateValue>(
    () => ({ ready, state, pending, check, install }),
    [ready, state, pending, check, install],
  )

  return (
    <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
  )
}

export function useUpdate(): UpdateValue {
  const value = useContext(UpdateContext)
  if (!value) throw new Error('useUpdate braucht den UpdateProvider')
  return value
}

/**
 * Die Notizen der **neuen** Fassung holen und abziehen, was diese hier schon
 * kennt. Übrig bleibt, was das Update bringt.
 *
 * `cache: 'no-store'` und der Zeitstempel: Ohne beides bekäme man die Datei aus
 * dem Zwischenspeicher des Service Workers — also die alte.
 *
 * Schlägt das fehl, kommt eine leere Liste zurück. Der Update-Knopf steht dann
 * trotzdem da; nur der Text dazu fehlt. Das ist der richtige Ausgang: Am
 * Aktualisieren soll eine unerreichbare Notizdatei nicht hindern.
 */
async function loadPending(): Promise<ChangeEntry[]> {
  try {
    const url = `${import.meta.env.BASE_URL}changelog.json?stand=${Date.now()}`
    const antwort = await fetch(url, { cache: 'no-store' })
    if (!antwort.ok) return []
    return pendingEntries(toChangelog(await antwort.json()))
  } catch {
    return []
  }
}
