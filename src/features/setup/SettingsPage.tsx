import { useState } from 'react'
import { useSession } from '../../data/RepositoryContext.tsx'
import { formatHouseholdCode } from '../../data/ids.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Button } from '../../components/ui.tsx'
import { CopyIcon, DownloadIcon, ShareIcon } from '../../components/Icons.tsx'
import { copyText, shareText } from '../../lib/share.ts'
import { missingConfig } from '../../data/firebase.ts'
import { inviteUrl } from '../../lib/invite.ts'
import { readTheme, setTheme, type Theme } from '../../lib/theme.ts'
import { cx } from '../../components/ui.tsx'
import { useOnline, useRecipes, useShoppingState } from '../../data/hooks.ts'
import { useRepository } from '../../data/RepositoryContext.tsx'
import { backupFilename, formatRecipeBackup } from '../../domain/backup.ts'
import { downloadText } from '../../lib/download.ts'

export default function SettingsPage() {
  const { household, isDemo, canSync, leave } = useSession()
  const online = useOnline()
  const { data: recipes } = useRecipes()
  const { data: shopping } = useShoppingState()
  const repository = useRepository()
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [orderReset, setOrderReset] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  // Der Zustand steht im Dokument, nicht in React — das Skript im Kopf von
  // index.html hat ihn schon vor dem ersten Zeichnen gesetzt. Hier wird er nur
  // gespiegelt, damit der Schalter weiß, welche Seite gerade an ist.
  const [theme, setThemeState] = useState<Theme>(readTheme)

  function chooseTheme(next: Theme) {
    setTheme(next)
    setThemeState(next)
  }

  const code = household ? formatHouseholdCode(household.id) : null

  async function share() {
    if (!household || !code) return
    // Die Adresse steht im Text, nicht im url-Feld von navigator.share: Die
    // Ziele gehen unterschiedlich damit um, manche hängen beides aneinander und
    // der Link stünde doppelt da. Ein Feld ist vorhersagbar, und WhatsApp macht
    // aus einer Adresse im Text von selbst einen antippbaren Link.
    //
    // Der Code steht zusätzlich als Zeile darunter — falls der Link unterwegs
    // abgeschnitten wird, kommt die andere Person trotzdem weiter.
    const result = await shareText({
      title: 'PlanPrepEat',
      text: [
        `Tritt unserem Haushalt „${household.name}“ bei PlanPrepEat bei:`,
        inviteUrl(household.id),
        '',
        `Falls der Link nicht geht: Code ${code} in der App unter „Einem Haushalt beitreten“ eintragen.`,
      ].join('\n'),
    })
    if (result === 'copied') flashCopied()
  }

  async function copy() {
    if (!code) return
    if (await copyText(code)) flashCopied()
  }

  /**
   * Die gemerkte Ladenreihenfolge verwerfen.
   *
   * Nötig, wenn der Laden umgebaut wurde oder man den Laden wechselt: Sonst
   * schleppt man eine Runde mit sich herum, die nicht mehr stimmt, und müsste
   * sie Posten für Posten zurechtschieben. Danach steht die Liste wieder
   * alphabetisch, und die nächste Runde wird neu gelernt.
   */
  function resetStoreOrder() {
    void repository.saveShoppingState({ ...shopping, storeOrder: [] })
    setOrderReset(true)
    setTimeout(() => setOrderReset(false), 2000)
  }

  function saveBackup() {
    const now = new Date()
    const text = formatRecipeBackup(recipes, {
      household: household?.name ?? 'Dieses Gerät',
      now,
    })
    downloadText(backupFilename(now), text)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

              <div className="mt-4 rounded-xl bg-accent-soft p-4 text-center">
                <p className="text-xs font-medium tracking-wide text-accent-text uppercase">
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
                Wer diesen Code oder den Einladungslink hat, sieht eure Rezepte
                und Pläne und kann sie ändern. Gib beides nur weiter, wenn das so
                gewollt ist.
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
          <h2 className="text-sm font-semibold text-ink-700">Darstellung</h2>
          <p className="mt-1 text-sm text-ink-500">
            Gilt nur für dieses Gerät.
          </p>

          <div
            role="radiogroup"
            aria-label="Darstellung"
            className="mt-3 flex gap-2 rounded-xl bg-clay-100 p-1"
          >
            <ThemeChoice
              value="light"
              label="Hell"
              current={theme}
              onChoose={chooseTheme}
            />
            <ThemeChoice
              value="dark"
              label="Dunkel"
              current={theme}
              onChoose={chooseTheme}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-4 ring-1 ring-clay-200">
          <h2 className="text-sm font-semibold text-ink-700">
            Ladenreihenfolge
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            {shopping.storeOrder.length === 0
              ? 'Noch nichts gemerkt. Schieb die Posten auf der Einkaufsliste einmal in die Reihenfolge, in der du durch den Laden gehst — ab dann bleibt sie stehen.'
              : `${shopping.storeOrder.length} ${shopping.storeOrder.length === 1 ? 'Zutat hat' : 'Zutaten haben'} einen festen Platz.`}
          </p>

          {shopping.storeOrder.length > 0 && (
            <>
              <Button
                variant="secondary"
                className="mt-3"
                block
                onClick={resetStoreOrder}
              >
                {orderReset ? 'Zurückgesetzt' : 'Reihenfolge zurücksetzen'}
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-ink-400">
                Danach steht die Liste wieder alphabetisch. Sinnvoll, wenn ihr
                den Laden wechselt oder dort umgebaut wurde.
              </p>
            </>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-4 ring-1 ring-clay-200">
          <h2 className="text-sm font-semibold text-ink-700">Sicherung</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            Lädt alle Rezepte als Textdatei herunter — zum Nachlesen, falls
            einmal eines verlorengeht.
          </p>

          <Button
            variant="secondary"
            className="mt-3"
            block
            disabled={recipes.length === 0}
            onClick={saveBackup}
          >
            <DownloadIcon className="size-5" />
            {saved
              ? 'Gesichert'
              : recipes.length === 0
                ? 'Noch keine Rezepte'
                : `${recipes.length} ${recipes.length === 1 ? 'Rezept' : 'Rezepte'} sichern`}
          </Button>

          <p className="mt-3 text-xs leading-relaxed text-ink-400">
            Ohne Fotos, und die Datei lässt sich nicht wieder einlesen — du
            liest sie und tippst ab, was fehlt. Am besten ab und zu wiederholen.
          </p>
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

          {isDemo && !canSync && <MissingConfig />}

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

/**
 * Was beim Einrichten von Firebase noch fehlt.
 *
 * „Nicht eingerichtet" allein lässt einen raten, ob man ein Secret vergessen
 * hat oder ob nur der Bau noch nicht neu gelaufen ist. Deshalb steht hier, was
 * genau fehlt — **nur die Namen der Secrets, nie deren Inhalt.**
 *
 * Stehen hier alle vier, gibt es zwei Gründe, und der zweite ist der häufigere:
 * Die Secrets sind noch gar nicht angelegt — oder sie sind es, aber der Bau lief
 * davor. Deshalb steht der Hinweis auf den neuen Durchlauf mit dabei.
 *
 * Wird nur aufgerufen, wenn die Zugangsdaten fehlen; die Liste ist dann
 * zwangsläufig nicht leer.
 */
function MissingConfig() {
  const fehlend = missingConfig()

  return (
    <div className="mt-3 rounded-xl bg-clay-100 p-3 text-xs leading-relaxed text-ink-600">
      <p>
        Es fehlen noch {fehlend.length === 1 ? 'dieser Wert' : 'diese Werte'} als
        Secret im GitHub-Repository:
      </p>
      <ul className="mt-1.5 space-y-0.5 font-mono">
        {fehlend.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p className="mt-2">
        Danach muss der Bau einmal neu laufen — Secrets allein wirken nicht.
      </p>
    </div>
  )
}

/**
 * Eine Hälfte des Schalters. `role="radio"` statt zweier Knöpfe: So liest ein
 * Screenreader „ausgewählt" vor, statt nur „Schaltfläche Hell".
 */
function ThemeChoice({
  value,
  label,
  current,
  onChoose,
}: {
  value: Theme
  label: string
  current: Theme
  onChoose: (theme: Theme) => void
}) {
  const active = current === value
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onChoose(value)}
      className={cx(
        'min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors',
        active ? 'bg-accent text-on-accent shadow-sm' : 'text-ink-600',
      )}
    >
      {label}
    </button>
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
