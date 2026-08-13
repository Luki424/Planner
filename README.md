# Tagesplaner

Ein Planungswerkzeug für den privaten und beruflichen Tag, gedacht für zwei
Personen mit einem gemeinsamen Haushalt. Aufgaben sammeln sich in einem Pool und
werden von dort als Zeitblöcke in den Tag gezogen – so zeigt der Plan nicht nur,
*was* ansteht, sondern auch, *ob es überhaupt in den Tag passt*. Dazu eine
gemeinsame Einkaufsliste mit Kostenschätzung und Spracheingabe für unterwegs.

Ausgelegt auf das Handy: alle Bedienelemente sind fingertauglich, das Ziehen läuft
über Pointer-Events statt über die HTML5-Drag-API.

Die Farbwelt ist aus einem Foto abgeleitet – Laubgrün im Schatten, warmes
Sonnenlicht, heller Kiesweg. Die Neutraltöne liegen deshalb in der Familie von
Hafer, Sand und Umbra statt bei Blaugrau oder Oliv, und der Akzent ist ein
gedämpftes Grün, das sich weder mit den Signalfarben noch mit den Bereichsfarben
verwechseln lässt. Wie warm sie wirklich sind, wird nachgerechnet: siehe
[Gestaltung](#wärme-nachgemessen).

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
ziehen; überlappende Blöcke stehen nebeneinander – am Handy mit eigenen Regeln,
siehe [Gleichzeitige Termine](#gleichzeitige-termine-auf-dem-handy). Feste
Termine (Meetings, Arzt) sind ein eigener Blocktyp, schraffiert dargestellt.
Ganztägiges steht in einem Streifen über der Achse, siehe unten.

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
Preis vorgeschlagen und übernimmt ihn, ohne ihn erneut einzugeben. Für alles,
was ihr noch nie gekauft habt, springt ein **Richtwert** ein – siehe unten. Vorschläge
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

## Suchen

Ein Knopf in der Kopfzeile, die Taste `/`, und über allem liegt ein Feld.
Gesucht wird in **Terminen, Aufgaben, Einkäufen, Jahrestagen, Reisen,
Ausgaben und Rezepten** gleichzeitig – in Titeln und Notizen.

Kein eigener Reiter: Suchen ist kein Ort, an dem man sich aufhält, sondern
ein Weg irgendwo hin. Der Deckel geht auf, man tippt, man landet – und die
Ansicht darunter ist noch die, aus der man kam.

| Fall | Verhalten |
| --- | --- |
| Ein Buchstabe | wird nicht gesucht – er träfe alles |
| Mehrere Wörter | müssen **alle** vorkommen; „zahnarzt berger" findet den einen Termin, nicht jeden Zahnarzt und jeden Berger |
| Umlaute, Groß/klein | egal: „kuechen" findet „Küchenrolle" |
| Wortmitte | zählt: wer „arzt" sucht, findet den Zahnarzt – aber „Arzttermin" steht davor |
| Reihenfolge | Wortanfang vor Wortmitte, Titel vor Notiz, Nahes vor Fernem, Offenes vor Erledigtem |
| Ein Treffer | führt dorthin, wo er steht: auf seinen Tag, in die Liste, auf die richtige Karteikarte |
| Tastatur | `/` öffnet, ↑↓ blättert, Enter öffnet, Esc schließt |

Warum die Reihenfolge so viel Aufmerksamkeit bekommt: Ein Treffer, den man
sucht, steht selten allein da. Nach dem Einlesen eines Arbeitskalenders
liegen dreihundert Termine im Jahr – „Besprechung" trifft dann vierzig davon,
und nur die Sortierung entscheidet, ob die Suche etwas taugt.

Eine Sammlung fehlt bewusst: **Belege.** Auf einem Foto steht kein
durchsuchbarer Text, und die Ausgabe daneben ist ohnehin auffindbar.

## Assistent

Eine Blase am unteren Rand, Taste `k`, oder ein Zuruf: ein Chat, der euren
Plan kennt. *„Was steht Donnerstag an?"*, *„Wie viel haben wir diesen Monat
für Lebensmittel ausgegeben?"* – oder gleich *„Zahnarzt am Dienstag um
zehn"*.

Zwei Entscheidungen tragen das Ganze, und beide gehören erklärt.

### Der Schlüssel bleibt auf dem Gerät

Der Planer ist eine reine Browser-Seite auf einer **öffentlichen** Adresse;
einen Server, der einen Schlüssel für alle verwahren könnte, gibt es nicht.
Ein eingebauter Schlüssel wäre für jeden benutzbar, der die Seite aufruft –
auf eure Rechnung.

Also gehört der Zugang euch: unter *Mehr → Assistent* trägt ihn jeder einmal
auf seinem Gerät ein. Er liegt im Gerätespeicher und ausdrücklich **nicht** im
abgeglichenen Zustand, sonst stünde er in der gemeinsamen Datenbank. Der
Preis ist die doppelte Eingabe; die Alternative wäre ein Schlüssel, der
herumliegt.

Unterstützt sind Anthropic (Claude) und OpenAI. Die Kosten laufen über euer
Konto beim jeweiligen Anbieter.

### Geändert wird erst nach einem Fingertipp

Der Assistent darf lesen und vorschlagen – eintragen darf er nichts von
selbst. Was er tun würde, steht als Satz da: *„Termin am 11.8. um 10:00
(45 min): Zahnarzt Dr. Berger"*, daneben *Übernehmen*. Ein Missverständnis
ist damit eine Rückfrage und kein falscher Termin.

Vorschläge werden vorher geprüft. Kommt statt eines Datums *„nächsten
Dienstag"* zurück oder eine Uhrzeit, die keine ist, wird der Vorschlag gar
nicht erst angeboten – lieber nichts als etwas, das nach dem Bestätigen
anders aussieht als angekündigt.

| Fall | Verhalten |
| --- | --- |
| Was er anlegen kann | Termin, Aufgabe, Einkauf, Ausgabe – mehr Werkzeuge gibt es nicht |
| Ohne Schlüssel | steht da, was fehlt und wo man ihn einträgt, statt eines Feldes, das nichts tut |
| Abgelehnter Schlüssel | wird auf Deutsch gemeldet, nicht als „401" |
| Gespräch | überlebt das Schließen des Deckels, nicht den Neustart; *Neu* räumt es weg |
| Zweimal übernehmen | geht nicht – nach dem Tippen steht dort „eingetragen ✓" |
| Tastatur | `k` öffnet, Enter schickt, Umschalt+Enter macht eine neue Zeile, Esc schließt |
| Freihändig | 🎤 antippen und sprechen – oder „Hey Planer“ rufen, wenn eingeschaltet |

### Sprachsteuerung

Der Assistent lässt sich freihändig bedienen – gedacht fürs Kochen, fürs
Auto, für ein Kind auf dem Arm.

**Fragen.** Ein Mikrofon neben dem Eingabefeld. Antippen, sprechen, kurz
still sein – die Frage geht von selbst hinaus. Bewusst ohne zweiten
Fingertipp: Ein Diktat, das man anschließend noch bestätigen muss, wäre nur
ein umständliches Eingabefeld. Der Fingertipp bleibt dort, wo er hingehört –
beim *Eintragen*. Fragen ändert nichts.

Was gehört wird, steht währenddessen in Lesegröße über der Eingabe. Dieselbe
Lehre wie beim Diktat im Tagesplan: Wer nicht sieht, ob etwas ankommt,
spricht lauter statt weiter.

**Antworten.** Werden vorgelesen. Der Lautsprecher oben im Fenster schaltet
das um – die Lage entscheidet, im Auto ja, im Wartezimmer nicht, und dafür
geht niemand ins Menü. Die Vorschläge werden mitgesprochen: „Ich kann zwei
Sachen eintragen", ohne zu sagen welche, wäre die Hälfte einer Antwort. An
jeder Antwort steht außerdem ein kleiner Lautsprecher zum Nachhören.

Lange Antworten werden in Sätze zerlegt, bevor sie gesprochen werden – Chrome
bricht eine Äußerung sonst nach etwa fünfzehn Sekunden mitten im Wort ab.

**Aufwecken.** Ist *„Auf ‚Hey Planer‘ hören"* eingeschaltet, öffnet ein Zuruf
den Assistenten. Wurde gleich mitgefragt – „Hey Planer, was steht Donnerstag
an" –, geht die Frage sofort hinaus; kam nur der Ruf, geht das Mikrofon an.

Das ist **standardmäßig aus**, und zwar mit Absicht:

| Punkt | Was gilt |
| --- | --- |
| Reichweite | nur solange der Planer offen und sichtbar ist – im Hintergrund hört nichts zu, das kann eine Internetseite nicht |
| Akku | das Mikrofon bleibt offen, der Browser zeigt es an |
| Ton | Chrome schickt ihn zur Auswertung an Google – beim Diktat auch, hier eben dauernd |
| Fehlalarm | das Weckwort springt nur am Satzanfang an; „ein guter Planer" weckt nichts |

Verhörer sind eingeplant: „Planner", „Plana", „Planet" gelten mit. Lieber ein
paar Schreibweisen zu viel als ein Weckwort, das bei jedem Dritten nicht
anspringt.

### Die Blase

Der Assistent liegt als Blase unten rechts – über allen Ansichten, auch über
Dialogen. Am Handy voll deckend und beschriftet: der auffälligste Knopf auf
dem Schirm.

**Das brauchte zwei Anläufe.** Zuerst 45 % Deckkraft, voll erst beim
*Berühren mit der Maus* – auf einem Handy gibt es das nicht, dort blieb sie
dauerhaft blass. Die Prüfung maß den Zustand beim Berühren und war deshalb
grün; sie misst jetzt den Ruhezustand. Dann 88 %, weiterhin zu zurückhaltend.
Jetzt voll deckend, mit Wort statt nur Symbol.

**Beim Schreiben meldet sie sich.** Sobald irgendwo ein Eingabefeld den Fokus
hat, tritt sie hervor und zeigt ihre Beschriftung – auch am Handy, wo sonst
nur das Symbol steht. Wer tippt, ist gerade dabei, etwas einzutragen, und
genau das kann sie abnehmen.

Sie hängt am *sichtbaren* Ausschnitt, nicht am Layout: Geht die Tastatur auf,
rückt sie darüber statt dahinter. Ohne Tastatur bleibt sie über der
Navigationsleiste, sonst träfe man beim Tippen auf „Mehr" die Blase.

Hört der Planer gerade auf sein Weckwort, steht ein Ohr daneben. Ein Mikrofon,
das läuft, ohne dass man es sieht, wäre das Gegenteil von dem, was diese App
sein soll.

### Was den Haushalt verlässt

Beim Fragen geht ein Ausschnitt mit, und zwar als lesbarer Text und nicht als
Datenabzug:

- Termine der **nächsten zwei Wochen** (Datum, Zeit, Titel, Bereich)
- offene Aufgaben und die offene Einkaufsliste
- Ausgaben **nur als Summe je Kategorie** für den laufenden Monat
- Tageskapazität und die verplante Zeit dieser Woche

Nicht dabei: Notizen, Belege, Fotos, einzelne Buchungen, Urlaubs- und
Gesundheitsdaten, die Kalenderhistorie. Wer wann was gekauft hat, ist ein
Kontoauszug – der bleibt hier.

## Erinnerungen

*„In 10 Minuten: Zahnarzt Dr. Berger (10:00)"* – ein Streifen unten am Bild,
und wenn erlaubt zusätzlich als Systemmeldung.

**Die Grenze zuerst, weil sie alles Weitere bestimmt: Es gibt keinen
Server.** Der Planer ist eine Seite im Browser, kein Dienst. Erinnert werden
kann deshalb nur, solange er **offen** ist. Liegt er im Hintergrund und ist
die Benachrichtigung erlaubt, kommt sie als Systemmeldung; ist die App
geschlossen, kommt nichts, und daran lässt sich ohne Server nichts ändern.

Das ist wenig. Es wird hier trotzdem nicht schöngeredet: Eine Erinnerung,
die verspricht, auch bei geschlossener App zu kommen, bemerkt man als Lüge
erst am verpassten Termin.

| Fall | Verhalten |
| --- | --- |
| Vorlauf | aus, 5, 10, 15, 30 min oder 1 Stunde – gilt **nur auf diesem Gerät**, ihr stellt es jeder für euch ein |
| Erlaubnis | wird beim Einschalten erfragt, nicht beim Laden – ungefragt zu fragen klickt man weg, ohne zu lesen |
| Zu spät geöffnet | ein Termin, der vor bis zu fünf Minuten begann, wird noch gemeldet: besser spät als „verpasst" |
| Weggetippt | bleibt weg, auch über das Neuladen hinweg – am Handy wird dauernd neu geladen |
| Tageswechsel | der Merkzettel fängt von vorn an, sonst bliebe ein Serientermin für immer stumm |
| Ganztägiges | bleibt außen vor – ohne Uhrzeit wäre „in 15 Minuten" erfunden; dafür gibt es die Jahrestage mit eigener Vorwarnung |

### In den Handy-Kalender

Am Termin steht ein Knopf **„In den Handy-Kalender"**. Er gibt genau diesen
Termin an den Kalender des Geräts ab – mit Uhrzeit, Bereich, Zuständigen
und **mit einer Weckzeit**.

Das ist die ehrliche Antwort auf die Grenze oben: Der Planer kann nur
erinnern, solange er offen ist. Ein Handy-Kalender kann es immer. Statt eine
Zusage zu verwalten, die wir nicht halten können, geben wir den Termin
dorthin ab, wo das Wecken zuverlässig funktioniert.

| Fall | Verhalten |
| --- | --- |
| Am Handy | über den Teilen-Dialog von Android – der Kalender steht dort direkt zur Auswahl |
| Sonst | als `.ics` in die Downloads; ein Tipp darauf öffnet den Kalender |
| Weckzeit | derselbe Vorlauf wie im Planer; steht der auf „aus", trotzdem 15 Minuten – wer einen Termin abgibt, will erinnert werden |
| Zweimal abgegeben | legt drüben kein Doppel an: Die Kennung bleibt dieselbe |
| Neuer Termin | hat den Knopf noch nicht – erst speichern, dann abgeben |

Es wird gesagt, welcher Weg genommen wurde. Ein Teilen-Dialog, der aufgeht
und wieder zugeht, und eine Datei, die still in den Downloads landet, sehen
sonst beide aus wie „nichts passiert".

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

## Richtwerte für Preise

Das Preisgedächtnis kennt nur, was ihr schon einmal gekauft habt. Beim ersten
„Butter" stand die Liste ohne Summe da. Für rund sechzig alltägliche Dinge
liegt deshalb ein Richtwert bei, jeweils mit der Menge, auf die er sich
bezieht – ein Preis ohne Menge ist keine Auskunft.

| Fall | Verhalten |
| --- | --- |
| Beim Tippen | *„Richtwert 2,29 € für 250 g"* unter dem Eingabefeld |
| In der Zeile | **ca. 2,29 €**, gestrichelt unterstrichen statt nur blass – wer im Laden abgleicht, muss wissen, welche Posten geraten sind |
| In der Summe | zählt mit; darunter steht *„davon 3,58 € geschätzt"* |
| Eigener Preis | gewinnt immer; der Richtwert verschwindet für diesen Artikel |
| Beim Bearbeiten | steht der Richtwert schon im Feld – bestätigen ist ein Fingertipp |
| Unbekannter Artikel | bleibt „Preis?"; geraten wird nicht |

**Ein Richtwert wandert nie ins Preisgedächtnis.** Dort steht ausschließlich,
was tatsächlich bezahlt wurde. Sonst wäre eine Schätzung beim nächsten Mal
nicht mehr von einem echten Preis zu unterscheiden – sie schriebe sich selbst
fest.

Gefunden wird der Artikel auch in „2 Liter Bio Milch": Zahl, Einheit und
„Bio" sagen nichts darüber, *was* gekauft wird. Zusammensetzungen treffen
über ihr Grundwort, und das steht im Deutschen hinten – „Kaffeesahne" ist
Sahne, „Salatgurke" ist Gurke. Umgekehrt gilt das ausdrücklich nicht:
**„Milchreis" ist Reis, nicht Milch.**

### Woher die Zahlen stammen

Es sind **Schätzwerte für deutsche Supermärkte, keine amtliche Statistik.**
Stand August 2026.

Geplant waren die Durchschnittspreise des Statistischen Bundesamtes. Die
ließen sich aus der Entwicklungsumgebung nicht abrufen – deren Netzfreigabe
lässt nur GitHub zu. Zahlen mit einer Quelle zu beschriften, aus der sie
nicht stammen, wäre schlimmer als gar keine Quelle; also steht in der App und
in `RICHTWERT_QUELLE` das, was es ist. Ein Einheitentest hält fest, dass dort
keine amtliche Quelle behauptet wird.

Praktisch fällt das wenig ins Gewicht: Der Richtwert gilt nur, solange ihr
den Artikel noch nie gekauft habt. Nach ein paar Einkäufen stehen überall
eure eigenen Preise – und die sind genauer als jeder Durchschnitt.

Wer die amtlichen Zahlen einsetzen will, tauscht die Tabelle in
[`src/domain/reference.ts`](./src/domain/reference.ts) aus; sie steht als ein
Block beieinander, samt `RICHTWERT_STAND` und `RICHTWERT_QUELLE`.

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

## Bilanz – wo geht die Zeit hin

Dritte Karteikarte im Wochenreiter. Der Tagesplan beantwortet „passt das noch
rein", die Woche „ist zu viel drin"; hier steht die Frage, die man sich erst
nach ein paar Monaten stellt: *wohin* geht sie eigentlich, und geht sie bei
beiden gleichmäßig hin?

Zeitraum wahlweise die letzten vier Wochen, drei Monate oder ein Jahr.

| Angabe | Bedeutung |
| --- | --- |
| verplant / je Woche / Termine | die Größenordnung zuerst |
| Nach Bereich | Anteil an der verplanten Zeit |
| Nach Person | ein gemeinsamer Termin zählt bei **beiden voll** – die Frage ist, wie viel bei wem ansteht, nicht wie man eine Stunde aufteilt |
| Über die Woche verteilt | sieben Säulen; der vollste Wochentag ist hervorgehoben |
| Darunter | vollster Tag, Tage über der Kapazität, ganz freie Tage |

**Gerechnet wird mit Geplantem, nicht mit Gelebtem.** Der Planer weiß nicht,
ob ein Termin stattgefunden hat – er weiß, was vorgesehen war. Das steht auch
unter der Auswertung, sonst liest man die Zahlen als Nachweis. Ganztägiges
bleibt außen vor, es belegt keine Stunden; genannt wird es trotzdem.

Termine ohne Zuordnung tauchen in der Personenaufteilung nicht auf. Sie
gelten für alle – jemandem zuzuschlagen wäre erfunden, und die Aussage hinge
daran, wie fleißig jemand Häkchen setzt.

Ein Detail, das eine Weile falsch war: Die Balken sind `<span>`. Als
inline-Element verpufft `height: 100 %` – sie waren da, ohne da zu sein. Ein
Browserdurchlauf misst jetzt nach, dass der Balken wirklich Fläche hat.

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

### Belege

Zu jeder Ausgabe lässt sich der Bon fotografieren – beim Buchen des Wagens
oder später über den Kameraknopf in der Ausgabenzeile. Man fotografiert nicht
immer im Laden, sondern manchmal erst abends aus der Jackentasche.

| Fall | Verhalten |
| --- | --- |
| Aufnehmen | am Handy öffnet sich die Rückkamera, nicht der Dateibrowser |
| In der Zeile | ein Daumennagel; antippen öffnet den Beleg formatfüllend |
| Je Ausgabe | genau ein Beleg – ein zweiter ersetzt den ersten. Wer zwei Bons hat, hat zwei Einkäufe |
| Ausgabe gelöscht | der Beleg geht mit |
| Beleg gelöscht | die Ausgabe bleibt |
| Größe | längste Kante 1800 px, höchstens 500 kB |

**Der Bon wird nicht gelesen.** Den Betrag trägt man von Hand ein; der Beleg
ist zum *Nachschauen* da – was war im Einkauf, und stimmt die Summe.
Zeichenerkennung im Browser ist bei Kassenbons unzuverlässig, und ein Dienst
im Netz kommt nicht in Frage: Dessen Schlüssel müsste in eine öffentlich
einsehbare Seite, wo ihn jeder benutzen könnte.

Die Auflösung ist höher angesetzt als beim persönlichen Foto und die
Kompression beginnt sanfter – auf einem Kassenbon steht Kleingedrucktes, und
bei Text fällt jede Stufe sofort auf. Die 500 kB sind kein Zierwert: Ein
Firestore-Dokument fasst 1 MB, und als Base64 wächst das Bild um ein Drittel.

Belege liegen in einer eigenen Sammlung, nicht im Ausgabendokument. Sonst
schriebe jede Korrektur am Betrag das ganze Bild neu durch die Leitung.

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

### Abonnieren statt einlesen

Outlook und andere Kalender lassen sich als Adresse veröffentlichen. Ist eine
hinterlegt, versucht der Planer **einmal die Woche**, sie selbst zu holen –
beim Öffnen, wenn seit dem letzten Mal sieben Tage vergangen sind. Im
Hintergrund läuft nichts; einen Server, der zwischendurch etwas täte, gibt es
nicht.

**Ob das überhaupt geht, entscheidet der Kalenderanbieter, nicht der Planer.**
Ein Browser darf eine fremde Adresse nur lesen, wenn deren Server das
ausdrücklich erlaubt – Outlook tut das in der Regel nicht. Das Abo ist
deshalb ein *Versuch mit ehrlichem Ausgang* und kein Versprechen: Die
Einschränkung steht über dem Eingabefeld, nicht als Fußnote danach, und der
Weg über die Datei bleibt daneben stehen.

| Fall | Verhalten |
| --- | --- |
| `webcal://` | wird zu `https://` – Outlook und Apple geben die Adresse gern so heraus |
| Unbrauchbare Adresse | wird sofort abgewiesen, nicht erst nach einer Woche |
| Browser darf nicht | steht als Satz da, samt Verantwortlichem: „Das entscheidet der Anbieter des Kalenders" |
| Anmeldeseite statt Kalender | wird als solche erkannt – sonst stünde dort „nichts Neues" und niemand wüsste, warum |
| 404, 403, 5xx | jeweils in einem Satz, nicht als Zahl |
| Zweiter Lauf | legt nichts doppelt an; Doppel erkennt der Import an der Kennung |
| Nach einem Fehlschlag | wird in derselben Sitzung nicht erneut versucht – von Hand jederzeit |

Warum die Fehlermeldungen so viel Aufmerksamkeit bekommen: **Ein Abgleich,
der stumm scheitert, ist schlimmer als keiner.** Man verlässt sich darauf und
merkt es am verpassten Termin.

Die Adresse liegt bei den Einstellungen und wird damit im Haushalt geteilt –
anders als der Schlüssel des Assistenten. Der Unterschied ist Absicht: Ein
API-Schlüssel kostet Geld, diese Adresse führt nur zu Terminen, die im Planer
ohnehin beide sehen.

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
| Der Satz brach mittendrin ab | Die Erkennung endet bei der ersten Atempause – aus „Zahnarzttermin am Dienstag … um zehn" wurde nur der erste Teil. |
| Eine Aufnahme sah kaputt aus | Am Handy meldet die Erkennung ständig `no-speech`; jede Pause reicht. Das wurde als Fehler angezeigt. |
| Das Diktat riss ab | Android beendet die Sitzung gern von sich aus, mitten im Satz. |
| Der Knopf wurde übersehen | Ein rundes Feld mit einem Symbol darin liest sich als Verzierung, nicht als Knopf. |
| **Der Knopf tat gar nichts** | `start()` lief ins Leere: kein `onstart`, kein `onerror`, kein geworfener Fehler. Genau so verhält sich Chrome, wenn der Planer vom Startbildschirm als App läuft und niemand nach dem Mikrofon gefragt hat. |
| **Der Satz war zu sehen und kam trotzdem nicht an** | Android markiert beim Beenden nicht immer ein Endergebnis. Gewertet wurde nur Endgültiges – das Gesprochene war weg. |
| **Das Mikrofon ging an, es kam nichts** | Der Versuch, den abgebrochenen Satz mit `continuous` zu lösen. Chrome auf Android kennt das Merkmal, tut damit aber nichts Sinnvolles: Die Sitzung startet und liefert nie ein Ergebnis. Am Bildschirm fiel das nicht auf. |

Den langen Satz trägt deshalb die **Neustart-Schleife**, nicht der
Dauerbetrieb: Die Erkennung endet nach jedem Satzteil von selbst, das Gehörte
wird gesammelt, und solange niemand gestoppt hat, geht es weiter – bis zu
zwölfmal, wobei jedes verstandene Wort den Zähler zurücksetzt. Eine Mechanik
statt zweier, und sie funktioniert überall gleich.

Beendet wird über eine **Stille-Uhr**: zweieinhalb Sekunden nach dem letzten
Wort, sieben Sekunden vor dem ersten – das Antippen, Ansetzen und Überlegen
kostet mehr als zweieinhalb. `no-speech` und `aborted` gelten nicht als
Fehler.

Der Knopf ist ein gefüllter Balken mit Beschriftung: **🎤 Diktieren**, beim
Aufnehmen rot und **■ Fertig**.

#### Sehen, ob es geklappt hat

Das Rückmeldefeld war zu unscheinbar – gemeldet als *„läuft, aber ist nur
ganz klein unten sichtbar"*. Drei Dinge waren daran falsch:

1. **Zu klein und zu blass.** Das Gehörte stand abgeblendet und in derselben
   Größe wie jede Fußnote. Jetzt in Lesegröße und voller Farbe; das Ergebnis
   („2 l Milch · 1× Brot · 3,00 €") sticht heraus, denn das ist die Antwort
   auf die Frage, wegen der man hinschaut.
2. **„Übernehmen" ragte aus dem Bildschirm** – ausgerechnet der Knopf, auf
   den es ankommt. Die Knopfreihe bricht jetzt um.
3. **Im Zoom war es gar nicht zu sehen.** `position: fixed` hängt am
   *Layout*-Viewport. Wer am Handy hineinzoomt, sieht einen kleineren
   Ausschnitt, der wandert – das feste Feld bleibt, wo es war, und liegt
   dann außerhalb. Gemessen: Feld bei y 676–763, sichtbar war 0–419.

Deshalb richten sich das Diktierfeld **und** der Rückgängig-Streifen jetzt
an [`visualViewport`](./src/hooks/useVisualViewport.ts) aus, dem tatsächlich
sichtbaren Ausschnitt. Ungezoomt bleiben sie über der Navigationsleiste; im
Zoom rücken sie an den unteren Rand des Sichtbaren, wo von der Leiste ohnehin
nichts zu sehen ist.

Ein Ausgleich für den Zoomfaktor wäre falsch: Wer hineingezoomt hat, will
alles größer sehen, die Rückmeldung eingeschlossen.

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
4. **Eine Aufnahme ohne Ergebnis endet nicht stumm.** Lief das Mikrofon und
   kam trotzdem nichts an, steht das da – samt Vermutung, woran es liegt.

## Papierkorb

Bis hierher war jedes Löschen sofort und endgültig – und über die
Synchronisation eine Sekunde später auch beim anderen weg. Ein Fehlgriff am
Handy war damit nicht mehr zu retten, und gerade dort passiert er: Das Kreuz
zum Löschen sitzt einen Daumen neben dem Häkchen zum Abhaken.

Deshalb zwei Wege zurück:

1. **Der Streifen.** Direkt nach dem Löschen steht unten *„Einkauf
   „Bohrmaschine" gelöscht – Rückgängig"*, neun Sekunden lang. Er erscheint
   nur auf dem Gerät, auf dem gelöscht wurde; beim anderen wäre er eine
   Meldung über etwas, das dort niemand getan hat.
2. **Der Papierkorb** unter *Mehr*. Er zeigt sich nur, wenn etwas drin liegt –
   man geht nicht in ihn hinein, man sucht ihn im Notfall.

| Fall | Verhalten |
| --- | --- |
| Frist | 30 Tage, dann verschwindet der Eintrag von selbst |
| Aufräumen | beim Laden, nicht im Hintergrund – ein Aufräumen, das niemand angestoßen hat, ist schwer nachzuvollziehen |
| Obergrenze | 100 Einträge, damit der Papierkorb nicht zum zweiten Datenbestand wird |
| Wer zurückholt | jeder von beiden; der Papierkorb wird mit abgeglichen |
| Am Eintrag steht | was es war, wann, von wem, und wie lange es noch bleibt |
| Leeren | fragt nach – es ist der einzige Griff, den der Papierkorb selbst nicht mehr auffängt |

**Was zusammengehört, kommt zusammen zurück.** Eine Ausgabe nimmt ihren Beleg
mit, eine Reise ihre Packliste. Käme nur die Ausgabe zurück, wäre das
Wiederherstellen ein halbes – und niemand bemerkte den fehlenden Beleg, bis
er ihn braucht.

Erfasst sind Aufgaben, Termine, Einkaufspositionen, Ausgaben, Belege,
Jahrestage und Reisen. Nicht erfasst sind Dinge, deren Löschen ohnehin
nachfragt oder nichts vernichtet – etwa ein Bereich, dessen Einträge auf
einen anderen umziehen.

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

## Wo seid ihr

„Wo bist du gerade?" – der zuletzt gemeldete Standort der anderen Person,
mit dem **Alter** daneben und einem Link auf die Karte.

**Für einen echten Notfall genügt das nicht, und das steht auch so in der
App.** Ein Browser darf den Standort nicht im Hintergrund melden; liegt der
Planer zu, bleibt der letzte Stand stehen und kann Stunden alt sein. Dafür
gibt es die Standortfreigabe des Handys – bei Android in Google Maps, bei
iPhone „Wo ist?". Die läuft im Hintergrund und ist dafür gemacht. Diese
Anzeige beantwortet *„wo bist du gerade"*, nicht *„finde mich im Ernstfall"*.

Drei Regeln tragen den Rest:

1. **Jeder schaltet nur für sich ein.** Die Freigabe liegt auf dem Gerät,
   nicht im Haushalt – niemand kann sie für den anderen setzen. Eine
   Standortfreigabe, die einer für den anderen aktivieren kann, bildet kein
   Vertrauensverhältnis ab, sondern eine Überwachung.
2. **Wer teilt, sieht das durchgehend.** Solange gesendet wird, steht es da.
   Ein Mitlesen, das man vergisst, ist keins mehr.
3. **Kein Verlauf.** Gespeichert wird genau der letzte Stand je Person. Eine
   Spur der letzten Wochen wäre etwas anderes – und sie wäre nicht mehr
   wegzubekommen.

| Fall | Verhalten |
| --- | --- |
| Standard | aus; eine Ortung, in die man hineinrutscht, ist keine Einwilligung |
| Abschalten | nimmt auch den letzten Punkt zurück – sonst wäre „aus" nur „ab jetzt nichts Neues mehr" |
| Im Hintergrund | wird die Ortung abgeschaltet; ein GPS in einem Tab, den niemand ansieht, will man nicht |
| Kleines Zucken | wird nicht gemeldet – erst ab 120 m oder nach 10 Minuten |
| „Ich bin hier" | ein einzelner Standort ohne dauerhafte Freigabe |
| Wer bin ich | wird gewählt, nicht geraten: Ein Fehlgriff hieße, den eigenen Ort unter fremdem Namen zu melden |
| Alter | steht in Lesegröße neben dem Namen – ein Punkt ohne Zeitangabe wird für „jetzt" gehalten |
| Ortung abgelehnt | wird erklärt, samt Ort der Abhilfe |

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

## Am Handy

Der Planer ist fürs Handy gedacht, also wird das auch gemessen statt
behauptet. Ein Durchlauf geht alle sechs Ansichten am Pixel 7 durch und
prüft dreierlei: Ist jedes Bedienelement **mit dem Daumen zu treffen**,
läuft nichts über den rechten Rand, und muss man seitwärts scrollen.

Gemessen wird die **Trefferfläche**, nicht der Kasten: Ein Häkchen darf klein
aussehen, solange ein danebengesetzter Daumen es noch erwischt, und eine
Beschriftung zählt mit – ein Tipp darauf schaltet es ja auch.

Beim Bau dieser Messung sind mir drei Fehler *in der Messung* unterlaufen,
die alle dasselbe Muster hatten – sie war zu nachsichtig und deshalb grün:

| Fehler | Wirkung |
| --- | --- |
| Treffer auf Elternelemente gelten lassen | fast alles bestand, auch 38-px-Knöpfe |
| in die Ecken gemessen | runde Ecken haben dort keine Fläche – 44 × 44 galt als zu klein |
| Verdecktes mitgemessen | was hinter der Navigationsleiste liegt, ist nicht kaputt, sondern scrollbar |

Der erste Lauf fand 44 zu kleine Bedienelemente und drei Knöpfe außerhalb
des Bildes – „Alles zurücksetzen" endete bei 474 von 412 Pixeln. Behoben
sind unter anderem:

- Kopfzeile und Blätterpfeile von 38 auf 44 px
- das Häkchen im Einkauf – der meistbenutzte Knopf der App – von 21 auf 28 px sichtbar, 40 px Fläche
- der Farbtupfer am Bereich, der in der engen Zeile auf 14 px zusammengedrückt wurde
- „Hinzufügen" und „Alles zurücksetzen", die aus dem Bild liefen
- die Jetzt-Marke im Tagesplan, die auf der Stundenmarke lag: Ist es gerade neun, standen „09:00" und „09:00" übereinander

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

### Wärme, nachgemessen

Die Neutraltöne galten von Anfang an als „warm". Nachgemessen stimmte das nur
zur Hälfte: Ein Farbwinkel sagt, in welcher Familie ein Ton liegt, und die
Grundtöne lagen bei **67 bis 83 Grad** – das ist Oliv, nicht Sand. Am
deutlichsten im Dunkelmodus, wo alle vier Flächen dort lagen. Einzeln fällt so
etwas nicht auf; zusammen sieht es aus, als sei der Bildschirm schmutzig.

Jetzt liegen alle Grundtöne zwischen **30 und 40 Grad**, in der Familie von
Hafer, Sand und Umbra:

|                | vorher                    | jetzt                      |
| -------------- | ------------------------- | -------------------------- |
| Grund, hell    | `#f4f1e9` (44°)           | `#f1eae0` (35°)            |
| Karte, hell    | `#fffefa` – fast Weiß     | `#fcfaf6` – gebrochen weiß |
| Schrift, hell  | `#23241e` (70°, oliv)     | `#2a231c` (30°, Umbra)     |
| Grund, dunkel  | `#171814` (75°, oliv)     | `#17130f` (30°, Nachtbraun)|
| Karte, dunkel  | `#1f211b` (80°)           | `#201b15` (33°)            |

Reines Weiß als Kartenfläche ist dabei mitgegangen: Neben einem warmen Grund
wirkt es wie ein Loch. Die Signalfarben sind eine Spur dunkler, weil der neue
Grund dunkler ist – ohne Nachziehen wäre der Abstand zur Schrift kleiner
geworden. Warnung (**3,35:1**) und Erledigt (**4,08:1**) lagen vorher unter der
Grenze von 4,5:1 und liegen jetzt darüber.

Der Prüflauf *Gestaltung* rechnet den Farbwinkel jedes Grundtons nach und
schlägt an, wenn einer die warme Familie verlässt. Gegen die alten Werte
gehalten meldet er sie alle sechs.

### Tiefe

Ein Schlagschatten ist im Dunkelmodus kaum sichtbar – der Grund ist schon
dunkel. Deshalb trägt die Fläche die Tiefe. Karten bekommen zusätzlich ein
`--lift`, das in beiden Modi dasselbe meint und Verschiedenes tut: am Tag ein
sehr flacher, warm getönter Schatten, nachts eine hauchdünne Lichtkante oben.

Zwei Stellen entlastet das sichtbar:

- **Die Stundenlinien im Tagesplan** liegen jetzt auf der leisen Linienfarbe.
  Vorher hatten die zehn Striche eines Vormittags dieselbe Stärke wie der Rahmen
  einer Karte – man sah zuerst das Raster und dann erst den Tag.
- **Ein leerer Wochentag tritt zurück**, statt als große weiße Karte mit dem
  Wort „frei" dazustehen. Bei einer ruhigen Woche gingen die beiden Tage, um die
  es ging, zwischen fünf gleich schweren Kästen unter. Der Rahmen bleibt – man
  muss ja etwas darauf ziehen können –, nur leiser.

**Karten tragen eine Kante statt drei Signale.** Aufgaben hatten Rahmen,
farbige Kante und eigene Fläche zugleich; alle drei sagten dasselbe. Geblieben
ist die farbige Kante für den Bereich – und seit einer Runde die Fläche selbst:
Ein Bildschirm voller Karten mit je drei farbigen Pixeln am Rand sieht grau
aus, obwohl das Programm sechs Farben kennt. Zwölf Prozent Bereichsfarbe im
Grund sind wenig genug, dass die Schrift ihren Abstand behält, und genug, dass
man beruflich von privat auf einen Blick unterscheidet. Gewählte Filter sind
aus demselben Grund gefüllt statt nur umrandet: Bei vier Schaltern
nebeneinander war die Randfarbe allein eine Nuance, keine Aussage.

**Inhalt zuerst, Handlung darunter.** In der 344 px breiten Poolkarte blieben
dem Titel neben Griff, Häkchen und „Einplanen" nur 149 px – „Steuererklärung"
brach mitten im Wort. Über zwei Zeilen sind es 254 px.

### Gleichzeitige Termine auf dem Handy

Dasselbe Problem, eine Ebene tiefer. Laufen auf der Zeitachse drei Termine
gleichzeitig, teilen sie sich die Breite. Auf einem Pixel 7 stand dann:

> **Z…**  **T…**  **Elte…**

Ein Kalender, der nicht sagt, um welchen Termin es geht, beantwortet die
einzige Frage nicht, wegen der man ihn aufmacht.

Nachgemessen war der Block 99 px breit. Davon gingen **45 px an Rand und
Ziehgriff**, für den Titel blieben 54. „Zahnarzt" braucht 76, „Elternabend"
103, „Team-Besprechung" 161. Dazu kam die Zeitangabe: „09:00–10:00 · 1 h"
brach in einem so schmalen Block auf drei Zeilen um und war **56 px hoch, bei
einer Blockhöhe von 78** – sie hat den Titel verdrängt, den sie erklären
sollte.

Vier Änderungen, alle nur am Handy – am Rechner bleibt selbst bei vier Spalten
jeder Titel vollständig lesbar:

| | |
| --- | --- |
| Der Titel bricht um | statt abgeschnitten zu werden |
| Wie viele Zeilen, wird gerechnet | aus der Blockhöhe, nicht geraten |
| Die Zeitangabe nennt nur den Anfang | „ab 09:00"; das Ende steht an der Achse |
| Der Ziehgriff schrumpft, ab drei Spalten weicht er | 30 px von 99 waren ein Drittel des Blocks |

Das Ergebnis, gemessen:

| | vorher | jetzt |
| --- | --- | --- |
| 2 gleichzeitig | „Team-Bespr…" | beide vollständig |
| 3 gleichzeitig, 1 h | keiner vollständig | zwei von drei |
| 3 gleichzeitig, 2 h | keiner vollständig | alle drei |
| 4 gleichzeitig | keiner vollständig | drei von vier |

Die gerechnete Zeilenzahl ist der Grund für Zeile drei: derselbe Titel,
dieselbe Spaltenbreite, nur zwei Stunden statt einer – und was vorher fehlte,
steht vollständig da. Mit einer festen Zwei bliebe „Team-Besprechung"
abgeschnitten, obwohl darunter leerer Block ist.

**Was bleibt:** Ein langes Wort in einer 80 px schmalen Spalte passt in einer
Stunde nicht, auch umgebrochen nicht. `hyphens: auto` steht im Stylesheet und
hilft dort, wo der Browser ein deutsches Trennwörterbuch mitbringt – der
Prüfbrowser hier hat keines, verlassen kann man sich darauf also nicht. Der
volle Titel steht immer im Termin selbst, ein Tipp entfernt.

Der Prüflauf *Gleichzeitiges* misst das nach. Gegen den alten Stand gehalten
meldet er sieben Fehler; die beiden Prüfungen für den Rechner bleiben dabei
grün, weil dort nie etwas kaputt war.

### Die Jahrestage am Handy

Gemeldet als „die Ansicht bei den Geburtstagen ist nicht schön". Nachgesehen
auf einem Pixel 7 war sie nicht unschön, sondern kaputt:

- Der Titel brach **wortweise** um: „TÜV / am / Auto", „Mama / wird / 64".
- Die Personen-Schalter lagen **über** dem Text.
- Das Auswahlfeld für die Ankündigung ragte aus dem Bild.
- Und im Formular darunter war das Feld, in das man den Namen tippt,
  **27 Pixel breit**.

Zwei Ursachen, beide dieselbe Regel:

**`min-width: 0` auf `.field`.** In einer umbrechenden Reihe heißt das:
schrumpfen statt umbrechen – ein Kasten mit `min-width: 0` wird lieber beliebig
schmal, als in die nächste Zeile zu gehen. Jetzt `min(100%, 140px)`: eine
Untergrenze, die sich zurücknimmt, wo der Kasten selbst schmaler ist. Schmale
Felder wie „Tag" behalten ihre 108 px, sonst bläht es die Dialoge am Rechner
auf.

**Fünf Dinge in einer Flex-Reihe.** Symbol, Anlass, wen es betrifft, wann
angekündigt wird, Löschen – auf 412 px. Die Zeile ist jetzt ein Raster mit
benannten Feldern: am Rechner eine Reihe, am Handy drei. Ein Raster kann
umsortieren, wo eine Flex-Reihe nur quetschen kann.

Der Prüflauf *Jahrestage* misst seither, ob der Titel die Breite der Karte
bekommt – nicht, ob er in eine Zeile passt. Das ist der Unterschied: Ein
wirklich langer Anlass *darf* umbrechen, falsch ist erst, wenn er mehr Zeilen
braucht als nötig. Verglichen wird gegen einen Zwilling in voller Kartenbreite.
Gegen den alten Stand gehalten: **237 px statt 53**, und das Namensfeld
**27 px statt 147**.

### Passwort vergessen

Die Anmeldung steht vor allem anderen: Wer das Passwort nicht mehr weiß, kommt
an keine Einstellung heran, auch nicht an die, die ihm helfen würde. Genau dort
gab es keinen Ausweg – aufgefallen, als nach dem Löschen der Browser-Ablage die
Anmeldung weg war.

Jetzt steht unter der Anmeldemaske *Passwort vergessen?*. Zwei Entscheidungen
darin sind nicht selbstverständlich:

- **Ohne Adresse passiert nichts, und es steht dabei, warum.** Ein Knopf, der
  bei leerem Feld weder etwas tut noch etwas sagt, ist schlimmer als keiner.
- **Die Bestätigung verrät nicht, ob es das Konto gibt.** Die Seite ist
  öffentlich; wer fremde Adressen durchprobiert, soll daraus nicht ablesen
  können, wer hier ein Konto hat. Firebases `auth/user-not-found` wird deshalb
  verschluckt und wie ein Erfolg behandelt. Der Preis: Wer sich vertippt,
  wartet auf eine Mail, die nie kommt – darum steht der Hinweis auf die
  Schreibweise direkt in der Bestätigung.

Ob Firebase die Mail wirklich verschickt, kann kein Prüflauf hier feststellen –
dafür bräuchte es ein echtes Projekt. Prüfbar ist der Weg dorthin: Der Lauf
*Passwort-Weg* fängt die Anfrage an Google ab und liest nach, dass sie als
`PASSWORD_RESET` für die eingetragene Adresse rausgeht. Das ist mehr wert als
ein Klick ins Leere.

### Wohin die Höhe geht

Gemeldet nach dem Umstieg auf die Handy-Ansicht: alles zu groß, man sieht nicht
mehr alles. Nachgemessen auf einem Pixel 7 in der Tagesansicht: Von 839 Zeilen
gingen **535 an Leisten – 64 Prozent**, für den Tagesplan blieben 304. Die
Unterleiste allein brauchte 286 Zeilen in fünf Reihen: Mikrofon, Datum,
Bereichsfilter, Personenfilter, Auslastung.

Zwei Dinge wurden dabei gemessen und **verworfen**:

- **Mikrofon und Datumszeile in eine Reihe**: brauchen zusammen 475 px,
  verfügbar sind 380.
- **Die Schrift verkleinern**: Sie ist am Handy gar nicht größer. Von allen
  Textelementen sind genau zwei 13,5 statt 12 px – es liegt nicht an der
  Schrift, sondern an Leisten und Abständen.

Geblieben ist: Die beiden Filterreihen werden zu **einer seitlich schiebbaren
Reihe**. Filter ändert man selten, der angeschnittene Rand zeigt, dass es
weitergeht. Dazu kleinere Abstände *zwischen* den Bedienelementen – die
Tippziele selbst bleiben bei 44 px, darüber wacht der Prüflauf *Handy-Maße*.

| Ansicht | Inhalt vorher | jetzt |
| --- | --- | --- |
| Tag | 304 px (36 %) | 388 px (46 %) |
| Woche | 389 px | 469 px |

**Zweiter Durchgang: sichtbar kleiner, antippbar gleich groß.** Die Rückmeldung
darauf lautete „etwas zu groß dargestellt" – nachgemessen war der gewöhnliche
Knopf 52 px hoch, das Mikrofon ebenso. Die 44 px gelten aber für die
*Trefferfläche*, nicht für das, was man sieht. Ein aufgesetztes `::after`
streckt die Fläche über den sichtbaren Rand hinaus; `elementFromPoint` liefert
dort weiterhin den Knopf, und *Handy-Maße* bemerkt keinen Unterschied.

Gestreckt wird nur senkrecht: Waagerecht stehen die Knöpfe dicht nebeneinander,
und sich überlappende Trefferflächen wären genau das Vertippen, gegen das die
44 px gedacht sind.

| | sichtbar vorher | jetzt | antippbar |
| --- | --- | --- | --- |
| Knopf | 52 px | 44 px | 48 px |
| Filterschalter | 44 px | 38 px | 44 px |
| Karteikarte | 47 px | 40 px | 46 px |

Damit sind es in der Tagesansicht **427 px** für den Plan statt der
ursprünglichen 304 – 40 Prozent mehr, ohne dass ein Tippziel kleiner geworden
wäre.

Der Prüflauf *Breiten* musste dafür zweimal nachgeschärft werden, und beide
Male war er vorher grün, ohne etwas zu prüfen:

1. Er legte **keine Personen an** – mit nur zwei Bereichsschaltern passt der
   Streifen überall hinein. In einem Haushalt mit zwei Personen hätte er
   Fehlalarm geschlagen.
2. Die Ausnahme für schiebbare Reihen war **zu weit gefasst**. Laut
   Spezifikation bekommt ein Kasten mit `overflow-y: auto` automatisch auch
   `overflow-x: auto` – nachgemessen ist das bei `.timeline-scroll` der Fall.
   Die Ausnahme hätte damit den gesamten Tagesplan von der Randprüfung
   ausgenommen. Verlangt wird jetzt, dass der Kasten wirklich seitwärts zu
   schieben ist.

Dazu die Gegenprüfung, dass alle vier Filterschalter im Streifen erreichbar
bleiben – eine Ausnahme von der Randprüfung ohne diese zweite Messung wäre eine
Einladung, Bedienelemente unerreichbar zu machen.

### Was aus dem Bild lief

Gemeldet als Foto vom Handy: Die Synchron-Anzeige stand mitten im Wort
abgeschnitten am rechten Rand, Themenschalter und „?" fehlten ganz.

Nachgemessen brauchte die Rechner-Kopfleiste **1110 px** – Marke, sechs
Reiter, Suche, Synchron-Anzeige, Themenschalter und Hilfe nebeneinander, ohne
jede Möglichkeit zu schrumpfen. Betroffen war damit **jede Breite zwischen 861
und 1110 px**, also der gesamte Bereich, in dem das Rechner-Layout überhaupt
greift, bevor ein üblicher Bildschirm anfängt. Über Monate niemandem
aufgefallen, weil immer nur bei 1440 px und am Handy geprüft wurde.

Der neue Prüflauf *Breiten* geht deshalb nicht eine Breite durch, sondern zwölf
zwischen 320 und 1440 px, und in jeder vier Ansichten. Er prüft zweierlei:
dass sich die Seite nicht seitwärts schieben lässt, und dass kein einzelnes
Element über den Rand ragt – das zweite braucht es, weil ein Element mit
`overflow: hidden` darüber die Seite nicht breiter macht, sein Inhalt aber
trotzdem verschwindet.

Gegen den alten Stand gehalten meldet er **14 Fehler**, darunter zwei, nach
denen niemand gesucht hatte:

- Bei **360 px** – einer sehr verbreiteten Android-Breite – lief der
  „?"-Knopf über den rechten Rand.
- Bei **320 px** ragten zusätzlich die Datumszeile und der Mikrofonknopf
  hinaus.

Behoben durch Umbruch statt fester Zahlen: Kopfleiste, Datumszeile und
Kartenkopf dürfen umbrechen. So kann bei keiner Breite etwas überlaufen, auch
nicht bei einer, an die niemand gedacht hat.

**Dazu die Aussparungen des Geräts.** `viewport-fit=cover` lässt die Seite
unter Statusleiste und Navigationsleiste laufen; nur die untere Leiste hat das
bisher berücksichtigt. Kopfleiste, Datumszeile und Inhalt rechnen jetzt
`env(safe-area-inset-*)` mit ein – auf einem Bildschirm ohne Aussparungen ist
der Wert null.

Und die Farbe der Systemleiste stand noch auf `#0f1115`, einem kalten
Blaugrau aus einer Palette von vor zwei Runden. Sie wird an drei Stellen von
Hand gepflegt – `index.html`, das Skript darin und `manifest.webmanifest` –
und ist damit die erste, die beim Umfärben vergessen wird. Genau das war
passiert.

### Warum manche Tage dunkler waren

Gefragt worden nach einem Blick in die Monatsansicht: „Manche Tage werden
dunkler dargestellt, was ist der Grund?" Zwei Dinge waren es, beide gewollt –
Tage aus dem Nachbarmonat wurden abgeblendet, Wochenenden liegen eine Fläche
höher. Beim Nachmessen kamen zwei Dinge heraus, die nicht gewollt waren.

**Die beiden Signale hoben sich gegenseitig auf.** 45 Prozent von
`--bg-elev-2` ergeben im Dunkelmodus genau `--bg-elev`. Ein Samstag im
Nachbarmonat sah damit aus wie ein gewöhnlicher Dienstag des laufenden Monats –
die Aussage „gehört nicht zu diesem Monat" verschwand für zwei Zellen je Monat
vollständig. Im Hellmodus trat das nicht auf, weshalb es nur auffiel, wer
nachts plant.

**Die Abblendung nahm die Schrift mit.** Nachgerechnet:

| Text in einer Nachbarmonat-Zelle | dunkel | hell |
| --- | --- | --- |
| Tageszahl | 3,79 : 1 | 2,54 : 1 |
| Eintragstitel | 3,63 : 1 | – |
| Uhrzeit davor | 2,16 : 1 | – |

Überall sonst hält sich die App an 4,5 : 1.

Jetzt trägt die Fläche das Zurücktreten: Ein Randtag liegt auf dem Grund der
Seite, wie ein leerer Wochentag in der Wochenansicht. Die Schrift bleibt bei
voller Deckkraft, nur gedämpft. Dieselbe Abblendung stand am Handy auf den
leeren Wochentagen – dort war das Datum, also der Knopf zum Öffnen des Tages,
bei 3,22 : 1. Auch weg.

Der Prüflauf *Monatsansicht* misst seither die Fläche so, wie sie wirklich auf
dem Schirm landet, und verlangt, dass sich alle vier Zellarten unterscheiden.

### Kontrast

Nachgemessen und behoben:

- Gedämpfter Text auf erhöhten Karten kam im Hellmodus auf **4,21:1** und lag
  damit unter der Grenze von 4,5:1. Betroffen war die Meta-Zeile jeder
  Aufgabe.
- Weiße Schrift auf der Akzentfläche kam im **Dunkelmodus** auf **3,04:1** –
  dort ist der Akzent aufgehellt, damit er sich vom dunklen Grund abhebt, und
  genau das macht Weiß darauf schlecht lesbar. `--on-accent` ist deshalb hell
  im Hellmodus und dunkel im Dunkelmodus.

Der Prüflauf *Gestaltung* misst alles drei bei jedem Durchgang: Schriftgrößen
gegen die Skala, Kontrast jedes sichtbaren Textes gegen die Fläche, auf der er
tatsächlich liegt, und den Farbwinkel jedes Grundtons gegen die warme Familie.

**Er rechnet Deckkraft mit.** Das tat er jahrelang nicht – er las die vollen
Farbwerte und übersah, dass ein `opacity` darüber Schrift *und* Fläche
abblendet. Genau dort saßen die Randtage der Monatsansicht mit 2,54 : 1,
während hier „alles grün" stand. Ein Blindfleck im Messgerät ist schlimmer als
eine fehlende Messung: Er erzeugt Vertrauen, das nicht gedeckt ist. Ausgenommen
bleiben nur `:disabled`-Elemente – ein blasser Knopf sagt „geht gerade nicht",
und WCAG 1.4.3 nimmt inaktive Bedienelemente ausdrücklich aus.

**Und die Monatsansicht wird überhaupt erst geprüft.** Sie ist keine eigene
Lasche, sondern eine Karteikarte im Wochenreiter, und fiel deshalb durch das
Raster dieser Prüfung.

**Und er prüft sich selbst.** Als die Karten die Bereichsfarbe auf die Fläche
bekamen, meldete er Kontraste von **1,35:1** an Stellen, die in Wahrheit über
9:1 lagen. Der Fehler lag im Messgerät: Sobald ein `color-mix()` im Spiel ist,
gibt der Browser `color(srgb 0.83 0.83 0.84)` zurück statt `rgb(212, 213,
215)` – dieselbe Farbe, von 0 bis 1 gezählt statt von 0 bis 255. Wer das nicht
unterscheidet, hält 0,83 für Schwarz. Ein Prüfgerät, das falschen Alarm
schlägt, ist so schädlich wie eines, das schweigt: Beim nächsten Mal glaubt man
ihm nicht. Seither rechnet der Lauf zuerst Schwarz auf Weiß in beiden
Schreibweisen nach und muss auf 21:1 kommen, bevor er irgendetwas anderes
behauptet.

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
| `/` | Suche über alles |
| `k` | Assistent fragen |
| `h` | hell/dunkel umschalten |
| `?` | Kurzhilfe |

## Aufbau

```
src/
  domain/       Fachlogik ohne UI – Datumsrechnung, Wiederholungsmuster,
                Kollisions-Layout, Lückensuche, Sprach-Deutung, Preisgedächtnis,
                Bildaufbereitung, Feiertage, Urlaubsrechnung, Suche,
                Werkzeuge des Assistenten, Weckwort, Vorlesetext,
                Erinnerungen
  storage/      lokale Ablage (IndexedDB), der zentrale Zustand und die
                Einstellungen, die dem Gerät gehören
  sync/         Firebase-Anbindung: Anmeldung, Haushalt, Abgleich
  ai/           Zugang zum Sprachmodell – Schlüssel nur auf dem Gerät
  hooks/        Ziehen und Ablegen, Spracherkennung, Sprachausgabe,
                Weckwort, Medienabfragen, Aktualisierung der App
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
