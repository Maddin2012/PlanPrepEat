import { formatHouseholdCode, normalizeHouseholdCode } from '../data/ids.ts'

/** Der Pfadteil des Einladungslinks — an einer Stelle, damit App und Link nicht auseinanderlaufen. */
export const INVITE_PATH = '/beitreten'

/** Ein Haushalts-Code hat 16 Zeichen; alles andere ist ein zerschnittener Link. */
const CODE_LENGTH = 16

/**
 * Wo diese App liegt: in der Veröffentlichung unter /PlanPrepEat/, lokal unter /.
 * Als Vorgabewert eines Parameters, nicht fest verdrahtet — so kann der Test
 * eine andere Adresse einsetzen, ohne an window herumzuschrauben.
 */
function defaultBase(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

/**
 * Der Einladungslink zu einem Haushalt.
 *
 * Er ersetzt das Abtippen: Die andere Person tippt ihn im Messenger an, die App
 * geht auf, der Code steht schon drin. Der Code erscheint darin in
 * Vierergruppen — falls ihn doch einmal jemand vorliest oder abschreibt, ist er
 * so am wenigsten fehleranfällig.
 *
 * Achtung: Der Link **ist** der Code. Er ist genauso schutzbedürftig.
 */
export function inviteUrl(id: string, base = defaultBase()): string {
  return `${base}#${INVITE_PATH}/${formatHouseholdCode(id)}`
}

/**
 * Liest die Kennung aus dem Pfadteil eines Einladungslinks.
 *
 * Gibt `null`, wenn nichts Brauchbares herauskommt — etwa weil die Nachricht
 * beim Weiterleiten abgeschnitten wurde. Ein zu kurzer Code darf nicht als
 * gültig durchgehen, sonst landet man in einer nichtssagenden Firebase-Meldung
 * statt bei „dieser Link ist unvollständig".
 */
export function parseInviteCode(param: string | undefined): string | null {
  if (!param) return null
  const code = normalizeHouseholdCode(decodeURIComponent(param))
  return code.length === CODE_LENGTH ? code : null
}
