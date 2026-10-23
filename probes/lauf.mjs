import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Lässt alle Proben laufen.
 *
 * Aufruf: `npm run probe` — oder `npm run probe -- wischen`, um nur eine
 * laufen zu lassen.
 *
 * **Gebaut wird immer zuerst.** Zweimal hat eine Gegenprobe falsch grün
 * gemeldet, weil die Sabotage nicht übersetzte, `dist` dadurch alt blieb und
 * die Probe gegen den vorigen Bau lief. Das lässt sich nicht durch
 * Aufmerksamkeit lösen, sondern nur dadurch, dass es nicht mehr passieren
 * kann.
 */

const HIER = dirname(fileURLToPath(import.meta.url))
const WURZEL = join(HIER, '..')
const PORT = Number(process.env.PROBE_PORT ?? 4179)
const ORT = `http://localhost:${PORT}/`

const nurDiese = process.argv.slice(2)

function sagen(text) {
  console.log(text)
}

// --- Playwright da? ------------------------------------------------------
if (!existsSync(join(HIER, 'node_modules', 'playwright'))) {
  sagen('Playwright fehlt. Einmal je Rechner nötig:\n')
  sagen('  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm --prefix probes install\n')
  sagen('(Chromium liegt bereits unter /opt/pw-browsers — deshalb ohne Download.)')
  process.exit(1)
}

// --- Bauen ---------------------------------------------------------------
sagen('▸ Bauen …')
const bau = spawnSync('npm', ['run', 'build'], {
  cwd: WURZEL,
  encoding: 'utf8',
})
if (bau.status !== 0) {
  sagen('Der Bau ist fehlgeschlagen — die Proben liefen sonst gegen den alten')
  sagen('Stand und meldeten falsch grün. Hier die Meldung:\n')
  sagen((bau.stdout ?? '') + (bau.stderr ?? ''))
  process.exit(1)
}
sagen('  gebaut.\n')

// --- Server starten ------------------------------------------------------
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: WURZEL,
  stdio: 'ignore',
})

async function warteAufServer() {
  for (let versuch = 0; versuch < 40; versuch += 1) {
    try {
      const antwort = await fetch(ORT)
      if (antwort.ok) return true
    } catch {
      // Noch nicht da — weiter warten.
    }
    await new Promise((fertig) => setTimeout(fertig, 250))
  }
  return false
}

function serverBeenden() {
  if (!server.killed) server.kill('SIGTERM')
}
process.on('exit', serverBeenden)
process.on('SIGINT', () => {
  serverBeenden()
  process.exit(130)
})

if (!(await warteAufServer())) {
  sagen(`Der Server auf ${ORT} ist nicht hochgekommen.`)
  serverBeenden()
  process.exit(1)
}

// --- Proben laufen lassen ------------------------------------------------
const alle = readdirSync(HIER)
  .filter((datei) => datei.endsWith('.mjs'))
  .filter((datei) => datei !== 'lauf.mjs' && datei !== 'helfer.mjs')
  .sort()

const proben =
  nurDiese.length === 0
    ? alle
    : alle.filter((datei) => nurDiese.some((wunsch) => datei.includes(wunsch)))

if (proben.length === 0) {
  sagen(`Keine Probe passt zu: ${nurDiese.join(', ')}`)
  sagen(`Vorhanden: ${alle.join(', ')}`)
  serverBeenden()
  process.exit(1)
}

const rot = []
for (const probe of proben) {
  sagen(`▸ ${probe}`)
  const lauf = spawnSync('node', [join(HIER, probe)], {
    cwd: WURZEL,
    stdio: 'inherit',
    env: { ...process.env, PROBE_ORT: ORT },
  })
  if (lauf.status !== 0) rot.push(probe)
  sagen('')
}

serverBeenden()

// --- Zusammenfassung -----------------------------------------------------
sagen('─'.repeat(52))
if (rot.length === 0) {
  sagen(`ALLE ${proben.length} PROBEN GRÜN`)
  process.exit(0)
}
sagen(`${rot.length} von ${proben.length} Proben ROT:`)
for (const probe of rot) sagen(`  · ${probe}`)
process.exit(1)
