# Tagesplaner

Ein Planungswerkzeug für den privaten und beruflichen Tag, gedacht für zwei
Personen mit einem gemeinsamen Haushalt. Aufgaben sammeln sich in einem Pool und
werden von dort als Zeitblöcke in den Tag gezogen – so zeigt der Plan nicht nur,
*was* ansteht, sondern auch, *ob es überhaupt in den Tag passt*. Dazu eine
gemeinsame Einkaufsliste mit Kostenschätzung und Spracheingabe für unterwegs.

Ausgelegt auf das Handy: alle Bedienelemente sind fingertauglich, das Ziehen läuft
über Pointer-Events statt über die HTML5-Drag-API.

Die Farbwelt ist aus einem Foto abgeleitet – Laubgrün im Schatten, warmes
Sonnenlicht, heller Kiesweg. Die Neutraltöne sind deshalb warm statt blaugrau,
und der Akzent ist ein gedämpftes Grün, das sich weder mit den Signalfarben noch
mit den Bereichsfarben verwechseln lässt.

## Starten

```bash
npm install
npm run dev            # Entwicklungsserver
npm test               # Einheitentests (Sprache, Preise, Feiertage, Urlaub,
                       #                 Kalender, Essen, Kasse, Erscheinungsbild)
npm run build          # Produktions-Build nach dist/
npm run build:single   # alles in einer einzelnen HTML-Datei
```

## Ansichten

**Tag** – Zeitachse mit 15-Minuten-Raster. Aufgaben zieht man am Griff (⠿) aus
dem Pool auf die Achse oder tippt „Einplanen", dann sucht der Planer die nächste
freie Lücke. Blöcke lassen sich verschieben und am unteren Rand in der Dauer
ziehen; überlappende Blöcke stehen nebeneinander. Feste Termine (Meetings,
Arzt) sind ein eigener Blocktyp, schraffiert dargestellt. Ganztägiges steht in
einem Streifen über der Achse, siehe unten.

**Woche** – Zwei Karteikarten. *Woche* zeigt sieben Spalten mit
Auslastungsbalken je Tag, Blöcke per Ziehen zwischen Tagen verschiebbar. Am
Handy stehen die Tage untereinander, Titel und Uhrzeit größer als in den
schmalen Spalten am Bildschirm; ein Tag ohne Termine bleibt flach, statt eine
volle Karte für das Wort „frei" zu verbrauchen. Sind Personen angelegt, zeigt jeder
Tageskopf die Auslastung je Person statt einer Gesamtsumme. *Monat* siehe
unten – beides in einem Reiter, weil es dieselbe Frage in zwei Auflösungen
ist.

**Einkauf** – Positionen mit Menge, Einheit und geschätztem Preis. Oben steht die
Summe der offenen Positionen, daneben wie viele noch keinen Preis haben.
Abgehaktes wandert in den Bereich „Im Wagen", damit im Laden sichtbar bleibt, was
schon eingesammelt ist und was das bisher kostet.

Die Liste merkt sich Preise: Wer „Milch" tippt, bekommt den zuletzt bezahlten
Preis vorgeschlagen und übernimmt ihn, ohne ihn erneut einzugeben. Vorschläge
zeigen verwandte Artikel samt Preis; was schon offen auf der Liste steht, wird
nicht erneut angeboten. Das Gedächtnis überlebt das Aufräumen nach dem Einkauf
und gilt für beide im Haushalt – wer den Preis einmal einträgt, hat ihn für
beide hinterlegt.

**Urlaub** – Urlaubskonto und Reiseplanung, siehe unten.

