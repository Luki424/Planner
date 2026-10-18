# Prüfungen im Browser

Was sich nur im Browser zeigt, lässt sich nur im Browser prüfen: Tastatur auf
dem Handy, Platz in der Ablage, Fokus in einem Dialog, Kontrast einer Fläche.
Die Einheitentests (`npm test`) sehen davon nichts.

Diese Skripte liefen bisher in einem Kratzverzeichnis außerhalb des Projekts –
und waren nach einem Zurücksetzen des Containers weg, samt der Beweise, die
darin steckten. Deshalb liegen sie jetzt hier.

## Laufen lassen

Erst einen Entwicklungsserver starten:

```
npm run dev -- --port 5178
```

Dann ein Skript:

```
node pruefungen/speicher-voll.mjs
```

| Skript | prüft |
| --- | --- |
| `rundgang.mjs` | jede Ansicht und Unteransicht, zwei Handygrößen und Rechner, hell und dunkel: Überlauf, abgeschnittener oder überlaufender Text, überdeckte Knöpfe, Schrift unter 12 px, Fehler in der Konsole |
| `karten.mjs` | was der Rundgang gefunden hat, als einzelne Zusicherungen |
| `zeitachse.mjs` | dass die Zeitachse bei „jetzt" bzw. beim ersten Termin aufgeht, auch an Tagen mit Ganztägigem |
| `kalender-einlesen.mjs` | Kalender einlesen über Datei und über eingefügten Text |
| `speicher-voll.mjs` | die Warnung, wenn der Browser nichts mehr speichert |

`testdaten.mjs` hält den gemeinsamen Planer mit vollen Daten. Leere Ansichten
zeigen keine Darstellungsfehler; die meisten, die der Rundgang fand, sah man erst
mit einem Titel wie „Angebot für die Ladetechnik der Wohnmobilsparte
überarbeiten und abstimmen".

Der Rundgang prüft sich zuerst selbst: Er baut fünf Fehler absichtlich in die
Seite ein und bricht ab, wenn er einen davon nicht findet. Ein Rundgang mit
„Keine Befunde" ist nur etwas wert, wenn feststeht, dass er Befunde überhaupt
sehen kann.

Zwei Umgebungsvariablen, falls es hakt:

| | |
| --- | --- |
| `PLANER_URL` | andere Adresse als `http://localhost:5178/` |
| `PLAYWRIGHT_PACKAGE` | Pfad zum Playwright-Paket, wenn es nicht im Projekt liegt |
| `PLAYWRIGHT_CHROMIUM` | Pfad zu einem Chromium, wenn der voreingestellte fehlt |

Playwright ist **keine** Abhängigkeit des Projekts: Der Browser wiegt mehrere
hundert Megabyte, und wer den Planer nur bauen will, braucht ihn nicht. Diese
Skripte laufen deshalb auch nicht in der CI – sie laufen vor einer Änderung,
von Hand, und ihr Ergebnis steht in der Beschreibung des Pull Requests.

## Die Regel

**Jede Prüfung muss gegen den alten Stand fallen.** Eine Prüfung, die auch
ohne die Änderung grün ist, prüft nichts – sie bestätigt nur, dass das
Programm läuft. Deshalb steht in jedem Skript, welcher Fehler es ausgelöst
hat, und deshalb wird vor dem Einchecken einmal mit dem alten Code gelaufen.

Ebenso wichtig: **in beide Richtungen prüfen.** `speicher-voll.mjs` prüft
nicht nur, dass die Warnung bei vollem Speicher erscheint, sondern auch, dass
sie bei freiem Speicher *nicht* erscheint. Eine Warnung, die immer da ist, ist
keine Warnung.
