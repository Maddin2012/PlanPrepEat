# PlanPrepEat

Eine App für zwei: Rezepte sammeln, die nächsten Tage vorausplanen — und die
Einkaufsliste entsteht dabei von selbst. Gebaut als **PWA**, also als Web-App,
die ihr euch auf den Startbildschirm legt und die sich danach wie eine normale
App verhält: eigenes Icon, Vollbild, funktioniert auch ohne Netz.

## Die drei Reiter

**Essensplan.** Für jeden Tag Mittag und Abend. Ein Platz fasst mehrere Rezepte —
Hauptgericht und Beilage sind schließlich zwei. Was kein Rezept hat, lässt sich
unten im Blatt als freier Text eintragen: „Pizza bestellen", „Reste", „bei Oma".
Solche Einträge stehen im Plan, kommen aber nicht auf die Einkaufsliste — dafür
fehlen ihnen die Zutaten.

**Rezeptbuch.** Rezepte mit Zutaten (Gramm, Milliliter, Stück, EL, TL …), Foto,
Zubereitungszeit und Zubereitungsschritten. Sie stehen als **Kacheln** zu zweit
nebeneinander, das Foto oben — ein Rezeptbuch schlägt man nach Bildern auf, nicht
nach Namen. Rezepte ohne Foto bekommen dieselbe Fläche mit einem Buchzeichen
darin, damit die Kacheln nicht ausfransen. Die Schritte lassen sich am
Anfasser links untereinander verschieben, wenn die Reihenfolge nicht stimmt. Jedes Rezept gilt für eine bestimmte
Portionszahl; in der Rezeptansicht könnt ihr hoch- und runterrechnen, ohne das
Rezept zu ändern. Die Suche findet Rezepte über ihren Namen und über die Zutaten.

Das Foto könnt ihr **direkt aufnehmen** oder **aus der Galerie** wählen — beides
steht als eigener Knopf im Formular. Die App rechnet das Bild danach klein, und
hochkant aufgenommene Fotos stehen richtig herum.

**Diktieren.** Neben Name, Zutaten und Zubereitung sitzt je ein Mikrofonknopf.
Antippen, sprechen, unten auf „Fertig" — jede Sprechpause wird eine neue
Zutatenzeile beziehungsweise ein neuer Schritt. Mengen und Einheiten erkennt die
App dabei mit: aus „fünfhundert Gramm Mehl" wird die Zeile *Mehl · 500 · g*, aus
„drei Eier" *Eier · 3 · Stück*, aus „eine Prise Salz" *Salz · 1 · Prise*. Was sie
nicht versteht, landet vollständig im Namensfeld — sichtbar und mit zwei
Handgriffen richtiggestellt.

Die Tastatur bleibt davon unberührt; tippen könnt ihr weiterhin überall, auch mit
der Mikrofontaste eurer eigenen Tastatur. Das Diktat läuft über die
Spracherkennung des Browsers, kostet also nichts, **braucht aber Internet** —
Chrome verarbeitet den Ton auf Googles Servern. Browser ohne diese Schnittstelle
(Firefox) zeigen den Knopf gar nicht erst an.

**Essensplan.** Ein fortlaufender Kalender, je Tag eine Spalte für Mittagessen
und eine für Abendbrot. Im Blick sind 12 Tage: heute, die drei Tage davor und
acht voraus. Die vergangenen Tage sind mit Absicht dabei — lief ein Tag anders
als gedacht, schiebt ihr das Gericht von dort einfach weiter. Gescrollt wird in
beide Richtungen — geladen sind ein Monat zurück und vier voraus, und wer noch
weiter will, tippt am Ende auf „30 Tage früher" bzw. „30 Tage später". Der Knopf
„Heute" oben rechts holt euch jederzeit zurück.
Ein Tippen auf ein Feld öffnet die Rezeptauswahl, danach stellt ihr die Portionen
ein. Auf ein Feld passen auch mehrere Rezepte, für Hauptgericht plus Beilage.

