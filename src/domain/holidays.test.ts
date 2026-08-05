import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toISODate } from './dates';
import { BUNDESLAENDER, easterSunday, holidayMap, holidaysFor } from './holidays';

describe('Ostersonntag', () => {
  it('trifft die bekannten Termine', () => {
    // Nachschlagbare Werte, unabhängig vom Algorithmus geprüft.
    const erwartet: Record<number, string> = {
      2023: '2023-04-09',
      2024: '2024-03-31',
      2025: '2025-04-20',
      2026: '2026-04-05',
      2027: '2027-03-28',
      2028: '2028-04-16',
      2030: '2030-04-21',
    };
    for (const [jahr, datum] of Object.entries(erwartet)) {
      assert.equal(toISODate(easterSunday(Number(jahr))), datum, `Ostern ${jahr}`);
    }
  });
});

describe('Feiertage', () => {
  const namen = (jahr: number, land: Parameters<typeof holidaysFor>[1]) =>
    new Map(holidaysFor(jahr, land).map((h) => [h.name, h.date]));

  it('kennt die bundesweiten Tage 2026', () => {
    const nrw = namen(2026, 'NW');
    assert.equal(nrw.get('Neujahr'), '2026-01-01');
    assert.equal(nrw.get('Tag der Arbeit'), '2026-05-01');
    assert.equal(nrw.get('Tag der Deutschen Einheit'), '2026-10-03');
    assert.equal(nrw.get('1. Weihnachtstag'), '2026-12-25');
    assert.equal(nrw.get('2. Weihnachtstag'), '2026-12-26');
  });

  it('rechnet die beweglichen Tage von Ostern aus', () => {
    // Ostersonntag 2026 ist der 5. April.
    const by = namen(2026, 'BY');
    assert.equal(by.get('Karfreitag'), '2026-04-03');
    assert.equal(by.get('Ostermontag'), '2026-04-06');
    assert.equal(by.get('Christi Himmelfahrt'), '2026-05-14');
    assert.equal(by.get('Pfingstmontag'), '2026-05-25');
    assert.equal(by.get('Fronleichnam'), '2026-06-04');
  });

  it('unterscheidet die Bundesländer', () => {
    assert.ok(namen(2026, 'BY').has('Fronleichnam'));
    assert.ok(!namen(2026, 'BE').has('Fronleichnam'));

    assert.ok(namen(2026, 'NI').has('Reformationstag'));
    assert.ok(!namen(2026, 'NW').has('Reformationstag'));

    assert.ok(namen(2026, 'BW').has('Heilige Drei Könige'));
    assert.ok(!namen(2026, 'HE').has('Heilige Drei Könige'));

    assert.ok(namen(2026, 'BE').has('Internationaler Frauentag'));
    assert.ok(!namen(2026, 'BY').has('Internationaler Frauentag'));
  });

  it('legt den Buß- und Bettag auf den Mittwoch vor dem 23. November', () => {
    const tag = namen(2026, 'SN').get('Buß- und Bettag');
    assert.equal(tag, '2026-11-18');
    const wochentag = new Date(2026, 10, 18).getDay();
    assert.equal(wochentag, 3, 'muss ein Mittwoch sein');

    // Über mehrere Jahre: immer Mittwoch und immer im Fenster 16.–22.
    for (let jahr = 2024; jahr <= 2032; jahr += 1) {
      const datum = namen(jahr, 'SN').get('Buß- und Bettag');
      assert.ok(datum, `${jahr} fehlt`);
      const d = new Date(`${datum}T00:00:00`);
      assert.equal(d.getDay(), 3, `${jahr}: kein Mittwoch`);
      assert.ok(d.getDate() >= 16 && d.getDate() <= 22, `${jahr}: außerhalb 16.–22.`);
    }
  });

  it('liefert für jedes Bundesland eine sinnvolle Anzahl', () => {
    for (const land of Object.keys(BUNDESLAENDER) as Array<keyof typeof BUNDESLAENDER>) {
      const anzahl = holidaysFor(2026, land).length;
      assert.ok(anzahl >= 9 && anzahl <= 14, `${land}: ${anzahl} Feiertage`);
    }
  });

  it('gibt die Tage nach Datum sortiert zurück', () => {
    const tage = holidaysFor(2026, 'BY').map((h) => h.date);
    assert.deepEqual(tage, [...tage].sort());
  });

  it('baut ein Nachschlagewerk über mehrere Jahre', () => {
    const map = holidayMap([2025, 2026], 'NW');
    assert.equal(map.get('2025-12-25'), '1. Weihnachtstag');
    assert.equal(map.get('2026-01-01'), 'Neujahr');
    assert.equal(map.get('2026-07-04'), undefined);
  });
});
