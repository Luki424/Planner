import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildIcs, parseIcs } from './ics';
import { ausOutlook, type OutlookEvent } from './outlook';

/*
 * Die eigentliche Zusicherung dieser Datei ist der Rundlauf: Was aus Outlook
 * kommt, muss hinterher durch den *eigenen* Importeur gehen und dort wieder
 * dasselbe sein. Jede Prüfung, die nur die Zwischenstufe ansieht, kann grün
 * sein, während die Datei im Planer nicht lesbar ist.
 */

const zone = 'W. Europe Standard Time';
const punkt = (s: string) => ({ dateTime: `${s}.0000000`, timeZone: zone });

test('Termin mit Uhrzeit behält Wanduhrzeit und Dauer', () => {
  const { events, uebergangen } = ausOutlook([
    {
      subject: 'Teambesprechung',
      location: 'Microsoft Teams-Besprechung',
      start: punkt('2026-10-19T09:00:00'),
      end: punkt('2026-10-19T12:00:00'),
      isAllDay: false,
    },
  ]);
  assert.equal(uebergangen.length, 0);
  assert.equal(events.length, 1);
  assert.equal(events[0].date, '2026-10-19');
  assert.equal(events[0].startMin, 9 * 60);
  assert.equal(events[0].durationMin, 180);
  assert.equal(events[0].location, 'Microsoft Teams-Besprechung');
});

test('ganztägiges über mehrere Tage wird je Tag ein Eintrag', () => {
  // Outlook: Mittwoch 00:00 bis Samstag 00:00 heißt Mi, Do, Fr – nicht Sa.
  const { events } = ausOutlook([
    {
      subject: 'Bereitschaft',
      start: punkt('2026-10-14T00:00:00'),
      end: punkt('2026-10-17T00:00:00'),
      isAllDay: true,
    },
  ]);
  assert.deepEqual(
    events.map((e) => e.date),
    ['2026-10-14', '2026-10-15', '2026-10-16'],
  );
  assert.ok(events.every((e) => e.allDay));
  // Verschiedene Kennungen, sonst fielen zwei davon als Doppel durch.
  assert.equal(new Set(events.map((e) => e.uid)).size, 3);
});

test('Abgesagtes und Unvollständiges bleibt draußen, aber nicht stumm', () => {
  const { events, uebergangen } = ausOutlook([
    { subject: 'Abgesagte Runde', start: punkt('2026-10-19T09:00:00'), isCancelled: true },
    { subject: '', start: punkt('2026-10-19T09:00:00'), end: punkt('2026-10-19T10:00:00') },
    { subject: 'Ohne Ende', start: punkt('2026-10-19T09:00:00') },
    {
      subject: 'Ende vor Beginn',
      start: punkt('2026-10-19T11:00:00'),
      end: punkt('2026-10-19T10:00:00'),
    },
  ]);
  assert.equal(events.length, 0);
  assert.equal(uebergangen.length, 4);
  assert.ok(uebergangen.some((z) => z.startsWith('abgesagt:')));
});

test('dieselbe Kennung bei gleichem Termin, eine andere bei verschobenem', () => {
  const einmal = (stunde: string) =>
    ausOutlook([
      {
        subject: 'Jour fixe',
        start: punkt(`2026-10-19T${stunde}:00:00`),
        end: punkt(`2026-10-19T${stunde}:30:00`),
      },
    ]).events[0].uid;
  // Zweiter Lauf, unveränderter Termin: gleiche Kennung, der Planer erkennt
  // das Doppel.
  assert.equal(einmal('09'), einmal('09'));
  // Verschoben: neue Kennung, der Termin erscheint zur neuen Zeit.
  assert.notEqual(einmal('09'), einmal('14'));
});

test('zwei gleich benannte Termine zur selben Minute bleiben beide', () => {
  const { events } = ausOutlook([
    { subject: 'Rückruf', start: punkt('2026-10-19T09:00:00'), end: punkt('2026-10-19T09:15:00') },
    { subject: 'Rückruf', start: punkt('2026-10-19T09:00:00'), end: punkt('2026-10-19T09:15:00') },
  ]);
  assert.equal(events.length, 2);
  assert.notEqual(events[0].uid, events[1].uid);
});

test('Umlaute im Betreff ergeben keine gemeinsame Kennung', () => {
  const uid = (betreff: string) =>
    ausOutlook([
      { subject: betreff, start: punkt('2026-10-19T09:00:00'), end: punkt('2026-10-19T10:00:00') },
    ]).events[0].uid;
  assert.notEqual(uid('Präsi'), uid('Prosi'));
  assert.ok(uid('Präsi').startsWith('praesi-'));
});

test('Rundlauf: der eigene Importeur liest die Datei wieder als dasselbe', () => {
  const quelle: OutlookEvent[] = [
    {
      subject: 'Werksbesuch, zweiter Teil',
      location: 'Musterstraße 11, 76131 Karlsruhe',
      start: punkt('2026-10-23T13:00:00'),
      end: punkt('2026-10-23T17:30:00'),
      isAllDay: false,
    },
    {
      subject: 'Bereitschaft',
      start: punkt('2026-10-28T00:00:00'),
      end: punkt('2026-10-30T00:00:00'),
      isAllDay: true,
    },
    {
      subject: 'Besprechung über Mitternacht',
      start: punkt('2026-10-30T23:00:00'),
      end: punkt('2026-10-31T00:30:00'),
      isAllDay: false,
    },
  ];
  const { events } = ausOutlook(quelle);
  const gelesen = parseIcs(buildIcs(events), '2026-10-01', '2026-12-01');

  assert.equal(gelesen.skipped.length, 0, gelesen.skipped.join(' | '));
  assert.equal(gelesen.events.length, events.length);
  for (const [i, erwartet] of events.entries()) {
    const ist = gelesen.events[i];
    assert.equal(ist.uid, erwartet.uid);
    assert.equal(ist.title, erwartet.title);
    assert.equal(ist.date, erwartet.date);
    assert.equal(ist.allDay, Boolean(erwartet.allDay));
    if (!erwartet.allDay) {
      assert.equal(ist.startMin, erwartet.startMin);
      assert.equal(ist.durationMin, erwartet.durationMin);
    }
    assert.equal(ist.location, erwartet.location ?? '');
  }
});

test('das Komma im Betreff übersteht den Weg durch die Datei', () => {
  // Der Standard maskiert Kommas. Ohne das Gegenstück beim Lesen stünde
  // „Werksbesuch\, zweiter Teil" im Tagesplan.
  const { events } = ausOutlook([
    {
      subject: 'Treffen A-B, Ladetechnik',
      start: punkt('2026-10-21T10:00:00'),
      end: punkt('2026-10-21T11:00:00'),
    },
  ]);
  const gelesen = parseIcs(buildIcs(events), '2026-10-01', '2026-12-01');
  assert.equal(gelesen.events[0].title, 'Treffen A-B, Ladetechnik');
});
