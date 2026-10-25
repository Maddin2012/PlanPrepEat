# Prüfskripte

Diese Skripte öffnen die App in einem unsichtbaren Browser, klicken sich durch
wie ein Mensch und **messen** dann nach: die tatsächlich gezeichnete
Rahmenfarbe, die Anzahl der Zeilen auf der Liste, welche Stimme an der
Sprachausgabe angekommen ist.

Das ist etwas anderes als die Tests in `src/` (`npm test`). Die prüfen das
Rechnen — „500 g plus 800 g macht 1,3 kg". Sie können nicht prüfen, ob ein
Rahmen wirklich golden **aussieht** oder ob ein Wisch funktioniert. Genau
deshalb sind zwei gemeldete Fehler durch die Tests geschlüpft und erst hier
aufgefallen.

## Laufen lassen

```
npm run probe              # alle
npm run probe -- wischen   # nur eine, Name genügt teilweise
```

Einmal je Rechner nötig, weil Playwright bewusst **nicht** in der
`package.json` der App steht (sonst lädt es der Veröffentlichungslauf jedes
Mal mit):

```
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm --prefix probes install
```

Chromium liegt schon unter `/opt/pw-browsers`, deshalb ohne Download. Fehlt
Playwright, sagt der Läufer genau diesen Befehl.

## Was der Läufer von sich aus tut

- **Er baut zuerst.** Zweimal hat eine Gegenprobe falsch grün gemeldet, weil
  eine Änderung nicht übersetzte, `dist` dadurch alt blieb und die Probe gegen
  den vorigen Stand lief. Das ist jetzt nicht mehr möglich.
- Er startet den Vorschau-Server, räumt ihn hinterher ab und **endet mit einem
  Fehlercode**, sobald eine Probe rot ist.

## Die Proben

| Datei | Worum es geht |
| --- | --- |
| `plan-heute.mjs` | Der goldene Rahmen um heute — **auch an einem belegten Feld**. Genau daran ist eine frühere Fassung dieser Probe gescheitert: Sie maß nur leere Felder. |
| `wischen.mjs` | Wischen zwischen den Reitern, mit echten Berührungen. Hier stecken zwei Browser-Eigenheiten, die man nur so trifft. |
| `vorlesen.mjs` | Vorlesen samt Stimme, Tempo und Tonhöhe — mit einer Attrappe für die Sprachausgabe, weil im Prüfbehälter keine Stimme liegt. |
| `kosmetik.mjs` | Das Wasserzeichen: gemessen **dunkler** als der Grund, damit es die Lesbarkeit nicht verschlechtern kann. Dazu die aufgeräumten Einstellungen. |
| `gestrichen.mjs` | „Brauche ich diese Woche nicht" — sichtbar und rücknehmbar, statt lautlos und dauerhaft. |
| `rueckgaengig.mjs` | Der Rückgängig-Knopf, inklusive Reiterwechsel und einer Messung der Kopfzeilenbreite. |
| `erledigt.mjs` | Der Erledigt-Block steht alphabetisch, während oben die geschobene Ladenreihenfolge gilt. Schiebt dafür erst eine Runde, die dem Alphabet widerspricht. |
| `nachschlag.mjs` | Kommt nach dem Abhaken ein Rezept dazu, steht die Zutat wieder **oben** — gemessen wird die Stelle im Baum, nicht nur die Zahl. |

## Beim Schreiben einer neuen Probe

`helfer.mjs` enthält das Gemeinsame — Browser, `pruefe()`, der harte Abbruch
beim Fehlerbildschirm, `rezept()`, `einplanen()`, `zumReiter()`. **Dort stehen
die Knopfnamen einmal richtig**, statt dass sie in jeder neuen Probe wieder
erraten werden müssen. Ein paar Stolpersteine, die Zeit gekostet haben:

- Das Zutatenfeld hängt an einer `datalist` und ist damit eine Auswahlliste,
  kein Textfeld — über `getByLabel` ansprechen, nicht über die Rolle.
- Die Reiterleiste heißt **„Einkauf"**, nicht „Einkaufsliste".
- Im Rezept gibt es die Reiterleiste nicht; erst „Zurück".
- Eine Listenzeile hat zwei Knöpfe: einen zum Abhaken und einen mit dem Namen
  „<Zutat> bearbeiten". Den falschen zu nehmen, hakt nur ab.
- **Zeilen zählen, nicht Textstellen.** In „Bratkartoffeln" steckt
  „Kartoffeln"; eine Textsuche über die Seite zählt doppelt.
- Für eine Gegenprobe muss die Sabotage **übersetzbar** sein. Sonst bricht
  `tsc` ab, der Läufer meldet den Baufehler — und früher lief die Probe
  stillschweigend gegen den alten Stand.
