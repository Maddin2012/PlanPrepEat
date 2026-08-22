# Rezeptbuch & Essensplan

Eine App für zwei: Rezepte sammeln, anderthalb Wochen im Voraus planen — und die
Einkaufsliste entsteht dabei von selbst. Gebaut als **PWA**, also als Web-App,
die ihr euch auf den Startbildschirm legt und die sich danach wie eine normale
App verhält: eigenes Icon, Vollbild, funktioniert auch ohne Netz.

## Die drei Reiter

**Rezeptbuch.** Rezepte mit Zutaten (Gramm, Milliliter, Stück, EL, TL …), Foto,
Zubereitungszeit und Zubereitungsschritten. Jedes Rezept gilt für eine bestimmte
Portionszahl; in der Rezeptansicht könnt ihr hoch- und runterrechnen, ohne das
Rezept zu ändern. Die Suche findet Rezepte über ihren Namen und über die Zutaten.

**Essensplan.** Ein Zeitraum läuft immer von Mittwoch bis zum Sonntag der
Folgewoche — 12 Tage, je Tag eine Spalte für Mittagessen und eine für Abendbrot.
Ein Tippen auf ein Feld öffnet die Rezeptauswahl, danach stellt ihr die Portionen
ein. Auf ein Feld passen auch mehrere Rezepte, für Hauptgericht plus Beilage.
Neue Zeiträume legt ihr über das Plus oben an; alte bleiben als Archiv erhalten.

