import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIcs, parseIcs } from './ics';

const FENSTER_VON = '2026-01-01';
const FENSTER_BIS = '2027-12-31';

const kalender = (...zeilen: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...zeilen, 'END:VCALENDAR'].join('\r\n');

const termin = (...zeilen: string[]) => kalender('BEGIN:VEVENT', ...zeilen, 'END:VEVENT');

const lies = (text: string) => parseIcs(text, FENSTER_VON, FENSTER_BIS);

describe('Kalender lesen', () => {
  it('liest einen einfachen Termin', () => {
    const { events } = lies(
      termin('UID:abc', 'SUMMARY:Zahnarzt', 'DTSTART:20260806T090000', 'DTEND:20260806T100000'),
    );
    assert.equal(events.length, 1);
    assert.deepEqual(
      { ...events[0], location: undefined, description: undefined },
      {
        uid: 'abc',
        title: 'Zahnarzt',
        date: '2026-08-06',
        startMin: 9 * 60,
        durationMin: 60,
        allDay: false,
        location: undefined,
        description: undefined,
      },
    );
  });

  it('nimmt eine Stunde an, wenn Ende und Dauer fehlen', () => {
    const { events } = lies(termin('UID:a', 'SUMMARY:Kurz', 'DTSTART:20260806T090000'));
    assert.equal(events[0].durationMin, 60);
  });

  it('liest die Dauer aus DURATION', () => {
    const { events } = lies(
      termin('UID:a', 'SUMMARY:Lang', 'DTSTART:20260806T090000', 'DURATION:PT1H30M'),
    );
    assert.equal(events[0].durationMin, 90);
  });

  it('setzt lange Zeilen wieder zusammen', () => {
    /*
     * Der Standard bricht nach 75 Zeichen um und setzt die Zeile mit einem
     * Leerzeichen fort. Dieses Zeichen gehört zur Faltung und wird beim
     * Zusammensetzen entfernt – der Umbruch trifft deshalb oft mitten ins
     * Wort, und genau so muss er auch wieder verschwinden.
     */
    const { events } = lies(
      termin(
        'UID:a',
        'SUMMARY:Sehr langer Betreff der umgebro',
        ' chen wurde',
        'DTSTART:20260806T090000',
      ),
    );
    assert.equal(events[0].title, 'Sehr langer Betreff der umgebrochen wurde');
  });

  it('setzt auch mit Tabulator gefaltete Zeilen zusammen', () => {
    const { events } = lies(
      termin('UID:a', 'SUMMARY:Erster Teil und', '\tzweiter Teil', 'DTSTART:20260806T090000'),
    );
    assert.equal(events[0].title, 'Erster Teil undzweiter Teil');
  });

  it('löst die Maskierung in Texten auf', () => {
    const { events } = lies(
      termin(
        'UID:a',
        'SUMMARY:Team\\, Raum 3\\; oben',
        'DESCRIPTION:Zeile1\\nZeile2',
        'DTSTART:20260806T090000',
      ),
    );
    assert.equal(events[0].title, 'Team, Raum 3; oben');
    assert.equal(events[0].description, 'Zeile1\nZeile2');
  });

  it('lässt sich von einem Doppelpunkt im Parameterwert nicht täuschen', () => {
    const { events } = lies(
      termin('UID:a', 'SUMMARY:Test', 'DTSTART;TZID="Europe/Berlin":20260806T090000'),
    );
    assert.equal(events[0].date, '2026-08-06');
  });

  it('erkennt ganztägige Einträge', () => {
    const { events } = lies(
      termin(
        'UID:a',
        'SUMMARY:Geburtstag',
        'DTSTART;VALUE=DATE:20260806',
        'DTEND;VALUE=DATE:20260807',
      ),
    );
    assert.equal(events[0].allDay, true);
    assert.equal(events[0].startMin, null);
    assert.equal(events[0].date, '2026-08-06');
  });

  it('rechnet mehrtägige ganztägige Einträge richtig', () => {
    // DTEND ist bei ganztägigen Einträgen der erste Tag danach.
    const { events } = lies(
      termin('UID:a', 'SUMMARY:Urlaub', 'DTSTART;VALUE=DATE:20260806', 'DTEND;VALUE=DATE:20260810'),
    );
    assert.equal(events[0].durationMin, 4 * 24 * 60);
  });

  it('überspringt Alarme innerhalb eines Termins', () => {
    const { events } = lies(
      termin(
        'UID:a',
        'SUMMARY:Mit Wecker',
        'DTSTART:20260806T090000',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'SUMMARY:Erinnerung',
        'END:VALARM',
      ),
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].title, 'Mit Wecker');
  });

  it('lässt Termine außerhalb des Fensters weg', () => {
    const { events } = parseIcs(
      termin('UID:a', 'SUMMARY:Alt', 'DTSTART:20200101T090000'),
      FENSTER_VON,
      FENSTER_BIS,
    );
    assert.equal(events.length, 0);
  });

  it('meldet einen Termin ohne Beginn, statt ihn stillschweigend zu schlucken', () => {
    const { events, skipped } = lies(termin('UID:a', 'SUMMARY:Kaputt'));
    assert.equal(events.length, 0);
    assert.equal(skipped.length, 1);
  });
});

