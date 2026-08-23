import { useState } from 'react'
import { useSession } from '../../data/RepositoryContext.tsx'
import { normalizeHouseholdCode } from '../../data/ids.ts'
import { Button, Field, TextInput } from '../../components/ui.tsx'
import { UsersIcon } from '../../components/Icons.tsx'
import { APP_NAME, Mark } from '../../components/Logo.tsx'

type Mode = 'start' | 'create' | 'join'

/**
 * Erster Start: Haushalt anlegen, einem bestehenden beitreten oder sich die App
 * erst einmal im Probemodus ansehen.
 */
export default function SetupPage() {
  const { error, canSync, createNewHousehold, joinExistingHousehold, startDemo } =
    useSession()
  const [mode, setMode] = useState<Mode>('start')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch {
      // Die Fehlermeldung kommt aus dem Kontext und steht unten auf der Seite.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
          <Mark className="h-9 w-auto" />
        </div>
        <h1 className="text-2xl font-semibold text-ink-900">{APP_NAME}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Rezepte sammeln, die nächsten Tage vorausplanen und die Einkaufsliste
          bekommt ihr geschenkt.
        </p>
      </div>

      {!canSync && (
        <div className="mb-6 rounded-xl bg-clay-100 p-4 text-sm leading-relaxed text-ink-600">
          <strong className="font-medium text-ink-700">
            Noch kein Firebase hinterlegt.
          </strong>{' '}
          Die App läuft deshalb nur auf diesem Gerät. Wie ihr den Abgleich
          zwischen zwei Handys einrichtet, steht in der{' '}
          <code className="rounded bg-surface px-1 py-0.5 text-xs">README.md</code>.
        </div>
      )}

      {mode === 'start' && (
        <div className="space-y-3">
          {canSync && (
            <>
              <Button block onClick={() => setMode('create')}>
                Neuen Haushalt anlegen
              </Button>
              <Button block variant="secondary" onClick={() => setMode('join')}>
                <UsersIcon className="size-5" />
                Einem Haushalt beitreten
              </Button>
            </>
          )}
          <Button block variant="ghost" onClick={startDemo}>
            {canSync ? 'Erst mal allein ausprobieren' : 'Auf diesem Gerät starten'}
          </Button>
        </div>
      )}

      {mode === 'create' && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void run(() => createNewHousehold(name))
          }}
        >
          <Field
            label="Wie soll euer Haushalt heißen?"
            hint="Nur zur Wiedererkennung, du kannst irgendwas nehmen."
          >
            <TextInput
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Zuhause"
            />
          </Field>
          <Button block type="submit" disabled={busy}>
            {busy ? 'Wird angelegt …' : 'Anlegen'}
          </Button>
          <Button block variant="ghost" onClick={() => setMode('start')}>
            Zurück
          </Button>
        </form>
      )}

      {mode === 'join' && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void run(() => joinExistingHousehold(normalizeHouseholdCode(code)))
          }}
        >
          <Field
            label="Haushalts-Code"
            hint="Den findet die andere Person in der App unter Einstellungen."
          >
            <TextInput
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ABCD-EFGH-JKMN-PQRS"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono tracking-wider"
            />
          </Field>
          <Button
            block
            type="submit"
            disabled={busy || normalizeHouseholdCode(code).length < 8}
          >
            {busy ? 'Verbinde …' : 'Beitreten'}
          </Button>
          <Button block variant="ghost" onClick={() => setMode('start')}>
            Zurück
          </Button>
        </form>
      )}

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm leading-relaxed text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