**Einkaufsliste.** Ergibt sich automatisch aus den eingeplanten Rezepten,
zusammengefasst und alphabetisch sortiert. Zweimal 200 g Zwiebeln
werden zu 400 g, ein halber Liter Milch und 250 ml addieren sich zu 750 ml.
Ihr könnt abhaken, Mengen korrigieren, Posten streichen („hab ich noch da") und
eigene Sachen wie Klopapier ergänzen.

**Wichtig dabei:** Ändert ihr den Essensplan, wächst die Liste einfach mit.
Gesetzte Häkchen, korrigierte Mengen und eigene Posten bleiben dabei erhalten —
die Liste selbst wird nämlich nirgends gespeichert, nur das, was ihr daran
verändert habt.

## Zu zweit benutzen

Beide Geräte gehören zum selben **Haushalt**. Wer ihn anlegt, findet unter
*Einstellungen* einen Code wie `ABCD-EFGH-JKMN-PQRS`. Die zweite Person tippt
beim ersten Start auf „Einem Haushalt beitreten" und gibt ihn ein — fertig.
Ab da sehen beide dieselben Rezepte, denselben Plan und dieselbe Einkaufsliste,
und Änderungen erscheinen innerhalb von Sekunden auf dem anderen Gerät.

Wer den Code hat, kann alles sehen und ändern. Gebt ihn also nur weiter, wenn
das so gewollt ist.

## Ohne Netz

Die App funktioniert offline weiter — im Supermarkt der entscheidende Teil.
Abgehakte Posten werden lokal gespeichert und übertragen sich automatisch,
sobald wieder Empfang da ist.

---

## Einrichtung

Ohne Firebase läuft die App im **Probemodus**: voll bedienbar, aber nur auf einem
Gerät. Für den Abgleich zwischen zwei Handys braucht es einmalig ein kostenloses
Firebase-Projekt. Das dauert etwa zehn Minuten und kostet bei zwei Personen
nichts — die Gratis-Stufe liegt um Größenordnungen über dem, was ihr verbraucht.

### 1. Firebase-Projekt anlegen

1. Auf [console.firebase.google.com](https://console.firebase.google.com) mit
   dem Google-Konto anmelden, **Projekt hinzufügen**, Namen vergeben.
2. Google Analytics könnt ihr abwählen, das braucht die App nicht.

### 2. Web-App registrieren

1. Im Projekt auf das Zahnrad → **Projekteinstellungen**.
2. Unter *Meine Apps* auf das Web-Symbol `</>`, Namen vergeben, registrieren.
3. Es erscheint ein Block namens `firebaseConfig`. Die Werte daraus braucht ihr
   gleich:

   | Aus `firebaseConfig` | Gehört nach |
   |---|---|
   | `apiKey` | `VITE_FB_API_KEY` |
   | `authDomain` | `VITE_FB_AUTH_DOMAIN` |
   | `projectId` | `VITE_FB_PROJECT_ID` |
   | `appId` | `VITE_FB_APP_ID` |
   | `messagingSenderId` | `VITE_FB_MESSAGING_SENDER_ID` |

### 3. Anonyme Anmeldung aktivieren

**Authentication** → *Get started* → Reiter **Sign-in method** → **Anonymous**
→ aktivieren → speichern.

Das klingt nach mehr, als es ist: Die App fragt keine Passwörter ab. Die
anonyme Anmeldung liefert nur eine Kennung fürs Gerät, an der Firebase erkennt,
ob es zu eurem Haushalt gehört.

### 4. Datenbank anlegen

**Firestore Database** → *Datenbank erstellen* → Region `eur3 (europe-west)` →
im **Produktionsmodus** starten (die passenden Regeln kommen im nächsten Schritt).

### 5. Sicherheitsregeln veröffentlichen

Der Inhalt von [`firestore.rules`](./firestore.rules) muss in die Datenbank.
Am einfachsten von Hand: **Firestore Database** → Reiter **Regeln** → den
gesamten Inhalt der Datei hineinkopieren → **Veröffentlichen**.

> Ohne diesen Schritt lehnt Firebase jeden Zugriff ab und die App meldet
> „Zugriff verweigert".

### 6. Werte eintragen

**Für die veröffentlichte App:** im GitHub-Repository unter *Settings* →
*Secrets and variables* → *Actions* die fünf Werte aus Schritt 2 als
**Repository secrets** anlegen.

**Zum lokalen Ausprobieren:** `.env.example` nach `.env.local` kopieren und die
Werte dort eintragen.

### 7. Veröffentlichen

Im Repository unter *Settings* → *Pages* als Quelle **GitHub Actions** wählen.
Ab dann baut und veröffentlicht jeder Push auf `main` die App automatisch; die
Adresse steht anschließend im Actions-Durchlauf.

### 8. Auf dem Handy installieren

Die Adresse in **Chrome** öffnen → Menü (⋮) → **Zum Startbildschirm hinzufügen**.
Danach startet die App im Vollbild mit eigenem Icon. Auf dem iPhone geht es über
Safari → Teilen → *Zum Home-Bildschirm*.

---

## Export nach Google Notizen

Auf der Einkaufsliste gibt es den Knopf **„An Google Notizen senden"**. Er öffnet
den Teilen-Dialog von Android; dort **Keep** antippen, und die Liste liegt als
Notiz im Konto.

Warum ein Tipp mehr und nicht direkt? Weil es für private Google-Konten schlicht
**keine Keep-Schnittstelle gibt** — die offizielle API ist Firmenkonten mit
Administrator-Freigabe vorbehalten, und Google hat auch nichts anderes
angekündigt. Der Teilen-Dialog ist der einzige Weg, der ohne zusätzliche
Anmeldung zuverlässig funktioniert.

**Tipp:** Jede Zeile beginnt mit `- `. In Keep könnt ihr die Notiz deshalb über
das Dreipunkt-Menü mit **„In Liste umwandeln"** in eine Checkliste verwandeln.

Auf dem Rechner, wo es keinen Teilen-Dialog gibt, landet die Liste stattdessen in
der Zwischenablage. Dafür gibt es zusätzlich den Knopf **„Als Text kopieren"**.

---

## Für Entwickler

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Unit-Tests der Rechenlogik
npm run build      # Produktionsbau samt Service Worker
npm run typecheck  # nur die Typprüfung
```

### Aufbau

```
src/
  domain/     Reine Rechenlogik, ohne React und ohne Firebase — hier liegen die Tests
  data/       Repository-Schnittstelle plus zwei Adapter (Firestore, Speicher)
  features/   Die Reiter: recipes, plan, shopping, setup
  components/ Gemeinsame Bausteine
  lib/        Bildverkleinerung, Teilen, Wake Lock
```

Zwei Entscheidungen, die beim Weiterbauen wichtig sind:

**Die Datenschicht steckt hinter einer Schnittstelle** (`src/data/repository.ts`)
mit zwei Umsetzungen: Firestore für den echten Betrieb, eine Speicher-Ablage für
Entwicklung und Probemodus. Ein Umzug auf einen eigenen Server — Raspberry Pi
etwa — wäre ein dritter Adapter und keine Operation am offenen Herzen.

**Fotos liegen in Firestore, nicht in Firebase Storage.** Storage verlangt bei
neu angelegten Projekten ein Abrechnungskonto mit Kreditkarte, Firestore nicht.
Die Bilder werden deshalb im Browser auf 1200 Pixel verkleinert; ein winziges
Vorschaubild liegt im Rezept selbst, das Vollbild in einem Unterdokument, das
erst beim Öffnen geladen wird.

### Datenmodell

```
households/{id}                      { name, members: { uid: true } }
  ingredients/{id}                   Zutatenkatalog für Vorschläge und Zusammenfassen
  recipes/{id}                       Rezept inkl. Vorschaubild
    media/photo                      Vollbild, wird nachgeladen
  plans/{startdatum}                 Ein 12-Tage-Zeitraum
    slots/{datum_lunch|dinner}       Was an dem Tag gekocht wird
    shopping/state                   Häkchen, korrigierte Mengen, eigene Posten
```