describe('Zeitzonen', () => {
  it('rechnet UTC in Ortszeit um', () => {
    // Der Test läuft in der Zeitzone der Maschine; verglichen wird deshalb
    // mit derselben Umrechnung, die auch die Anwendung anstellt.
    const { events } = lies(termin('UID:a', 'SUMMARY:UTC', 'DTSTART:20260806T070000Z'));
    const erwartet = new Date(Date.UTC(2026, 7, 6, 7, 0, 0));
    assert.equal(events[0].startMin, erwartet.getHours() * 60 + erwartet.getMinutes());
  });

  it('übernimmt eine Zeit ohne Zone so, wie sie dasteht', () => {
    const { events } = lies(termin('UID:a', 'SUMMARY:Schwebend', 'DTSTART:20260806T143000'));
    assert.equal(events[0].startMin, 14 * 60 + 30);
    assert.equal(events[0].date, '2026-08-06');
  });

  it('behält die Wanduhrzeit bei unbekannter Zeitzone', () => {
    const { events } = lies(
      termin('UID:a', 'SUMMARY:Fremd', 'DTSTART;TZID=Gibt/EsNicht:20260806T083000'),
    );
    assert.equal(events[0].startMin, 8 * 60 + 30);
  });
});

describe('Wiederholungen', () => {
  const daten = (...zeilen: string[]) => lies(termin(...zeilen)).events.map((e) => e.date);

  it('löst eine wöchentliche Regel mit Anzahl auf', () => {
    assert.deepEqual(
      daten('UID:a', 'SUMMARY:Jour fixe', 'DTSTART:20260806T090000', 'RRULE:FREQ=WEEKLY;COUNT=3'),
      ['2026-08-06', '2026-08-13', '2026-08-20'],
    );
  });

  it('beachtet BYDAY bei wöchentlichen Regeln', () => {
    // Start Donnerstag, 6.8.2026; gefragt sind Montag und Mittwoch.
    assert.deepEqual(
      daten(
        'UID:a',
        'SUMMARY:Standup',
        'DTSTART:20260806T090000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4',
      ),
      ['2026-08-10', '2026-08-12', '2026-08-17', '2026-08-19'],
    );
  });

  it('beachtet das Intervall', () => {
    assert.deepEqual(
      daten(
        'UID:a',
        'SUMMARY:Alle zwei Wochen',
        'DTSTART:20260806T090000',
        'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=3',
      ),
      ['2026-08-06', '2026-08-20', '2026-09-03'],
    );
  });

  it('hört bei UNTIL auf', () => {
    assert.deepEqual(
      daten(
        'UID:a',
        'SUMMARY:Bis',
        'DTSTART:20260806T090000',
        'RRULE:FREQ=DAILY;UNTIL=20260809T235959Z',
      ),
      ['2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'],
    );
  });

  it('lässt ausgenommene Tage weg', () => {
    assert.deepEqual(
      daten(
        'UID:a',
        'SUMMARY:Mit Lücke',
        'DTSTART:20260806T090000',
        'RRULE:FREQ=DAILY;COUNT=3',
        'EXDATE:20260807T090000',
      ),
      ['2026-08-06', '2026-08-08'],
    );
  });

  it('zählt einen geänderten Einzeltermin nicht doppelt', () => {
    /*
     * Outlook und Exchange schreiben die Serie und zusätzlich jeden
     * geänderten Einzeltermin – gleiche UID, dazu eine RECURRENCE-ID mit dem
     * Tag, den er ersetzt. Ohne dieses Wissen stünde der Tag zweimal da.
     */
    const { events } = lies(
      kalender(
        'BEGIN:VEVENT',
        'UID:serie',
        'SUMMARY:Jour fixe',
        'DTSTART:20260806T090000',
        'RRULE:FREQ=WEEKLY;COUNT=3',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:serie',
        'RECURRENCE-ID:20260813T090000',
        'SUMMARY:Jour fixe (verschoben)',
        'DTSTART:20260813T140000',
        'END:VEVENT',
      ),
    );
    assert.deepEqual(
      events.map((e) => `${e.date} ${e.startMin}`),
      ['2026-08-06 540', '2026-08-13 840', '2026-08-20 540'],
    );
  });

  it('gibt dem ersetzten Termin die Kennung des Tages, den er ersetzt', () => {
    // Sonst erkennt ein zweiter Import ihn nicht wieder.
    const { events } = lies(
      kalender(
        'BEGIN:VEVENT',
        'UID:serie',
        'SUMMARY:Jour fixe',
        'DTSTART:20260806T090000',
        'RRULE:FREQ=WEEKLY;COUNT=2',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:serie',
        'RECURRENCE-ID:20260813T090000',
        'SUMMARY:Verschoben',
        'DTSTART:20260813T140000',
        'END:VEVENT',
      ),
    );
    const verschoben = events.find((e) => e.title === 'Verschoben');
    assert.equal(verschoben?.uid, 'serie|2026-08-13');
  });

  it('lässt eine Serie ohne Ausnahmen unverändert', () => {
    const { events } = lies(
      termin('UID:a', 'SUMMARY:Standup', 'DTSTART:20260806T090000', 'RRULE:FREQ=DAILY;COUNT=3'),
    );
    assert.equal(events.length, 3);
  });

  it('überspringt den 31. in kurzen Monaten, statt in den Folgemonat zu rutschen', () => {
    assert.deepEqual(
      daten('UID:a', 'SUMMARY:Monatlich', 'DTSTART:20260131T090000', 'RRULE:FREQ=MONTHLY;COUNT=3'),
      ['2026-01-31', '2026-03-31', '2026-05-31'],
    );
  });

  it('löst jährliche Regeln auf', () => {
    assert.deepEqual(
      daten('UID:a', 'SUMMARY:Jährlich', 'DTSTART:20260806T090000', 'RRULE:FREQ=YEARLY;COUNT=2'),
      ['2026-08-06', '2027-08-06'],
    );
  });

  it('meldet eine Regel, die es nicht deutet, statt zu raten', () => {
    const { events, skipped } = lies(
      termin(
        'UID:a',
        'SUMMARY:Kompliziert',
        'DTSTART:20260806T090000',
        'RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=FR',
      ),
    );
    assert.equal(events.length, 0);
    assert.match(skipped[0], /BYSETPOS/);
  });

  it('erzeugt für jeden Tag eine eigene Kennung', () => {
    const { events } = lies(
      termin('UID:serie', 'SUMMARY:Serie', 'DTSTART:20260806T090000', 'RRULE:FREQ=DAILY;COUNT=2'),
    );
    assert.notEqual(events[0].uid, events[1].uid);
  });

  it('begrenzt eine Regel ohne Ende auf das Fenster', () => {
    const { events } = parseIcs(
      termin('UID:a', 'SUMMARY:Endlos', 'DTSTART:20260806T090000', 'RRULE:FREQ=DAILY'),
      '2026-08-06',
      '2026-08-10',
    );
    assert.deepEqual(
      events.map((e) => e.date),
      ['2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10'],
    );
  });
});

