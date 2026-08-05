# Tagesplaner

Ein Planungswerkzeug für den privaten und beruflichen Tag, gedacht für zwei
Personen mit einem gemeinsamen Haushalt. Aufgaben sammeln sich in einem Pool und
werden von dort als Zeitblöcke in den Tag gezogen – so zeigt der Plan nicht nur,
*was* ansteht, sondern auch, *ob es überhaupt in den Tag passt*. Dazu eine
gemeinsame Einkaufsliste mit Kostenschätzung und Spracheingabe für unterwegs.

Ausgelegt auf das Handy: alle Bedienelemente sind fingertauglich, das Ziehen läuft
über Pointer-Events statt über die HTML5-Drag-API.

## Starten

```bash
npm install
npm run dev            # Entwicklungsserver
npm test               # Tests des Sprach-Parsers
npm run build          # Produktions-Build nach dist/
npm run build:single   # alles in einer einzelnen HTML-Datei
```

## Ansichten

**Tag** – Zeitachse mit 15-Minuten-Raster. Aufgaben zieht man am Griff (⠿) aus
dem Pool auf die Achse oder tippt „Einplanen", dann sucht der Planer die nächste
freie Lücke. Blöcke lassen sich verschieben und am unteren Rand in der Dauer
ziehen; überlappende Blöcke stehen nebeneinander. Feste Termine (Meetings,
Arzt) sind ein eigener Blocktyp, schraffiert dargestellt.

**Woche** – Sieben Spalten mit Auslastungsbalken je Tag, Blöcke per Ziehen
zwischen Tagen verschiebbar.

**Einkauf** – Positionen mit Menge, Einheit und geschätztem Preis. Oben steht die
Summe der offenen Positionen, daneben wie viele noch keinen Preis haben.
Abgehaktes wandert in den Bereich „Im Wagen", damit im Laden sichtbar bleibt, was
schon eingesammelt ist und was das bisher kostet.

