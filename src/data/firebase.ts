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
 * Ohne hinterlegte Zugangsdaten läuft die App im Probemodus auf der lokalen
 * Ablage. Der Firebase-Web-API-Key ist übrigens kein Geheimnis — er
 * identifiziert nur das Projekt; abgesichert wird über die Security Rules.
 */
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.projectId && config.appId,
)

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