describe('Kalender schreiben', () => {
  const beispiel = [
    { uid: 'x1', title: 'Zahnarzt', date: '2026-08-06', startMin: 9 * 60, durationMin: 60 },
  ];

  it('schreibt eine gültige Grundstruktur', () => {
    const text = buildIcs(beispiel);
    assert.match(text, /^BEGIN:VCALENDAR\r\n/);
    assert.match(text, /END:VCALENDAR\r\n$/);
    assert.match(text, /BEGIN:VEVENT/);
    assert.match(text, /DTSTART:20260806T090000/);
    assert.match(text, /DTEND:20260806T100000/);
  });

  it('maskiert Sonderzeichen im Betreff', () => {
    const text = buildIcs([{ ...beispiel[0], title: 'Team, Raum 3; oben' }]);
    assert.match(text, /SUMMARY:Team\\, Raum 3\\; oben/);
  });

  it('schreibt Ganztägiges als reines Datum', () => {
    const text = buildIcs([
      {
        uid: 'x',
        title: 'Fortbildung',
        date: '2026-08-06',
        startMin: 0,
        durationMin: 0,
        allDay: true,
      },
    ]);
    assert.match(text, /DTSTART;VALUE=DATE:20260806/);
    // DTEND ist bei Datumsangaben der erste Tag danach – RFC 5545, 3.6.1.
    assert.match(text, /DTEND;VALUE=DATE:20260807/);
    assert.doesNotMatch(text, /DTSTART:2026/);
  });

  it('lässt eine mitgeschleppte Uhrzeit bei Ganztägigem weg', () => {
    /*
     * startMin und durationMin bleiben gespeichert, damit beim Zurückschalten
     * wieder dasteht, was vorher gewählt war. Hinausgehen dürfen sie nicht.
     * (DTSTAMP trägt zurecht eine Uhrzeit – deshalb gezielt die Zeitzeilen.)
     */
    const text = buildIcs([
      {
        uid: 'x',
        title: 'Umzug',
        date: '2026-08-06',
        startMin: 540,
        durationMin: 90,
        allDay: true,
      },
    ]);
    const zeitzeilen = text
      .split('\r\n')
      .filter((l) => l.startsWith('DTSTART') || l.startsWith('DTEND'));
    assert.deepEqual(zeitzeilen, ['DTSTART;VALUE=DATE:20260806', 'DTEND;VALUE=DATE:20260807']);
  });

  it('führt einen Termin über Mitternacht auf den Folgetag', () => {
    const text = buildIcs([
      { uid: 'x', title: 'Spät', date: '2026-08-06', startMin: 23 * 60, durationMin: 120 },
    ]);
    assert.match(text, /DTEND:20260807T010000/);
  });

  it('bricht lange Zeilen um', () => {
    const text = buildIcs([{ ...beispiel[0], title: 'A'.repeat(200) }]);
    for (const line of text.split('\r\n')) assert.ok(line.length <= 75, `zu lang: ${line.length}`);
  });

  it('liest einen langen Betreff nach dem Umbruch unverändert wieder', () => {
    const lang =
      'Besprechung mit sehr langem Betreff, der die Zeilenlänge deutlich überschreitet und umgebrochen werden muss';
    const { events } = lies(
      buildIcs([{ uid: 'lang', title: lang, date: '2026-08-06', startMin: 540, durationMin: 60 }]),
    );
    assert.equal(events[0].title, lang);
  });

  it('liest wieder, was es geschrieben hat', () => {
    const text = buildIcs([
      {
        uid: 'rund',
        title: 'Hin und zurück, mit Komma',
        date: '2026-08-06',
        startMin: 615,
        durationMin: 45,
      },
    ]);
    const { events } = lies(text);
    assert.equal(events.length, 1);
    assert.equal(events[0].title, 'Hin und zurück, mit Komma');
    assert.equal(events[0].startMin, 615);
    assert.equal(events[0].durationMin, 45);
  });
});

