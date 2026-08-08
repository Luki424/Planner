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
volle Karte für das Wort „frei" zu verbrauchen.

Sind Personen angelegt, zeigt jeder Tageskopf die Auslastung je Person statt
einer Gesamtsumme. *Monat* siehe unten – beides in einem Reiter, weil es
dieselbe Frage in zwei Auflösungen ist.

**Kein Aufgabenpool daneben.** Er belegte 370 der 1440 Pixel, und was blieb,
teilten sich sieben Spalten: für den Titel eines Termins waren es am Ende
75 Pixel. „Zahnarzttermin Dr. Berger" ist darin bei keiner Schriftgröße
lesbar – kleinere Schrift half nicht, sie machte es schlimmer. Ohne den Pool
sind es 134 Pixel.

Er ist aber nicht weg, sondern **ausklappbar über der Woche**: als Streifen,
in dem die Karten nebeneinander stehen. So bleibt das Ziehen einer Aufgabe
auf einen Wochentag möglich, ohne dass die Spalten wieder schmal werden – er
kostet nur Höhe, und die auch nur, solange er offen ist. Standardmäßig zu;
die Wahl bleibt auf dem Gerät. Im Monat gibt es ihn nicht, dort fehlt die
Ablagefläche.

Die Spaltenhöhe richtet sich nach dem vollsten Tag. Vorher verteilten die
sieben Spalten die ganze Resthöhe unter sich, und fünf leere Tage standen als
330 Pixel hohe Kästen da.

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
| Kalenderwoche | steht als schmale Spalte am Zeilenanfang; ein Klick öffnet die Woche |
| Am Handy | ein Feld ist rund 50 px breit; statt Text bleibt je Eintrag ein farbiger Strich |

Der Aufgabenpool steht in der Monatsansicht nicht daneben: dort geht es ums
Überblicken, nicht ums Verteilen, und das Raster kann die Breite gebrauchen.

Das Gekappte beim Blättern ist Absicht. Naiv gerechnet wäre der 31. Januar
plus ein Monat der 3. März – man überspränge den Februar. Der Preis dafür:
vom gekappten 28. Februar aus weiterzublättern führt auf den 28. März, nicht
zurück auf den 31.

## Kalenderwoche

Über den sieben Spalten steht die Woche in einer Zeile: **KW 32 · 2 Termine ·
3 h verplant · 5 % · am meisten Mi · frei: Mo Di Fr Sa So.**

Die Spalten zeigen jeden Termin einzeln, beantworten aber nicht die Frage,
mit der man auf eine Woche schaut: Ist zu viel drin, und wo ist noch Luft?
Deshalb steht dort das Ergebnis, nicht das Rohmaterial.

| Angabe | Bedeutung |
| --- | --- |
| Termine | nur die mit Uhrzeit; Ganztägiges wird eigens genannt |
| verplant | Summe der Woche, ohne Ganztägiges – dieselbe Regel wie in Tag und Monat |
| Prozent | gegen die Tageskapazität mal sieben, nicht gegen einen einzelnen Tag |
| voll | Tage über der Tageskapazität, rot ausgezeichnet |
| am meisten | nur, wenn überhaupt etwas ansteht – „am meisten Montag mit null Minuten" wäre keine Auskunft |
| frei | Tage ganz ohne Eintrag, **anklickbar**: von dort aus wird geplant |

Gerechnet wird mit denselben Blöcken, die darunter stehen – also nach Bereich
und Person gefiltert. Sonst stünde oben eine Zahl, die sich unten nicht
nachzählen lässt.

Im Monat trägt jede Zeile ihre Kalenderwoche in einer eigenen schmalen Spalte
vorn. Ohne sie lässt sich ein Termin nicht einordnen, sobald jemand von
„KW 34" spricht – und das tut ein Arbeitskalender ständig.

## Ganztägig

