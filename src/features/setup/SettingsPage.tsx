import { useState } from 'react'
import { useSession } from '../../data/RepositoryContext.tsx'
import { formatHouseholdCode } from '../../data/ids.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Button } from '../../components/ui.tsx'
import { CopyIcon, ShareIcon } from '../../components/Icons.tsx'
import { copyText, shareText } from '../../lib/share.ts'
import { useOnline } from '../../data/hooks.ts'

export default function SettingsPage() {
  const { household, isDemo, canSync, leave } = useSession()
  const online = useOnline()
  const [copied, setCopied] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const code = household ? formatHouseholdCode(household.id) : null

  async function share() {
    if (!code) return
    const result = await shareText({
      title: 'Rezeptbuch',
      text: `Tritt unserem Rezeptbuch bei. Code: ${code}`,
    })
    if (result === 'copied') flashCopied()
  }

  async function copy() {
    if (!code) return
    if (await copyText(code)) flashCopied()
  }

  function flashCopied() {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <PageHeader title="Einstellungen" back="/rezepte" />

      <div className="space-y-6 p-4">
        <section className="rounded-2xl bg-surface p-4 ring-1 ring-clay-200">
          <h2 className="text-sm font-semibold text-ink-700">Haushalt</h2>

          {household ? (
            <>
              <p className="mt-1 text-sm text-ink-500">
                {household.name} · Änderungen erscheinen bei allen Geräten mit
                diesem Code.
              </p>

              <div className="mt-4 rounded-xl bg-leaf-50 p-4 text-center">
                <p className="text-xs font-medium tracking-wide text-leaf-700 uppercase">
                  Haushalts-Code
                </p>
                <p className="mt-1.5 font-mono text-lg font-semibold tracking-wider text-ink-900 select-all">
                  {code}
                </p>
              </div>

              <div className="mt-3 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={share}>
                  <ShareIcon className="size-5" />
                  Teilen
                </Button>
                <Button variant="secondary" className="flex-1" onClick={copy}>
                  <CopyIcon className="size-5" />
                  {copied ? 'Kopiert' : 'Kopieren'}
                </Button>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-ink-400">
                Wer diesen Code hat, sieht eure Rezepte und Pläne und kann sie
                ändern. Gib ihn nur weiter, wenn das so gewollt ist.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              Du arbeitest gerade nur auf diesem Gerät. Es wird nichts
              abgeglichen und nichts hochgeladen.
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-4 ring-1 ring-clay-200">
          <h2 className="text-sm font-semibold text-ink-700">Verbindung</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <Row label="Netz" value={online ? 'verbunden' : 'offline'} />
            <Row
              label="Abgleich"
              value={
                isDemo
                  ? canSync
                    ? 'aus (nur dieses Gerät)'
                    : 'nicht eingerichtet'
                  : 'an'
              }
            />
            <Row label="Stand" value={__BUILD_STAMP__} />
          </dl>
          {!online && (
            <p className="mt-3 rounded-xl bg-clay-100 p-3 text-xs leading-relaxed text-ink-600">
              Ohne Netz kannst du weiterarbeiten. Sobald du wieder online bist,
              werden die Änderungen automatisch übertragen.
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-4 ring-1 ring-clay-200">
          <h2 className="text-sm font-semibold text-ink-700">
            Von diesem Gerät abmelden
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            {isDemo
              ? 'Die auf diesem Gerät angelegten Daten bleiben erhalten, du landest wieder bei der Auswahl.'
              : 'Die Daten bleiben im Haushalt. Mit dem Code kommst du jederzeit zurück — notier ihn dir vorher.'}
          </p>

          {confirmLeave ? (
            <div className="mt-3 flex gap-2">
              <Button variant="danger" className="flex-1" onClick={leave}>
                Wirklich abmelden
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmLeave(false)}
              >
                Abbrechen
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              className="mt-3"
              block
              onClick={() => setConfirmLeave(true)}
            >
              Abmelden
            </Button>
          )}
        </section>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-700">{value}</dd>
    </div>
  )
}
