import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Repository } from './repository.ts'
import { MemoryRepository } from './memory/memoryRepository.ts'
import { FirestoreRepository } from './firestore/firestoreRepository.ts'
import { getFirebase, isFirebaseConfigured } from './firebase.ts'
import {
  createHousehold,
  ensureMembership,
  joinHousehold,
  type HouseholdInfo,
} from './household.ts'

const STORAGE_KEY = 'rezeptbuch:session'

type Session =
  | { mode: 'memory' }
  | { mode: 'firebase'; householdId: string; name: string }

type Status = 'loading' | 'setup' | 'ready' | 'error'

interface RepositoryContextValue {
  status: Status
  error: string | null
  repository: Repository | null
  /** Der Haushalt, in dem wir gerade arbeiten — null im Probemodus. */
  household: HouseholdInfo | null
  /** Ob die App gerade ohne Sync auf diesem Gerät arbeitet. */
  isDemo: boolean
  /** Ob überhaupt Zugangsdaten hinterlegt sind. */
  canSync: boolean
  createNewHousehold(name: string): Promise<void>
  joinExistingHousehold(code: string): Promise<void>
  startDemo(): void
  leave(): void
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null)

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function writeSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ohne localStorage muss man sich nach jedem Start neu verbinden — ärgerlich,
    // aber kein Grund, die App abstürzen zu lassen.
  }
}

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [household, setHousehold] = useState<HouseholdInfo | null>(null)

  const connect = useCallback(async (session: Session) => {
    if (session.mode === 'memory') {
      setRepository(new MemoryRepository('probe'))
      setHousehold(null)
      setStatus('ready')
      return
    }

    const { db } = getFirebase()
    const info = await ensureMembership(session.householdId)
    setRepository(new FirestoreRepository(db, info.id))
    setHousehold(info)
    setStatus('ready')
  }, [])

  // Beim Start die zuletzt benutzte Verbindung wiederherstellen.
  useEffect(() => {
    let cancelled = false
    const session = readSession()

    if (!session) {
      setStatus('setup')
      return
    }
    if (session.mode === 'firebase' && !isFirebaseConfigured) {
      // Der Build kennt die Zugangsdaten nicht mehr — zurück zur Einrichtung,
      // statt mit einer unverständlichen Firebase-Ausnahme zu scheitern.
      setStatus('setup')
      return
    }

    connect(session).catch((cause: unknown) => {
      if (cancelled) return
      setError(describeError(cause))
      setStatus('error')
    })

    return () => {
      cancelled = true
    }
  }, [connect])

  const createNewHousehold = useCallback(
    async (name: string) => {
      setStatus('loading')
      setError(null)
      try {
        const info = await createHousehold(name)
        const session: Session = {
          mode: 'firebase',
          householdId: info.id,
          name: info.name,
        }
        writeSession(session)
        await connect(session)
      } catch (cause) {
        setError(describeError(cause))
        setStatus('setup')
        throw cause
      }
    },
    [connect],
  )

  const joinExistingHousehold = useCallback(
    async (code: string) => {
      setStatus('loading')
      setError(null)
      try {
        const info = await joinHousehold(code)
        const session: Session = {
          mode: 'firebase',
          householdId: info.id,
          name: info.name,
        }
        writeSession(session)
        await connect(session)
      } catch (cause) {
        setError(describeError(cause))
        setStatus('setup')
        throw cause
      }
    },
    [connect],
  )

  const startDemo = useCallback(() => {
    const session: Session = { mode: 'memory' }
    writeSession(session)
    void connect(session)
  }, [connect])

  const leave = useCallback(() => {
    writeSession(null)
    setRepository(null)
    setHousehold(null)
    setError(null)
    setStatus('setup')
  }, [])

  const value = useMemo<RepositoryContextValue>(
    () => ({
      status,
      error,
      repository,
      household,
      isDemo: repository !== null && household === null,
      canSync: isFirebaseConfigured,
      createNewHousehold,
      joinExistingHousehold,
      startDemo,
      leave,
    }),
    [
      status,
      error,
      repository,
      household,
      createNewHousehold,
      joinExistingHousehold,
      startDemo,
      leave,
    ],
  )

  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  )
}

export function useSession(): RepositoryContextValue {
  const value = useContext(RepositoryContext)
  if (!value) {
    throw new Error('useSession muss innerhalb von RepositoryProvider stehen.')
  }
  return value
}

/** Die aktive Ablage. Nur innerhalb der Reiter benutzen — dort ist sie da. */
export function useRepository(): Repository {
  const { repository } = useSession()
  if (!repository) {
    throw new Error('Es ist keine Ablage verbunden.')
  }
  return repository
}

/**
 * Firebase-Fehler in Sätze übersetzen, die sagen, was zu tun ist.
 *
 * Die drei hier abgefangenen Fälle sind genau die drei Schritte, die beim
 * Einrichten übersprungen werden können. Ein durchgereichtes
 * „FirebaseError: auth/configuration-not-found" schickt einen dagegen ins
 * Suchfeld statt in die richtige Einstellung.
 *
 * Exportiert, damit die Übersetzung prüfbar ist — sie ist das Einzige, was der
 * Benutzer beim Einrichten zu sehen bekommt.
 */
export function describeError(cause: unknown): string {
  if (cause instanceof Error) {
    if (cause.name === 'HouseholdNotFoundError') return cause.message
    if (cause.message.includes('permission-denied')) {
      return 'Zugriff verweigert. Sind die Sicherheitsregeln in Firebase veröffentlicht?'
    }
    if (cause.message.includes('auth/configuration-not-found')) {
      return 'Die anonyme Anmeldung ist im Firebase-Projekt noch nicht aktiviert.'
    }
    // Falscher, abgeschnittener oder zum Projekt nicht passender Schlüssel.
    if (
      cause.message.includes('auth/invalid-api-key') ||
      cause.message.includes('auth/api-key-not-valid') ||
      cause.message.includes('auth/invalid-credential')
    ) {
      return 'Die Firebase-Zugangsdaten stimmen nicht. Sind alle Secrets richtig eingetragen und ist der Bau danach neu gelaufen?'
    }
    return cause.message
  }
  return 'Unbekannter Fehler.'
}
