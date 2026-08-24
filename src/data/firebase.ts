import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
}

/**
 * Die Werte, ohne die nichts läuft — samt dem Namen des Secrets, unter dem sie
 * einzutragen sind. `messagingSenderId` fehlt hier bewusst: Den braucht nur
 * Push, nicht die Anmeldung und nicht die Datenbank.
 *
 * `authDomain` **gehört dazu**, auch wenn Firebase ohne ihn zunächst startet:
 * Ohne ihn scheitert erst die anonyme Anmeldung, und zwar mit einer Meldung,
 * die nicht auf die Ursache zeigt. Lieber gleich als „nicht eingerichtet"
 * melden als später mit einem Rätsel dastehen.
 */
export const REQUIRED_CONFIG = [
  { key: 'apiKey', secret: 'VITE_FB_API_KEY' },
  { key: 'authDomain', secret: 'VITE_FB_AUTH_DOMAIN' },
  { key: 'projectId', secret: 'VITE_FB_PROJECT_ID' },
  { key: 'appId', secret: 'VITE_FB_APP_ID' },
] as const

/**
 * Welche der nötigen Werte fehlen? Gibt die Namen der Secrets zurück, nicht
 * deren Inhalt — beim Einrichten will man wissen, *was* fehlt, und die Werte
 * gehören nicht in die Oberfläche.
 */
export function missingConfig(
  werte: Record<string, string | undefined> = config,
): string[] {
  return REQUIRED_CONFIG.filter(({ key }) => !werte[key]?.trim()).map(
    ({ secret }) => secret,
  )
}

/**
 * Ohne hinterlegte Zugangsdaten läuft die App im Probemodus auf der lokalen
 * Ablage. Der Firebase-Web-API-Key ist übrigens kein Geheimnis — er
 * identifiziert nur das Projekt; abgesichert wird über die Security Rules.
 */
export const isFirebaseConfigured = missingConfig().length === 0

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null

export function getFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase ist nicht konfiguriert.')
  }
  if (!app || !db || !auth) {
    app = initializeApp(config)
    db = initializeFirestore(app, {
      // Der eingebaute Cache macht die App offline benutzbar und synchronisiert
      // nach, sobald wieder Netz da ist — im Supermarkt der entscheidende Teil.
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      // Optionale Felder (Foto, Notiz) dürfen als undefined durchgereicht
      // werden, statt den Schreibvorgang platzen zu lassen.
      ignoreUndefinedProperties: true,
    })
    auth = getAuth(app)
  }
  return { app, db, auth }
}

/**
 * Meldet das Gerät anonym an. Wir brauchen keine Passwörter — die Anmeldung
 * liefert nur die stabile Kennung, über die die Security Rules prüfen, ob
 * dieses Gerät zum Haushalt gehört.
 */
export function ensureSignedIn(): Promise<User> {
  const { auth: instance } = getFirebase()
  if (instance.currentUser) return Promise.resolve(instance.currentUser)

  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(
      instance,
      (user) => {
        if (!user) return
        stop()
        resolve(user)
      },
      (error) => {
        stop()
        reject(error)
      },
    )
    signInAnonymously(instance).catch((error) => {
      stop()
      reject(error)
    })
  })
}
