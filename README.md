# Tagesplaner

Ein Planungswerkzeug für den privaten und beruflichen Tag. Aufgaben sammeln sich in
einem Pool und werden von dort als Zeitblöcke in den Tag gezogen – so zeigt der Plan
nicht nur, *was* ansteht, sondern auch, *ob es überhaupt in den Tag passt*.

Alle Daten bleiben lokal im Browser (IndexedDB). Kein Server, kein Konto, kein Upload.

## Starten

```bash
npm install
npm run dev      # Entwicklungsserver
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal testen
```

## Was das Tool kann

**Aufgabenpool** – Aufgaben schnell erfassen, mit Bereich (Beruflich/Privat/…),
geschätzter Dauer und optionaler Fälligkeit. Der Pool zeigt alles, was noch keinen
Platz im Kalender hat.

**Tagesplan mit Time-Blocking** – Zeitachse mit Rasterung (Standard 15 Minuten).
Aufgaben werden per Drag & Drop eingeplant oder über „Einplanen" automatisch in die
nächste freie Lücke gelegt. Blöcke lassen sich verschieben und am unteren Rand in der
Dauer ziehen. Überlappende Blöcke werden nebeneinander dargestellt.

**Feste Termine** – Meetings und Verpflichtungen, die keine Aufgabe sind, per
Doppelklick auf die Zeitachse oder über „+ Fester Termin". Sie werden schraffiert
dargestellt und belegen den Tag genauso wie Aufgaben.

**Auslastung** – Die Leiste oben vergleicht die verplante Zeit mit der eingestellten
Tageskapazität und färbt sich rot, sobald du dir mehr vornimmst, als der Tag hergibt.

**Bereiche statt getrennter Welten** – Privat und Beruflich sind Farb-Tags auf einem
gemeinsamen Plan. Über die Chips in der Kopfzeile lässt sich jeder Bereich einzeln
ausblenden; Konflikte zwischen beiden Welten bleiben aber sichtbar.

**Wiederkehrende Aufgaben** – Serien mit täglichem, wöchentlichem (an bestimmten
Wochentagen) oder monatlichem Rhythmus, jeweils mit Intervall. Serien erzeugen ihre
Aufgaben erst dann, wenn der jeweilige Tag betrachtet wird – die Datenbank füllt sich
also nicht mit Jahren im Voraus. Wahlweise landen sie im Pool oder werden direkt zu
einer festen Uhrzeit eingeplant. Wird ein Serientermin gelöscht, merkt sich die Serie
das und erzeugt ihn nicht erneut.

**Wochenübersicht** – Sieben Spalten mit Auslastungsbalken je Tag. Aufgaben aus dem
Pool lassen sich direkt auf einen Tag ziehen, geplante Blöcke zwischen Tagen
verschieben.

**Übertrag** – Was gestern liegen geblieben ist, lässt sich mit einem Klick auf heute
ziehen; der Planer sucht dabei freie Lücken.

**Export/Import** – JSON-Backup in den Einstellungen, auch für den Umzug auf ein
anderes Gerät oder einen anderen Browser.

## Tastatur

| Taste | Wirkung |
| --- | --- |
| `←` / `→` | Tag bzw. Woche zurück/vor |
| `t` | zu heute springen |
| `d` / `w` | Tages- / Wochenansicht |
| `n` | neue Aufgabe |
| `?` | Kurzhilfe |

## Aufbau

```
src/
  domain/       Fachlogik ohne UI – Datumsrechnung, Wiederholungsmuster,
                Kollisions-Layout und Lückensuche
  storage/      IndexedDB-Anbindung und der zentrale Zustand (useSyncExternalStore)
  components/   Ansichten und Dialoge
```

Die Trennung ist bewusst: `domain/` und `storage/` wissen nichts von React-Rendering,
sodass sich die Terminlogik testen und später um eine Synchronisation oder einen
Kalender-Import erweitern lässt, ohne die Oberfläche anzufassen.

### Datenmodell in Kürze

- **Task** – eine Aufgabe. Existiert unabhängig davon, ob sie eingeplant ist.
- **Block** – ein Zeitfenster im Kalender. Verweist auf eine Aufgabe *oder* ist ein
  fester Termin. Eine Aufgabe darf mehrere Blöcke haben, große Vorhaben lassen sich
  also über den Tag verteilen.
- **Series** – eine Wiederholungsregel, die bei Bedarf Tasks erzeugt.
- **Context** – ein Bereich wie Beruflich oder Privat, frei anlegbar.

## Bekannte Grenzen

- Drag & Drop nutzt die HTML5-Drag-API und funktioniert damit auf Touchgeräten nicht.
  Auf dem Handy führen „Einplanen" und die Zeitfelder in den Dialogen zum selben Ziel.
- Die Daten liegen pro Browser und Gerät. Für einen echten Abgleich zwischen Geräten
  bräuchte es ein Backend – vorbereitet ist der Weg über Export/Import.
- Es gibt keine Anbindung an Outlook- oder Google-Kalender. Feste Termine werden
  derzeit von Hand erfasst.