**Serien** – Wiederkehrende Aufgaben: täglich, wöchentlich an bestimmten
Wochentagen oder monatlich, jeweils mit Intervall („alle zwei Wochen"). Serien
erzeugen ihre Aufgaben erst, wenn der jeweilige Tag betrachtet wird. Ein
gelöschter Serientermin kommt nicht wieder.

**Mehr** – Bereiche, Tageszeiten, Kapazität, geteilte Nutzung, Export/Import.

## Spracheingabe

Das Mikrofon steht in der Tages- und in der Einkaufsansicht. Verstanden wird
unter anderem:

| Gesprochen | Ergebnis |
| --- | --- |
| „morgen um 15 Uhr Zahnarzt" | Termin am Folgetag, 15:00–16:00 |
| „am Freitag halb drei Meeting für 2 Stunden" | Termin Freitag 14:30–16:30 |
| „übermorgen viertel nach acht Werkstatt" | Termin, 08:15 |
| „Rasen mähen 2 Stunden" | Aufgabe im Pool mit Schätzung |
| „zwei Liter Milch und Brot für drei Euro" | zwei Positionen, eine mit 3,00 € |
| „500 Gramm Mehl" | Position mit Menge und Einheit |

Erkannt werden Zahlwörter („drei Äpfel"), Uhrzeitangaben wie „halb drei" oder
„dreiviertel vier", Datumsangaben („am 12. September", „nächsten Montag") und
Preise in mehreren Schreibweisen („für 1,50", „2 Euro 50", „vier Euro").
Nachmittagsstunden werden sinnvoll gedeutet: „um 3" ergibt 15:00, „um 9" ergibt
9:00.

Die Erkennung ist regelbasiert und läuft ohne KI-Dienst. **Nichts wird ungeprüft
übernommen** – was verstanden wurde, erscheint erst zur Bestätigung. Grundlage ist
die Web Speech API: sie funktioniert in Chrome, Edge und Safari, in Firefox
nicht. Dort bleibt die Tastatureingabe.

## Gemeinsame Nutzung

Ohne weitere Einrichtung bleiben alle Daten im Browser des jeweiligen Geräts.
Für die geteilte Nutzung zu zweit gibt es eine Anbindung an Firebase:
[**FIREBASE.md**](./FIREBASE.md) beschreibt die Einrichtung Schritt für Schritt
(etwa 15 Minuten, kostenlos).

Kurzfassung: Firebase-Projekt anlegen, E-Mail-Anmeldung aktivieren, Firestore
anlegen, die Regeln aus [`firestore.rules`](./firestore.rules) einspielen,
Konfiguration in den Einstellungen einfügen. Danach legt eine Person einen
Haushalt an und gibt den Code weiter; die andere tritt damit bei.

Jeder Eintrag ist ein eigenes Dokument, deshalb kommen sich zwei Personen bei
gleichzeitigen Änderungen nicht in die Quere. Firestore puffert offline – im
Laden ohne Empfang lässt sich weiter abhaken.

## Veröffentlichen

Der Workflow in `.github/workflows/deploy.yml` prüft bei jedem Pull Request und
veröffentlicht bei jedem Push auf `main`. Linter, Tests und Typprüfung laufen
vor dem Bauen; schlägt eines fehl, wird nicht veröffentlicht.

### Einmalig einzurichten

Beides muss von Hand gesetzt werden – ein Workflow kann sich diese Rechte nicht
selbst geben. Zu jedem Punkt steht die Fehlermeldung, an der man ihn erkennt.

**1. Quelle auf GitHub Actions stellen** — *Settings → Pages → Source*.

Ohne diesen Schritt bricht der Lauf im Schritt `configure-pages` ab:

```
Create Pages site failed.
Error: Resource not accessible by integration
```

Eine Pages-Seite anzulegen ist eine Administrator-Aktion am Repository; das
Standard-Token eines Workflows darf das nicht.

**2. `main` als erlaubten Zweig eintragen** — *Settings → Environments →
github-pages → Deployment branches and tags*.

Steht dort ein anderer Zweig – etwa der, auf dem gerade entwickelt wurde, als
Pages eingeschaltet wurde –, wird der Job *Veröffentlichen* abgewiesen, **bevor**
er einen Runner bekommt. Erkennbar daran, dass er nach ein bis zwei Sekunden
ohne jedes Log fehlschlägt; der Grund steht nur unter *Annotations*:

```
Branch "main" is not allowed to deploy to github-pages
due to environment protection rules.
```

Auf dem Handy lohnt sich „Zum Startbildschirm hinzufügen" – über das Manifest
startet die App dann ohne Browserleiste.

## Tastatur

| Taste | Wirkung |
| --- | --- |
| `←` / `→` | Tag bzw. Woche zurück/vor |
| `t` | zu heute springen |
| `d` / `w` / `e` | Tag / Woche / Einkauf |
| `n` | neue Aufgabe |
| `?` | Kurzhilfe |

## Aufbau

```
src/
  domain/       Fachlogik ohne UI – Datumsrechnung, Wiederholungsmuster,
                Kollisions-Layout, Lückensuche, Sprach-Deutung
  storage/      lokale Ablage (IndexedDB) und der zentrale Zustand
  sync/         Firebase-Anbindung: Anmeldung, Haushalt, Abgleich
  hooks/        Ziehen und Ablegen, Spracherkennung, Medienabfragen
  components/   Ansichten und Dialoge
firestore.rules Sicherheitsregeln der geteilten Datenbank
```

`domain/` und `storage/` wissen nichts von React. Der Abgleich mit Firebase
vergleicht zwei Zustände und schreibt nur, was sich geändert hat – die
Bedienlogik musste dafür nicht angefasst werden.

### Datenmodell

- **Task** – eine Aufgabe, unabhängig davon ob eingeplant.
- **Block** – ein Zeitfenster. Verweist auf eine Aufgabe *oder* ist ein fester
  Termin. Eine Aufgabe darf mehrere Blöcke haben.
- **Series** – eine Wiederholungsregel, die bei Bedarf Aufgaben erzeugt.
- **ShoppingItem** – Einkaufsposition; Preise als ganze Cent, damit sich
  Rundungsfehler nicht aufsummieren.
- **Context** – ein Bereich wie Beruflich oder Privat.

## Entwicklung gegen die Emulatoren

Sync und Sicherheitsregeln lassen sich lokal prüfen, ohne ein echtes Projekt:

```bash
npx firebase emulators:start --only auth,firestore --project tagesplaner-dev
VITE_FIREBASE_EMULATOR=127.0.0.1 npm run dev
```

In den Einstellungen genügen dann Platzhalterwerte (`apiKey: demo-key`,
`projectId: tagesplaner-dev`).

## Bekannte Grenzen

- **Firefox kennt keine Spracherkennung.** Alles andere funktioniert dort.
- **Kein Service Worker.** Daten sind offline verfügbar, die App selbst muss
  aber einmal geladen werden. Ganz ohne Netz startet sie nur, wenn sie noch im
  Browser-Cache liegt.
- **Der Haushalts-Code ist das Geheimnis.** Wer ihn kennt, kann beitreten. Er
  lässt sich nicht ändern – notfalls einen neuen Haushalt anlegen.
- **Bündelgröße** rund 860 kB (255 kB komprimiert), überwiegend Firebase. Nach
  dem ersten Besuch liegt alles im Cache.
- **Keine Anbindung an Outlook oder Google Kalender.** Feste Termine werden von
  Hand oder per Sprache erfasst.