Fortbildung, Umzug, Kita geschlossen: Dinge, die keine Uhrzeit haben, sondern
den Tag. In der Dauerauswahl steht dafür **ganztägig** – im Pool, im
Aufgabendialog und bei den Serien; feste Termine haben ein eigenes Häkchen.

| Fall | Verhalten |
| --- | --- |
| Anzeige | in einem Streifen **über** der Zeitachse, nicht auf ihr |
| Auslastung | zählt **nicht** mit – siehe unten |
| Freie Lücke suchen | wird übersprungen; Ganztägiges belegt keine Uhrzeit |
| Woche | eigenes Band über den Zeitblöcken |
| Auf die Achse gezogen | wird dadurch zu einem Termin mit Uhrzeit |
| Zurückgeschaltet | bekommt 09:00–10:00 als Vorgabe, nicht 00:00–00:00 |
| Kalenderausgabe | geht als `DTSTART;VALUE=DATE` hinaus, ohne Uhrzeit und Zeitzone |
| Kalendereinlesen | landet im Streifen; mehrtägiges bekommt je Tag einen Eintrag |
| Mehrtägiges entfernen | jeder Tag trägt eine Kennung, damit „Eingelesene entfernen" alle erwischt |

Ganztägig ist ein eigenes Feld, kein Sonderwert in der Dauer – sonst rechnete
früher oder später jemand mit der Zahl weiter. Die gewählte Dauer bleibt dabei
stehen: schaltet man zurück, steht wieder da, was vorher gewählt war. Solange
der Eintrag ganztägig ist, zählt sie nirgends mit.

**Zur Auslastung:** zuerst belegte ein ganztägiger Eintrag die volle
Tageskapazität – der Gedanke war, dass ein Tag mit Fortbildung nicht leer
aussehen soll. In der Benutzung war das falsch: „Kita geschlossen" oder ein
Geburtstag machen den Tag nicht voll, färbten den Balken aber rot. Die
Auslastung beantwortet, wie viel *Zeit* verplant ist; dass etwas Ganztägiges
ansteht, zeigt der Streifen darüber.

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
| Ganztägiger Eintrag | landet im Streifen über der Zeitachse und zählt nicht in die Auslastung – ein Geburtstag soll den Tag nicht als ausgebucht zeigen |
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

### Privates und Berufliches auseinandersortieren

Ein eingelesener Kalender ist fast immer *einer* von beidem: ein
Arbeitskalender mit ein paar privaten Terminen darin, oder umgekehrt. Deshalb
entscheidet der Planer nicht, wohin die Masse geht – das steht beim Import
unter *Bereich*. Erkannt werden nur die Ausnahmen.

Beim Übernehmen ist *Privates automatisch heraussortieren* eingeschaltet.
Termine, die eindeutig privat sind, gehen dann in den Bereich unter *Privates
nach* (vorbelegt mit dem Bereich, der „privat" heißt), alles andere in den
gewählten Bereich. Wie viele das jeweils sind, steht **vor** dem Übernehmen
da – eine Einschätzung, die man erst am Ergebnis prüfen kann, ist keine Hilfe.

Erkannt wird an Stichwörtern in Titel und Ort: Zahnarzt, Geburtstag,
Standesamt, Kreuzfahrt, Werkstatt auf der einen Seite; Besprechung, Jour fixe,
Inventur, Dienstreise auf der anderen. Der Beschreibungstext bleibt bewusst
außen vor – Einladungen aus Outlook schleppen ganze E-Mail-Verläufe mit, darin
findet sich irgendein Wort immer.

Die Leitlinie ist **lieber nichts sagen als falsch raten**. Ein falsch
einsortierter Termin ist schlimmer als ein nicht einsortierter, weil man ihn
nicht dort sucht, wo er liegt. Wer unsicher ist, folgt der Vorgabe. Deshalb
suchen die Stichwörter am Wortanfang statt irgendwo im Text: eine reine
Teilwortsuche machte „Th**oma**s Behringer" privat (wegen „oma") und
„C**oP** KBA" ebenso (wegen „op"). Zusammensetzungen finden trotzdem ihr
Grundwort, weil es im Deutschen hinten steht – „Überraschungs*ausflug*",
„Kinder*geburtstag*", „Zahnarzt*termin*".

