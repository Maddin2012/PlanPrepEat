import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ensureSignedIn, getFirebase } from './firebase.ts'
import { newHouseholdId } from './ids.ts'

export interface HouseholdInfo {
  id: string
  name: string
}

export class HouseholdNotFoundError extends Error {
  constructor() {
    super('Zu diesem Code gibt es keinen Haushalt.')
    this.name = 'HouseholdNotFoundError'
  }
}

/**
 * Legt einen Haushalt an und trägt dieses Gerät als Mitglied ein. Die Kennung
 * ist zugleich der Einladungscode: Wer ihn kennt, darf beitreten — bei 16
 * Zeichen aus 31 Möglichkeiten ist Raten aussichtslos, und für zwei Personen
 * ist das der Weg mit dem geringsten Aufwand.
 */
export async function createHousehold(name: string): Promise<HouseholdInfo> {
  const { db } = getFirebase()
  const user = await ensureSignedIn()
  const id = newHouseholdId()

  await setDoc(doc(db, 'households', id), {
    name: name.trim() || 'Unser Haushalt',
    createdAt: Date.now(),
    members: { [user.uid]: true },
  })

  return { id, name }
}

/** Tritt einem bestehenden Haushalt bei. Wirft, wenn es ihn nicht gibt. */
export async function joinHousehold(id: string): Promise<HouseholdInfo> {
  const { db } = getFirebase()
  const user = await ensureSignedIn()
  const ref = doc(db, 'households', id)

  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) throw new HouseholdNotFoundError()

  await setDoc(ref, { members: { [user.uid]: true } }, { merge: true })
  return { id, name: (snapshot.data().name as string) ?? 'Unser Haushalt' }
}

/**
 * Stellt beim Start sicher, dass dieses Gerät noch als Mitglied eingetragen ist.
 * Nötig, weil die anonyme Anmeldung eine neue Kennung bekommt, wenn jemand die
 * Browserdaten löscht — ohne diesen Schritt stünde die App danach vor
 * verschlossener Tür, obwohl der Haushalt lokal noch hinterlegt ist.
 */
export async function ensureMembership(id: string): Promise<HouseholdInfo> {
  const { db } = getFirebase()
  const user = await ensureSignedIn()
  const snapshot = await getDoc(doc(db, 'households', id))
  if (!snapshot.exists()) throw new HouseholdNotFoundError()

  const members = (snapshot.data().members as Record<string, boolean>) ?? {}
  if (members[user.uid] !== true) {
    await setDoc(
      doc(db, 'households', id),
      { members: { [user.uid]: true } },
      { merge: true },
    )
  }
  return { id, name: (snapshot.data().name as string) ?? 'Unser Haushalt' }
}