**Einkaufsliste.** Ergibt sich automatisch aus den Rezepten der 12 Tage um heute
herum, zusammengefasst und zunächst alphabetisch sortiert. Zweimal 200 g Zwiebeln
werden zu 400 g, ein halber Liter Milch und 250 ml addieren sich zu 750 ml.
Ihr könnt abhaken, Posten streichen („hab ich noch da") und am Griff rechts alles
in eure Ladenreihenfolge ziehen — die merkt sich die App dann dauerhaft.
Abgehaktes rutscht durchgestrichen unter „Erledigt".

Eigene Sachen wie Klopapier kommen über die Zeile **„+ Listeneintrag"** unter der
Liste dazu, so wie in Google Notizen: antippen, Namen schreiben, Enter — und die
nächste Zeile steht schon bereit. Das **X** am Ende der Zeile wirft sie wieder
weg. Menge, Einheit und Name ändert ihr, indem ihr rechts in der Zeile auf die
Mengenangabe tippt; dort korrigiert ihr auch die aus den Rezepten berechneten
Mengen, ohne dass sich am Rezept etwas ändert.

Sobald ihr einen eigenen Posten anlegt oder etwas verschiebt, steht die Liste in
eurer Reihenfolge statt alphabetisch. Später über neue Rezepte dazukommende
Zutaten hängen sich hinten an.

Die Liste hängt fest an heute: Sie folgt dem Kalender nicht, wenn ihr dort weit
vorblättert. Wer im Supermarkt steht, will nicht plötzlich die Zutaten vom
nächsten Monat vor sich haben.

**Wichtig dabei:** Ändert ihr den Essensplan, wächst die Liste einfach mit.
Gesetzte Häkchen, korrigierte Mengen und eigene Posten bleiben dabei erhalten —
die Liste selbst wird nämlich nirgends gespeichert, nur das, was ihr daran
verändert habt.

## Updates

Die App meldet sich, wenn eine neue Fassung bereitliegt: Oben in der Kopfzeile
erscheint ein Pfeil mit einem Punkt. Ein Tipp darauf führt in die Einstellungen,
wo **Jetzt aktualisieren** steht. Dort lässt sich auch von Hand nachsehen.

Darunter steht in einfachen Worten, was sich geändert hat — mit einer Marke
dabei, ob es eine Fehlerbehebung, etwas Neues oder eine Verbesserung war. Liegt
ein Update bereit, zeigt die App vorher, was darin steckt: Sie ruft dafür die
Notizen der neuen Fassung ab. Ist der Server nicht erreichbar, fehlt nur dieser
Text — aktualisieren lässt sich trotzdem.

Wer den Knopf nie drückt, verliert nichts: Ein wartendes Update wird auch dann
eingespielt, sobald die App einmal ganz geschlossen war. Der Knopf erspart nur
das Schließen und Wiederöffnen.

**Die Notizen pflegen:** Sie stehen in `src/data/changelog.json`, neueste zuerst,
mit `datum`, `art` (`fehler` | `neu` | `besser`) und `text`. Beim Bauen legt
`vite.config.ts` dieselbe Datei zusätzlich neben die App, damit eine laufende
Fassung die Notizen der neueren lesen kann. Eine Quelle, zwei Wege dorthin.

## Fotos

Nach dem Aufnehmen oder Auswählen kommt ein Bildschirm mit einem festen Rahmen
im Verhältnis 4:3. Das Bild lässt sich darin schieben und über den Regler
größer ziehen; Drittel-Linien zeigen, was drinbleibt. **Genau dieser Ausschnitt
wird gespeichert** — Rezeptliste, Vorschau und Rezeptseite zeigen danach
dasselbe.

Vorher hat die App gar nichts abgeschnitten. Beschnitten wurde erst beim
Anzeigen, und zwar in jeder der drei Ansichten anders.

**Fotos aus der Zeit davor** sind nicht 4:3 und werden weiterhin mittig
beschnitten. Wer eines davon anders haben will, öffnet das Rezept und wählt das
Bild neu.

## Was man mit einem Rezept machen kann

**Einplanen** geht direkt aus dem Rezeptbuch: Oben rechts auf jeder Kachel sitzt
ein Pluszeichen. Ein Tipp darauf zeigt die nächsten zwei Wochen, je Mittag und
Abend; noch ein Tipp, und das Rezept steht im Plan. Liegt auf dem Platz schon
etwas, kommt es dazu statt es zu ersetzen — die Zahl in Klammern sagt, wie viel
dort schon liegt. Angelegt wird es mit der Portionszahl des Rezepts; ändern
lässt sie sich danach im Plan am Eintrag.

Das Rezept dafür zu öffnen ist nicht nötig — wer den Plan füllt, geht die Liste
durch. Unter dem Bild im Rezept stehen deshalb nur zwei Knöpfe:

- **Kopieren** — legt ein neues Rezept mit denselben Zutaten und Schritten an,
  benannt mit „(Kopie)". Für „Nudeln mit Tomatensoße" → „… und Jägerschnitzel"
  muss man dann nur noch ergänzen. Ohne Foto: Das gehört zum alten Gericht.
- **Teilen** — schickt das Rezept als lesbaren Text, über WhatsApp, Mail oder
  was sonst da ist. Wer die App nicht hat, kann es trotzdem lesen und nachkochen.

**Ein geteiltes Rezept übernehmen:** Beim Anlegen eines neuen Rezepts sitzt oben
rechts ein Klemmbrett-Zeichen. Text hineinkopieren, *Übernehmen* — es landet im
Formular, wo man es vor dem Speichern noch ändern kann. Es ist dasselbe Format
wie in der Sicherung; ein Rezept lässt sich also auch von dort herauskopieren.

## Vorlesen beim Kochen

Über den Zubereitungsschritten steht **Vorlesen**. Die App liest den ersten
Schritt vor, geht danach von selbst zum nächsten und hebt jeweils den hervor,
der gerade dran ist; er rückt auch von selbst ins Bild. Unten sitzt eine Leiste
mit vier Knöpfen: einen Schritt zurück, anhalten, einen Schritt weiter, Schluss.

Nach dem Anhalten geht es am **Anfang** des Schritts weiter, nicht mitten im
Satz. Das ist Absicht: Mitten im Satz weiterzumachen klappt nicht auf allen
Geräten verlässlich, und beim Kochen ist der ganze Schritt ohnehin das, was man
noch einmal hören will.

Vorgelesen wird, was dasteht — nur die Kürzel werden ausgesprochen statt
buchstabiert: aus „2 EL" wird „zwei Esslöffel", aus „180 °C" werden „180 Grad".
Der Text auf dem Bildschirm bleibt unverändert.

Hat das Gerät keine deutsche Stimme, erscheint der Knopf gar nicht — eine
englische Stimme, die „Zwiebeln würfeln" vorträgt, hilft niemandem. Den
Bildschirm lässt die App weiterhin nicht an.

## Diktieren

Zwei Sorten Mikrofon, und der Unterschied ist wichtig:

- **Oben neben „Zutaten" bzw. „Zubereitung"** — es *legt an*. Jede Sprechpause
  wird eine neue Zutat bzw. ein neuer Schritt. Es hört zu, bis man „Fertig"
  drückt. Gut, wenn man ein Rezept am Stück herunterspricht.
- **Klein in der Zeile** — es *füllt genau diese Zeile* und schaltet sich nach
  einem Satz von selbst ab. Gut, wenn man zwischendurch überlegen muss: Es läuft
  nicht mit, während man nachdenkt.

Bei einer Zutat wird in beiden Fällen mitzerlegt: „300 Gramm Nudeln" setzt Name,
Menge und Einheit — und „Nudeln 300 Gramm" genauso, die Wortstellung ist egal. Bei einem Schritt hängt das kleine Mikrofon an, was schon
dasteht — Getipptes geht also nicht verloren.

Wo der Browser keine Spracherkennung hat (Firefox etwa), erscheint gar kein
Mikrofon, statt beim Antippen ins Leere zu laufen.

**Eigene Wörter.** Die Erkennung selbst lässt sich nicht trainieren — sie kommt
von Google und nimmt keine eigenen Wörter an. Dahinter sitzt aber eine
Austauschliste: Verbesserst du einen gerade diktierten Zutatennamen von Hand,
merkt sich die App das Paar („Fatham" → „Feta") und setzt beim nächsten Mal
gleich das Richtige ein. Unter *Einstellungen → Eigene Wörter* steht die Liste
zum Nachsehen, Löschen und Ergänzen. Sie gilt je Gerät.

## Zu zweit benutzen

Beide Geräte gehören zum selben **Haushalt**. Wer ihn anlegt, findet unter
*Einstellungen* einen Code wie `ABCD-EFGH-JKMN-PQRS`.

Der bequeme Weg ist der Knopf **Teilen**: Er verschickt eine Nachricht mit einem
Einladungslink. Die zweite Person tippt ihn im Messenger an, PlanPrepEat geht
auf, der Code steht schon drin — ein Tipp auf „Beitreten", fertig. Der Code
steht in derselben Nachricht noch einmal als Textzeile, falls der Link unterwegs
abgeschnitten wird; dann tippt man ihn beim ersten Start unter „Einem Haushalt
beitreten" von Hand ein.

Ab da sehen beide dieselben Rezepte, denselben Plan und dieselbe Einkaufsliste,
und Änderungen erscheinen innerhalb von Sekunden auf dem anderen Gerät.

Wer den Code **oder den Link** hat, kann alles sehen und ändern — der Link *ist*
der Code. Gebt beides nur weiter, wenn das so gewollt ist.

## Sicherung

Unter *Einstellungen → Sicherung* lädt ein Knopf alle Rezepte als Textdatei
herunter — nach Namen sortiert, mit Portionen, Zeit, Zutaten und Zubereitung.
Die Datei heißt `PlanPrepEat-Rezepte-2026-08-25.txt` und landet in *Downloads*.

Zwei Grenzen, die man kennen sollte:

- **Ohne Fotos.** Ein Vollbild wiegt bis zu 0,7 MB, ein Rezept als Text ein bis
  zwei Kilobyte. Mit Bildern wäre die Datei auf dem Handy unhandlich.
- **Sie lässt sich nicht wieder einlesen.** Sie ist zum Nachlesen da: Geht ein
  Rezept verloren, öffnest du die Datei und tippst es neu ein.

Das ist bewusst so gewählt. Ein Firestore-Export über die Google-Cloud-Werkzeuge
wäre der andere Weg, verlangt aber ein Abrechnungskonto mit Kreditkarte — genau
dem sind wir schon bei den Fotos ausgewichen.

Es gibt sonst **keine** Sicherung: kein Papierkorb, kein Verlauf früherer
Fassungen. Wer ein Rezept überschreibt und speichert, verliert die alte Version.
Ab und zu auf den Knopf drücken ist deshalb keine schlechte Angewohnheit.

## Die Einkaufsliste in Ladenreihenfolge

Am Anfasser links lassen sich die Posten verschieben. Diese Reihenfolge wird
**dauerhaft gemerkt** — je Zutat, nicht je Listeneintrag. Wer die Tomaten einmal
nach vorn geschoben hat, findet sie dort auch in den Wochen darauf wieder, ganz
gleich aus welchem Rezept sie diesmal kommen und in welcher Einheit.

Es gibt nichts einzurichten: Die Liste lernt beim Benutzen. Zutaten, die noch nie
einsortiert wurden, hängen alphabetisch hinten an, bis man sie einmal an ihren
Platz schiebt. Abgehaktes rutscht weiterhin ans Ende, unabhängig von der Runde.

Unter *Einstellungen → Ladenreihenfolge* steht, wie viele Zutaten einen festen
Platz haben, und dort lässt sich die Runde auch zurücksetzen — sinnvoll beim
Wechsel des Ladens oder nach einem Umbau.

## Ohne Netz

Die App funktioniert offline weiter — im Supermarkt der entscheidende Teil.
Abgehakte Posten werden lokal gespeichert und übertragen sich automatisch,
sobald wieder Empfang da ist.

## Hell oder dunkel

**Dunkel ist die Hauptfassung**, hell die Option. Umgeschaltet wird unter
*Einstellungen → Darstellung*; die Wahl gilt **nur für dieses Gerät** — der eine
kann hell haben, während die andere dunkel hat.

Bewusst folgt die App **nicht** der Systemeinstellung: Wer das Handy abends
automatisch dunkel schaltet, will deswegen nicht zwingend eine dunkle
Einkaufsliste.

Für Entwickler zwei Stellen, die zusammengehören: Dunkel ist auch im CSS der
Grundzustand (`src/index.css`), hell steht unter `:root[data-theme='light']`.
Das ist Absicht — schlägt der Speicherzugriff fehl oder läuft das kurze Skript
im Kopf von `index.html` nicht, gilt der Grundzustand, und dann soll es dunkel
bleiben statt hell aufzublitzen.

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

> **Secrets allein bewirken nichts.** Die Werte werden beim *Bauen* ins
> JavaScript eingesetzt. Solange kein neuer Durchlauf gelaufen ist, läuft die
> veröffentlichte App unverändert ohne Zugangsdaten weiter — und man sucht den
> Fehler im Firebase-Projekt, wo keiner ist. Also nach dem Anlegen der Secrets:
> *Actions* → **Bauen und veröffentlichen** → **Run workflow**.

### Wo hängt es? Die Zeile *Abgleich* sagt es

In der App unter *Einstellungen → Verbindung*:

| Abgleich zeigt | heißt |
| --- | --- |
| `nicht eingerichtet` | Zugangsdaten fehlen in diesem Bau. Darunter steht, welche Secrets fehlen — und ob nur der neue Durchlauf aussteht. |
| `aus (nur dieses Gerät)` | Zugangsdaten sind da, aber du bist im Probemodus. Abmelden und einen Haushalt anlegen oder beitreten. |
| `an` | Verbunden, es wird abgeglichen. |

Darüber steht die Zeile **Stand** mit Baudatum und Commit-Kürzel — daran siehst
du, ob die installierte App den neuen Bau überhaupt schon geladen hat.

### 7. Veröffentlichen

Im Repository unter *Settings* → *Pages* als Quelle **GitHub Actions** wählen.
Ab dann baut und veröffentlicht jeder Push auf `main` die App automatisch; die
Adresse steht anschließend im Actions-Durchlauf.

### 8. Auf dem Handy installieren

Die Adresse in **Chrome** öffnen → Menü (⋮) → **Zum Startbildschirm hinzufügen**.
Danach startet die App im Vollbild mit eigenem Icon. Auf dem iPhone geht es über
Safari → Teilen → *Zum Home-Bildschirm*.

**Nach einer Änderung:** Die installierte App behält ihren letzten Stand, bis sie
einmal ganz geschlossen (aus der App-Übersicht wischen) und neu geöffnet wird.
Welcher Bau gerade läuft, steht in den **Einstellungen** unter *Verbindung* in der
Zeile **Stand** — Baudatum und Commit-Kürzel. Damit lässt sich ohne Raten klären,
ob eine Änderung überhaupt auf dem Gerät angekommen ist.

---

## Export nach Google Notizen

Oben rechts auf der Einkaufsliste sitzt das **Teilen-Symbol**. Es öffnet
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
der Zwischenablage — derselbe Knopf, er merkt das von selbst.

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
  lib/        Bildverkleinerung, Teilen, Spracherkennung, Hell/Dunkel
scripts/
  icons.mjs   Zeichnet das App-Symbol und rendert public/icon-*.png
```

Zwei Entscheidungen, die beim Weiterbauen wichtig sind:

**Die Datenschicht steckt hinter einer Schnittstelle** (`src/data/repository.ts`)
mit zwei Umsetzungen: Firestore für den echten Betrieb, eine Speicher-Ablage für
Entwicklung und Probemodus. Ein Umzug auf einen eigenen Server — Raspberry Pi
etwa — wäre ein dritter Adapter und keine Operation am offenen Herzen.

**Farben laufen über Rollen, nicht über Paletten** (`src/index.css`). In den
Bauteilen steht `bg-accent` oder `bg-surface` — nie `bg-brand-600` oder
`bg-white`. Nur die Rollen werden unter `:root[data-theme='dark']` umdefiniert;
wer sich direkt an einen Palettenwert hängt, bleibt im Dunkelmodus stehen. Drei
Rollen drehen sich absichtlich nicht um (`scrim`, `overlay`, `on-overlay`) —
Meldebalken sollen in beiden Fassungen dunkel bleiben.

**Das App-Symbol ist erzeugt, nicht gemalt.** Die Quelle liegt in
`scripts/icons.mjs`; `node scripts/icons.mjs` schreibt `favicon.svg`,
`icon-192.png`, `icon-512.png` und `icon-maskable.png` nach `public/`. Mit
`--hell` entsteht die helle Kachel statt der dunklen. Playwright ist dafür nötig,
aber absichtlich keine deklarierte Abhängigkeit — bauen und testen geht ohne.

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
  slots/{datum_lunch|dinner}         Was an dem Tag gekocht wird
  shopping/state                     Häkchen, Mengen, eigene Posten, Reihenfolge
```
