import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../data/RepositoryContext.tsx'
import { formatHouseholdCode } from '../../data/ids.ts'
import { parseInviteCode } from '../../lib/invite.ts'
import { Button } from '../../components/ui.tsx'
import { APP_NAME, Mark } from '../../components/Logo.tsx'

/**
 * Was hinter einem angetippten Einladungslink steckt.
 *
 * Die Seite gilt auch, wenn auf diesem Gerät noch gar kein Haushalt eingerichtet
 * ist — das ist ja der Normalfall beim Einladen. Deshalb wird sie in App.tsx
 * abgefragt, bevor die Einrichtungsseite greift.
 *
 * Bewusst **ein Tipp zum Bestätigen** statt eines stillen Beitritts: Ein Link
 * aus einem Chat darf nicht im Vorbeigehen umschreiben, zu welchem Haushalt ein
 * Gerät gehört — erst recht nicht, wenn die Nachricht weitergeleitet wurde.
 */
export default function JoinPage() {
  const { code: param } = useParams()
  const navigate = useNavigate()
  const { error, canSync, household, joinExistingHousehold } = useSession()
  const [busy, setBusy] = useState(false)

  const code = parseInviteCode(param)
  const alreadyHere = code !== null && household?.id === code

  async function join() {
    if (!code) return
    setBusy(true)
    try {
      await joinExistingHousehold(code)
      // Ohne replace bliebe der Code im Verlauf stehen und die Seite griffe
      // beim Zurückgehen erneut.
      navigate('/rezepte', { replace: true })
    } catch {
      // Die Meldung kommt aus dem Kontext und steht unten auf der Seite.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Frame>
      {!code ? (
        <Notice>
          Dieser Einladungslink ist unvollständig. Vermutlich wurde die Nachricht
          beim Weiterleiten abgeschnitten — lass sie dir noch einmal schicken.
        </Notice>
      ) : !canSync ? (
        <Notice>
          Auf diesem Gerät ist der Abgleich nicht eingerichtet. Ohne ihn kann
          dieses Gerät keinem Haushalt beitreten.
        </Notice>
      ) : alreadyHere ? (
        <Notice>
          Du bist in diesem Haushalt schon dabei. Es gibt nichts zu tun.
        </Notice>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-ink-500">
            {household
              ? `Du bist gerade im Haushalt „${household.name}“. Wenn du wechselst, arbeitet dieses Gerät ab sofort im eingeladenen Haushalt.`
              : 'Du wurdest zu einem Haushalt eingeladen. Ab dem Beitritt seht ihr dieselben Rezepte, Pläne und Einkaufslisten.'}
          </p>

          <div className="mt-4 rounded-xl bg-accent-soft p-4 text-center">
            <p className="text-xs font-medium tracking-wide text-accent-text uppercase">
              Haushalts-Code
            </p>
            <p className="mt-1.5 font-mono text-lg font-semibold tracking-wider text-ink-900">
              {formatHouseholdCode(code)}
            </p>
          </div>

          <Button block className="mt-4" disabled={busy} onClick={() => void join()}>
            {busy ? 'Verbinde …' : household ? 'Wechseln' : 'Beitreten'}
          </Button>
        </>
      )}

      <Button
        block
        variant="ghost"
        className="mt-3"
        onClick={() => navigate('/rezepte', { replace: true })}
      >
        {code && canSync && !alreadyHere ? 'Abbrechen' : 'Zur App'}
      </Button>

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm leading-relaxed text-red-700">
          {error}
        </p>
      )}
    </Frame>
  )
}

/** Derselbe Rahmen wie auf der Einrichtungsseite, damit es nicht fremd wirkt. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
          <Mark className="h-9 w-auto" />
        </div>
        <h1 className="text-2xl font-semibold text-ink-900">{APP_NAME}</h1>
      </div>
      {children}
    </div>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-clay-100 p-4 text-sm leading-relaxed text-ink-600">
      {children}
    </p>
  )
}