**Liste** – Zwei Karteikarten. *Zu erledigen* ist die Aufgabenliste ohne
Zeitachse: eintippen, abhaken, in Listen sortieren. *Wiederkehrend* führt die
Serien – täglich, wöchentlich an bestimmten Wochentagen oder monatlich, jeweils
mit Intervall („alle zwei Wochen"). Serien erzeugen ihre Aufgaben erst, wenn der
jeweilige Tag betrachtet wird; ein gelöschter Serientermin kommt nicht wieder.
Beides in einer Ansicht, weil eine Serie nichts anderes ist als eine Aufgabe,
die wiederkommt.

**Mehr** – Personen, Bereiche, Tageszeiten, Kapazität, geteilte Nutzung,
Export/Import.

## Zu erledigen

Die Aufgabenliste zeigt **dieselben Aufgaben wie der Pool** neben dem
Tagesplan, nur in voller Breite und ohne Zeitachse daneben. Bewusst keine
zweite Sammlung: Es soll genau einen Ort geben, an dem eine Aufgabe steht.
Wer eine Erledigung doch einplanen will, tippt *Einplanen* oder zieht sie am
Griff in den Tag – neu eintippen muss man nichts.

Eingetippt wird ohne alles: kein Datum, keine Dauer. Ein Datum ist eine
Aussage über Dringlichkeit, sein Fehlen keine – deshalb steht Undatiertes
unten, nicht hinten.

| Fall | Verhalten |
| --- | --- |
| Listen („Haus", „Garten") | freiwillige Gruppierung; die Bereiche daneben sagen weiterhin, ob etwas beruflich oder privat ist |
| Heute oder früher fällig | steht in einem eigenen Block ganz oben – und dann **nicht** noch einmal in seiner Gruppe |
| Überfällig | rot umrandet |
| Erledigtes | verschwindet; ein Häkchen blendet es wieder ein, zuletzt Abgehaktes zuerst |
| Leere Liste | bleibt sichtbar, damit klar ist, wohin das Nächste gehört |
| Liste gelöscht | ihre Aufgaben bleiben und stehen dann ohne Liste |
| Eingeplante Aufgabe | steht im Tagesplan, nicht mehr auf der Liste – sonst hakte man sie zweimal ab |

Am Handy fehlt die Listenauswahl in der Zeile; dort ändert man sie über den
Aufgabendialog.

## Monat

Die Wochenansicht beantwortet „was steht diese Woche an", der Monat
beantwortet „wann haben wir mal nichts vor". Deshalb steht hier die Dichte im
Vordergrund und nicht der einzelne Termin.

| Fall | Verhalten |
| --- | --- |
| Raster | immer volle Wochen ab Montag; der Rand ragt in die Nachbarmonate und ist abgeblendet |
| Zeilen | vier bis sechs, je nach Monat – ein Februar, der montags beginnt, kommt mit vier aus |
| Blättern | ‹ und › springen einen Monat, `←`/`→` ebenso |
| 31. Januar plus ein Monat | wird auf den 28. Februar gekappt, nicht auf den 3. März |
| Feld | Tagesziffer, Feiertag, Jahrestagssymbol, Abwesenheiten, bis zu vier Einträge, Auslastungsbalken |
| Mehr als vier | „+3" am Ende des Feldes |
| Ganztägiges | steht vor den Uhrzeiten und ausgefüllt statt nur farbig umrandet |
| Klick auf einen Tag | öffnet ihn in der Tagesansicht |
| Am Handy | ein Feld ist rund 50 px breit; statt Text bleibt je Eintrag ein farbiger Strich |

Der Aufgabenpool steht in der Monatsansicht nicht daneben: dort geht es ums
Überblicken, nicht ums Verteilen, und das Raster kann die Breite gebrauchen.

Das Gekappte beim Blättern ist Absicht. Naiv gerechnet wäre der 31. Januar
plus ein Monat der 3. März – man überspränge den Februar. Der Preis dafür:
vom gekappten 28. Februar aus weiterzublättern führt auf den 28. März, nicht
zurück auf den 31.

## Ganztägig

Fortbildung, Umzug, Kita geschlossen: Dinge, die keine Uhrzeit haben, sondern
den Tag. In der Dauerauswahl steht dafür **ganztägig** – im Pool, im
Aufgabendialog und bei den Serien; feste Termine haben ein eigenes Häkchen.

| Fall | Verhalten |
| --- | --- |
| Anzeige | in einem Streifen **über** der Zeitachse, nicht auf ihr |
| Auslastung | zählt als voller Tag – sonst sähe der Tag leer aus, obwohl nichts mehr hineinpasst |
| Freie Lücke suchen | wird übersprungen; Ganztägiges belegt keine Uhrzeit |
| Woche | eigenes Band über den Zeitblöcken |
| Auf die Achse gezogen | wird dadurch zu einem Termin mit Uhrzeit |
| Zurückgeschaltet | bekommt 09:00–10:00 als Vorgabe, nicht 00:00–00:00 |
| Kalenderausgabe | geht als `DTSTART;VALUE=DATE` hinaus, ohne Uhrzeit und Zeitzone |
| Kalendereinlesen | landet im Streifen; mehrtägiges bekommt je Tag einen Eintrag |

Ganztägig ist ein eigenes Feld, kein Sonderwert in der Dauer – sonst rechnete
früher oder später jemand mit der Zahl weiter. Die gewählte Dauer bleibt dabei
stehen: schaltet man zurück, steht wieder da, was vorher gewählt war.

Bis dahin wurden ganztägige Termine aus einer Kalenderdatei zu Aufgaben mit
Fälligkeit – ein Notbehelf, solange es nichts Ganztägiges gab.

## Geburtstage und Jahrestage

Unter **Mehr** stehen die Daten, die sich jedes Jahr wiederholen: Geburtstage,
der Hochzeitstag, der TÜV. Sie sind bewusst **keine Serien**. Eine Serie
erzeugt Aufgaben – mit Dauer, Häkchen und Platz im Aufgabenpool. Ein Geburtstag
ist aber nichts, was man erledigt; er wird angekündigt, nicht abgehakt.

| Fall | Verhalten |
| --- | --- |
| Vorlauf | 0 bis 30 Tage; ab dann steht der Termin im Tagesplan von *heute* |
| Anderer Tag als heute | zeigt nur, was an ihm selbst ist – keine Ankündigungen |
| Woche | markiert den Tag selbst mit Symbol und Namen |
| Mit Jahrgang | „Mama wird 60", beim Jahrestag „zum 5. Mal" |
| Ohne Jahrgang | „Mama hat Geburtstag" – es wird nichts gezählt |
| Anfangsjahr selbst | zählt noch nicht mit; im Geburtsjahr wird niemand null |
| 29. Februar | in normalen Jahren am **1. März**, nicht am 28. Februar |

Der 1. März ist Absicht: einen Tag zu früh zu gratulieren wäre schlechter als
einen Tag später, und dort beginnt das neue Lebensjahr.

Der Vorlauf ist der eigentliche Zweck. Ein Geburtstag, den man am Morgen des
Tages erfährt, nützt wenig – eine Woche vorher reicht noch für ein Geschenk.

## Wer macht was

Aufgaben, Termine und Serien lassen sich Personen zuordnen – einer oder beiden.
Farbige Kürzel stehen am Eintrag, in der Leiste filtert je ein Schalter pro
Person.

Drei Regeln, die das Verhalten bestimmen:

- **Ohne Zuordnung heißt „noch offen", nicht „niemand".** Solche Einträge
  bleiben bei jedem Filter sichtbar – sonst verschwände gerade das aus dem
  Blick, worüber man sich noch einigen muss.
- **Ein eingeplanter Block erbt die Zuordnung seiner Aufgabe.** Nur feste
  Termine führen eine eigene; sonst könnten Aufgabe und Block auseinanderlaufen.
- **Eine gelöschte Person nimmt ihre Arbeit nicht mit.** Ihre Aufgaben und
  Termine bleiben stehen und gelten wieder als offen. Nur ihre Abwesenheiten
  und ihr Urlaubskonto verschwinden mit ihr.

Ein geteilter Termin zählt bei beiden voll in die Auslastung: Die Zeit ist bei
beiden weg.

## Haushaltskasse

Die dritte Karteikarte der Einkaufsansicht. Sie ist keine Buchhaltung, sondern
die Antwort auf zwei Fragen: wohin geht das Geld, und stimmen die Schätzungen
auf der Einkaufsliste?

Im Wagen stehen zwei Wege nebeneinander: *Als Ausgabe buchen* – der Betrag ist
mit der Schätzung vorbelegt und lässt sich auf das ändern, was der Bon sagt –
und *Nur entfernen*, das wie bisher still aufräumt.

Jede Ausgabe hält beides fest: was gerechnet war und was bezahlt wurde. Erst
dieser Unterschied macht die Schätzungen mit der Zeit besser.

| Fall | Verhalten |
| --- | --- |
| Monatssumme | mit Abweichung gegenüber der Schätzung, in Euro und Prozent |
| Ausgabe ohne Schätzung (Tanken) | zählt in die Summe, nicht in den Vergleich – sonst sähe jede Liste zu niedrig aus |
| Gemeinsam getragene Ausgabe | wird auf die Beteiligten **geteilt**; die Anteile ergeben zusammen den Betrag |
| Ausgabe ohne Zuordnung | zählt als gemeinsam |
| Verlauf | sechs Monate; ein Klick auf einen Monat öffnet ihn |

### Feste Kosten

Miete, Strom, Versicherungen, Abos. Einmal eingetragen, zählen sie in jedem
Monat mit — ohne sie zeigte die Übersicht nur die Einkäufe und damit den
kleineren Teil. Die Summenzeile weist getrennt aus, was fest ist und worauf ihr
Einfluss habt.

Feste Posten werden **gerechnet, nicht gespeichert**: Es kann kein Monat
fehlen, nur weil ihn niemand geöffnet hat, und für Jahre in der Zukunft
entstehen keine Karteileichen.

| Fall | Verhalten |
| --- | --- |
| Rhythmus | monatlich, vierteljährlich, jährlich – gezählt wird ab dem Startmonat, nicht ab Quartalsende |
| Betrag ändert sich | *Betrag ändern* beendet den alten Posten und beginnt einen neuen; frühere Monate behalten den alten Betrag |
| Gekündigt | zählt im Kündigungsmonat noch, danach nicht mehr |
| Angezeigt wird | was im gewählten Monat gilt – eine Erhöhung ab Oktober taucht im August nicht auf, wird aber angekündigt |
| Jahressumme | hochgerechnet aus dem, was im gewählten Monat gilt |
| Schätzungsvergleich | bleibt unberührt – feste Posten tragen keine Schätzung |

Bei der Zeit ist es umgekehrt: Ein Termin, den sich beide teilen, zählt bei
beiden **voll** – die Stunde ist bei beiden weg. Ein geteilter Betrag wird
dagegen aufgeteilt.

## Essensplan

In der Einkaufsansicht liegt neben der Liste die Karteikarte *Essensplan*:
sieben Tage mit je einem Platz für Mittag und Abend. Beides an einer Stelle,
weil das eine das andere füllt.

Ein Gericht hält seine Zutaten und die Zahl der Portionen, für die sie gelten.
Beim Einplanen wird umgerechnet: ein Rezept für 2 Personen, für 4 eingeplant,
braucht die doppelte Menge.

*Zutaten auf die Einkaufsliste* fasst zusammen, was die geplanten Gerichte
brauchen. Der Nutzen liegt genau hier: Wer vier Gerichte plant, will nicht
viermal „Zwiebeln" auf der Liste haben, sondern einmal die Summe.

| Fall | Verhalten |
| --- | --- |
| Dieselbe Zutat in mehreren Gerichten | wird zusammengezählt, die Herkunft steht dabei |
| Gleiche Zutat, andere Einheit | bleibt getrennt – „500 g Mehl" und „2 Packungen Mehl" lassen sich nicht addieren |
| Zutat ohne Menge | bleibt ohne Menge – „etwas Petersilie" zweimal ergibt keine Zahl |
| Vorräte (Salz, Öl) | werden ausgelassen und gezählt; auf Wunsch kommen sie mit |
| Bekannter Preis | wird aus dem Preisgedächtnis übernommen |
| Steht schon offen auf der Liste | wird markiert; *Nur was fehlt* überspringt es |
| „Reste", „Essen gehen" | lässt sich frei eintragen, liefert keine Zutaten |

Ein gelöschtes Gericht reißt keine Lücke in den Plan: Die geplanten Mahlzeiten
behalten den Namen als Freitext. An dem Tag wurde ja etwas gekocht.

## Kalender

Unter *Mehr → Kalender* lässt sich eine `.ics`-Datei einlesen – so wandert der
berufliche Kalender einmal herüber, statt Termine zweimal zu pflegen. Vor dem
Übernehmen zeigt eine Vorschau, was gefunden wurde und was nicht.

Bewusst dateibasiert statt als Abo-Adresse: kein weiteres Konto, keine laufende
Verbindung, nichts, das im Hintergrund mitliest.

Gelesen werden die letzten 30 Tage und das kommende Jahr. Ein Arbeitskalender
reicht sonst Jahre zurück.

| Fall | Verhalten |
| --- | --- |
| Termin mit Uhrzeit | wird ein Block im Tagesplan |
| Ganztägiger Eintrag | wird eine Aufgabe mit Fälligkeit – ein Geburtstag soll den Tag nicht als ausgebucht zeigen |
| Serie (täglich, wöchentlich, monatlich, jährlich) | wird in einzelne Termine aufgelöst, samt Intervall, Anzahl, Enddatum und ausgenommenen Tagen |
| Serie mit `BYSETPOS`, `BYMONTHDAY` u.ä. | wird **nicht** geraten, sondern in der Vorschau gemeldet |
| Zeit in UTC oder mit Zeitzone | wird in Ortszeit umgerechnet, Sommerzeit eingeschlossen |
| Derselbe Kalender ein zweites Mal | nur Neues kommt dazu; Doppel erkennt der Planer an der Kennung aus der Datei |

Umgekehrt gibt *Eigene Termine ausgeben* den eigenen Plan als `.ics` aus – zum
Einlesen in den Handy-Kalender. Zeiten stehen dort als Ortszeit ohne
Zonenangabe: der Planer führt Termine als Wanduhrzeit, nicht als Zeitpunkt auf
der Weltkugel.

*Eingelesene entfernen* nimmt alles wieder heraus, was aus einer Datei stammt –
eigene Einträge bleiben unberührt.

## Spracheingabe

Das Mikrofon steht in der Tages-, der Wochen- und der Einkaufsansicht.
Verstanden wird unter anderem:

| Gesprochen | Ergebnis |
| --- | --- |
| „morgen um 15 Uhr Zahnarzt" | Termin am Folgetag, 15:00–16:00 |
| „am Freitag halb drei Meeting für 2 Stunden" | Termin Freitag 14:30–16:30 |
| „übermorgen viertel nach acht Werkstatt" | Termin, 08:15 |
| „Rasen mähen 2 Stunden" | Aufgabe im Pool mit Schätzung |
| „zwei Liter Milch und Brot für drei Euro" | zwei Positionen, eine mit 3,00 € |
| „500 Gramm Mehl" | Position mit Menge und Einheit |
| „morgen um 15 Uhr Zahnarzt für Svenja" | Termin, Svenja zugeordnet |

Namen werden nur nach einem ausdrücklichen „für" erkannt und nur, wenn sie als
Person angelegt sind: „Anruf Svenja" heißt eher, dass Svenja angerufen werden
soll, als dass sie zuständig ist. Weil „für zwei Stunden" und „für drei Euro"
dieselbe Präposition benutzen, greift die Namenserkennung erst, nachdem Dauer
und Preis erkannt wurden.

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

## Urlaub

**Urlaubskonto je Person.** Jahresanspruch, Übertrag aus dem Vorjahr, genommene
und geplante Tage, Rest. Gezählt werden Arbeitstage: Wochenenden und gesetzliche
Feiertage verbrauchen keinen Urlaub. Krankheit und Gleitzeit lassen sich
eintragen, ohne den Anspruch zu belasten. Wer sich übernimmt, sieht einen
negativen Rest – gedeckelt wird nichts.

**Jahresband.** Zwölf Zeilen, ein Feld je Tag, je Person ein Streifen darin.
Damit steht die eigentliche Frage auf einem Blatt: *wann haben wir gleichzeitig
frei?* Solche Tage bekommen einen Rahmen. Ein Tippen auf einen Tag beginnt einen
Eintrag. Am Handy passt das ganze Jahr ohne seitliches Scrollen auf den Schirm.

**Feiertage** werden berechnet, nicht nachgeschlagen – das läuft offline und ohne
Dienst von außen. Das Bundesland stellst du unter *Mehr → Urlaub* ein
(Voreinstellung: Nordrhein-Westfalen). Ortsabhängige Ausnahmen kennt die
Berechnung nicht: Mariä Himmelfahrt gilt in Bayern nur in überwiegend
katholischen Gemeinden, Fronleichnam zusätzlich in einzelnen Gemeinden Sachsens
und Thüringens. Wer betroffen ist, trägt den Tag als freien Tag ein.

**Reisen.** Zu jedem Urlaub lässt sich eine Reise anlegen, mit Ziel, Zeitraum und
drei Listen: Packliste zum Abhaken, Programm nach Tagen und Budget mit
geschätzten Kosten. Oben steht, wie viel schon gepackt ist und was die Reise
kosten soll.

Urlaub und Tagesplan hängen zusammen: An einem Urlaubstag steht das im
Tagesplan, und die Wochenübersicht zeigt Feiertage und Abwesenheiten je Spalte.

## Hell oder dunkel

Oben rechts schaltet ein Knopf zwischen hell und dunkel um, die Taste
<kbd>h</kbd> tut dasselbe. Unter *Mehr → Erscheinungsbild* gibt es die dritte
Möglichkeit: *Wie das Gerät* – die Voreinstellung. Ein Handy, das abends von
selbst dunkel wird, nimmt den Planer dann mit, und zwar sofort, ohne Neuladen.

Der Knopf zeigt, wohin es geht: bei dunkler Ansicht die Sonne, bei heller den
Mond. Ein Tippen auf *Wie das Gerät* macht daraus eine feste Wahl – wer tippt,
will schließlich jetzt etwas anderes sehen. Zurück zur Systemvorgabe geht es
über die Einstellungen.

**Die Wahl gilt nur auf dem jeweiligen Gerät** und wandert nicht in die
geteilten Daten. Lukas' Handy darf dunkel sein, während Svenjas hell ist – ein
Erscheinungsbild ist nichts, worüber sich ein Haushalt einigen muss.

Damit beim Start nichts aufblitzt, setzt ein kurzes Skript im Kopf der Seite
die Wahl, bevor das erste Pixel gezeichnet wird. Das Programm läuft erst nach
dem Laden an und käme dafür zu spät.

## Euer Bild

Unter *Mehr → Euer Bild* lässt sich ein persönliches Foto wählen. Es erscheint
beim Start des Planers und in den Einstellungen; eine Beschriftung darunter ist
optional.

Das Bild wird beim Übernehmen auf 1400 Pixel Kantenlänge verkleinert und als
JPEG abgelegt, damit es die geteilte Ablage nicht aufbläht – aus mehreren
Megabyte werden typischerweise unter 100 kB. Es liegt bei euren Daten und wird
mit dem Haushalt geteilt.

**Absichtlich nicht im Programmcode:** Dieses Repository ist öffentlich. Ein
fest eingebautes Familienfoto läge damit dauerhaft in der Git-Historie und auf
der veröffentlichten Seite. So gewählt, bleibt es in eurer Ablage.

## Ohne Netz

Die App bringt einen Service Worker mit und läuft deshalb vollständig offline –
im Laden im Keller ebenso wie im Funkloch. Beim ersten Besuch legt der Browser
Programm und Oberfläche dauerhaft ab; danach startet der Planer auch ohne
Verbindung, und Firestore puffert die Daten.

Eine neue Fassung wird nicht im Hintergrund untergeschoben, sondern angekündigt:
Eine Leiste am unteren Rand fragt, ob jetzt geladen werden soll. Mitten im
Einkauf soll sich die Seite nicht selbst neu laden.

Was am Handy zusätzlich hilft: „Zum Startbildschirm hinzufügen" – dann startet
der Planer ohne Browserleiste wie eine eigene App.

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

## Tastatur

| Taste | Wirkung |
| --- | --- |
| `←` / `→` | Tag bzw. Woche zurück/vor |
| `t` | zu heute springen |
| `d` / `w` / `m` / `l` | Tag / Woche / Monat / Liste |
| `e` / `u` | Einkauf / Urlaub |
| `n` | neue Aufgabe |
| `h` | hell/dunkel umschalten |
| `?` | Kurzhilfe |

## Aufbau

```
src/
  domain/       Fachlogik ohne UI – Datumsrechnung, Wiederholungsmuster,
                Kollisions-Layout, Lückensuche, Sprach-Deutung, Preisgedächtnis,
                Bildaufbereitung, Feiertage, Urlaubsrechnung
  storage/      lokale Ablage (IndexedDB) und der zentrale Zustand
  sync/         Firebase-Anbindung: Anmeldung, Haushalt, Abgleich
  hooks/        Ziehen und Ablegen, Spracherkennung, Medienabfragen,
                Aktualisierung der App
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
- **Member** – eine Person im Haushalt, mit eigenem Urlaubsanspruch. Bewusst
  unabhängig von der Anmeldung, damit der Planer auch ohne Synchronisation für
  zwei Personen führen kann.
- **Absence** – ein Zeitraum: Urlaub, Gleitzeit, Krank oder Sonstiges.
- **Trip / TripItem** – eine Reise und ihre Punkte; Packliste, Programm und
  Budget sind dieselbe Sammlung mit unterschiedlichem Zweck.
- **Preisgedächtnis** – liegt in den Einstellungen und wird mitsynchronisiert,
  damit beide dieselben Preise kennen.

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
- **Der erste Aufruf braucht Netz.** Danach läuft alles offline.
- **Der Haushalts-Code ist das Geheimnis.** Wer ihn kennt, kann beitreten. Er
  lässt sich nicht ändern – notfalls einen neuen Haushalt anlegen.
- **Bündelgröße** rund 860 kB (255 kB komprimiert), überwiegend Firebase. Der
  Service Worker lädt das genau einmal.
- **Keine Anbindung an Outlook oder Google Kalender.** Feste Termine werden von
  Hand oder per Sprache erfasst.