describe('Weckzeit in der Kalenderdatei', () => {
  const termin = {
    uid: 'x@test',
    title: 'Zahnarzt',
    date: '2026-08-11',
    startMin: 600,
    durationMin: 60,
  };

  it('schreibt keine Weckzeit, wenn keine gewünscht ist', () => {
    assert.doesNotMatch(buildIcs([termin]), /VALARM/);
    assert.doesNotMatch(buildIcs([{ ...termin, alarmMin: 0 }]), /VALARM/);
  });

  /*
   * Das Minus gehört vor das `P`, nicht vor die Zahl. Ein häufiger Dreher,
   * den manche Kalender stillschweigend verwerfen – und dann weckt nichts.
   */
  it('schreibt den Vorlauf in der Form, die Kalender annehmen', () => {
    const text = buildIcs([{ ...termin, alarmMin: 15 }]);
    assert.match(text, /TRIGGER:-PT15M/);
    assert.match(text, /BEGIN:VALARM/);
    assert.match(text, /END:VALARM/);
  });

  it('setzt die Weckzeit in den Termin, nicht daneben', () => {
    const zeilen = buildIcs([{ ...termin, alarmMin: 15 }]).split('\r\n');
    const anfang = zeilen.indexOf('BEGIN:VEVENT');
    const wecker = zeilen.indexOf('BEGIN:VALARM');
    const ende = zeilen.indexOf('END:VEVENT');
    assert.ok(anfang < wecker && wecker < ende, zeilen.join(' | '));
  });

  it('rundet krumme Vorläufe', () => {
    assert.match(buildIcs([{ ...termin, alarmMin: 14.6 }]), /TRIGGER:-PT15M/);
  });
});