Mehrdeutiges steht gar nicht erst in den Listen. „Training" wäre im
Arbeitskalender ein Verkaufstraining, „Termin" sagt nichts, „Update" auch
nicht. An einem echten Arbeitskalender mit 291 Einträgen erkannte die
Zuordnung 12 private Termine – alle richtig, keinen falschen.

### Serien aus Outlook und Exchange

Beide schreiben eine Terminserie **zweimal**: einmal als Regel (`RRULE`) und
zusätzlich jeden geänderten Einzeltermin als eigenen Eintrag – mit derselben
`UID` und einer `RECURRENCE-ID`, die sagt, welchen Termin der Serie er
ersetzt. Wer `RECURRENCE-ID` nicht kennt, zählt beide und hat den Tag doppelt
im Kalender.

Der Import löst das in zwei Durchgängen: erst werden alle Ausnahmen gesammelt,
dann die Serien aufgelöst – Tage, für die ein eigener Eintrag existiert, lässt
die Serie aus. Der ersetzte Termin bekommt die Kennung des Tages, den er
ersetzt (`uid|datum`), damit ein zweiter Import ihn wiedererkennt.

In einem echten Exchange-Export mit 291 Einträgen waren 49 solcher Ausnahmen
enthalten.

## Spracheingabe

Das Mikrofon steht in **Tag, Woche, Liste und Einkauf**. Gesprochenes wird
gedeutet und erst nach Sichtkontrolle übernommen – Spracherkennung verhört
sich zu oft, als dass ein Termin ungeprüft im Kalender landen sollte.

### Was am Handy nicht funktionierte

| Was | Warum |
| --- | --- |
| Der Satz brach mittendrin ab | Die Erkennung lief ohne `continuous`. Sie endet dann bei der ersten Atempause – aus „Zahnarzttermin am Dienstag … um zehn" wurde nur der erste Teil. |
| Eine Aufnahme sah kaputt aus | Am Handy meldet die Erkennung ständig `no-speech`; jede Pause reicht. Das wurde als Fehler angezeigt. |
| Das Diktat riss ab | Android beendet die Sitzung gern von sich aus, mitten im Satz. |
| Der Knopf wurde übersehen | Ein rundes Feld mit einem Symbol darin liest sich als Verzierung, nicht als Knopf. |
| **Der Knopf tat gar nichts** | `start()` lief ins Leere: kein `onstart`, kein `onerror`, kein geworfener Fehler. Genau so verhält sich Chrome, wenn der Planer vom Startbildschirm als App läuft und niemand nach dem Mikrofon gefragt hat. |
| **Der Satz war zu sehen und kam trotzdem nicht an** | Android markiert beim Beenden nicht immer ein Endergebnis. Gewertet wurde nur Endgültiges – das Gesprochene war weg. |

Jetzt läuft die Erkennung im Dauerbetrieb und endet über eine **Stille-Uhr**:
zweieinhalb Sekunden nach dem letzten Wort, sieben Sekunden vor dem ersten –
das Antippen, Ansetzen und Überlegen kostet mehr als zweieinhalb. Beendet der
Browser die Sitzung von sich aus, wird weitergehört, höchstens sechsmal;
danach zählt, was bis dahin verstanden wurde. `no-speech` und `aborted`
gelten nicht als Fehler.

Der Knopf ist ein gefüllter Balken mit Beschriftung: **🎤 Diktieren**, beim
Aufnehmen rot und **■ Fertig**.

#### Wenn nichts passiert

Stilles Versagen ist der schlimmste Fall: Der Benutzer sieht einen Knopf, der
nichts tut, und hat nichts in der Hand. Deshalb gibt es drei Vorkehrungen:

1. **Kein Fehler wird mehr verschluckt.** Ein geworfener Fehler beim Start
   stand vorher in einem leeren `catch`.
2. **Eine Frist.** Bestätigt der Browser die Aufnahme nicht binnen
   zweieinhalb Sekunden, gilt sie als nicht angesprungen.
3. **Die Erlaubnis wird ausdrücklich geholt.** In beiden Fällen fragt der
   Planer über `getUserMedia` selbst nach dem Mikrofon – die Frage erscheint
   dort zuverlässig, wo die Spracherkennung sie verschweigt – gibt den Ton
   sofort wieder frei und startet einen zweiten Anlauf. Genau einmal: bleibt
   es auch danach still, steht eine Meldung da statt eines stummen Knopfes.

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

## Gestaltung

Die Farbwelt stammt weiter aus dem Hochzeitsfoto der Allee – Laubgrün im
Schatten, warmes Sonnenlicht, heller Kiesweg. Geändert wurde nicht der Ton,
sondern das System dahinter.

**Vorher waren es 21 Schriftgrößen** zwischen 9,5 und 34 px, **25 Abstände**
mit 7, 9, 11, 13, 17 und 23 px dicht nebeneinander und **neun Radien**. Jeder
Wert für sich war begründet; zusammen lag nichts auf einer Linie, und jeder
neue Baustein brachte den nächsten Zwischenwert mit.

| Was | Jetzt |
| --- | --- |
| Abstände | Vierer-Rhythmus, `--sp-1` bis `--sp-8` (4 – 40 px) |
| Schrift | Verhältnis 1,125 um 17 px: 12 · 13,5 · 15 · 17 · 19 · 21,5 · 24 · 30 |
| Untergrenze | 12 px – darunter wird auf einem Handy nichts gelesen, nur erraten |
| Radien | drei Stufen statt neun: 8 · 12 · 16 px |
| Tiefe | über die Fläche (`--bg`, `--bg-elev`, `--bg-elev-2`), nicht über Schlagschatten |
| Schatten | nur noch, was wirklich über allem liegt: Dialog, Sprachfenster, Ziehschatten |
| Trennlinien | `--border-soft`, halbdurchsichtig, innerhalb einer Fläche |

Ein Schlagschatten ist im Dunkelmodus ohnehin kaum sichtbar – der Grund ist
schon dunkel. Deshalb trägt die Fläche die Tiefe, in beiden Modi gleich.

**Karten tragen eine Kante statt drei Signale.** Aufgaben hatten Rahmen,
farbige Kante und eigene Fläche zugleich; alle drei sagten dasselbe. Geblieben
ist die farbige Kante für den Bereich.

**Inhalt zuerst, Handlung darunter.** In der 344 px breiten Poolkarte blieben
dem Titel neben Griff, Häkchen und „Einplanen" nur 149 px – „Steuererklärung"
brach mitten im Wort. Über zwei Zeilen sind es 254 px.

### Kontrast

Nachgemessen und behoben:

- Gedämpfter Text auf erhöhten Karten kam im Hellmodus auf **4,21:1** und lag
  damit unter der Grenze von 4,5:1. Betroffen war die Meta-Zeile jeder
  Aufgabe.
- Weiße Schrift auf der Akzentfläche kam im **Dunkelmodus** auf **3,04:1** –
  dort ist der Akzent aufgehellt, damit er sich vom dunklen Grund abhebt, und
  genau das macht Weiß darauf schlecht lesbar. `--on-accent` ist deshalb hell
  im Hellmodus und dunkel im Dunkelmodus.

Der Prüflauf *Gestaltung* misst beides bei jedem Durchgang: Schriftgrößen
gegen die Skala, Kontrast jedes sichtbaren Textes gegen die Fläche, auf der er
tatsächlich liegt.

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
- **Die Zuordnung privat/beruflich kennt nur Stichwörter.** Was mit keinem
  davon gesagt ist, folgt der Vorgabe – das ist gewollt und lässt sich pro
  Termin von Hand ändern.
