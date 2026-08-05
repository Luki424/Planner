import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { holidayMap } from './holidays';
import {
  balanceFor,
  clipToYear,
  datesInRange,
  leaveDaysOf,
  overlappingDays,
  workdaysInRange,
} from './leave';
import type { Absence, LeaveYear, Member } from './types';

const NRW = holidayMap([2025, 2026, 2027], 'NW');

const lukas: Member = { id: 'm1', name: 'Lukas', color: '#2e6f63', annualLeaveDays: 30 };
const svenja: Member = { id: 'm2', name: 'Svenja', color: '#a3741f', annualLeaveDays: 28 };

function urlaub(memberId: string, startDate: string, endDate: string): Absence {
  return {
    id: `${memberId}-${startDate}`,
    memberId,
    kind: 'urlaub',
    startDate,
    endDate,
    note: '',
    tripId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('Zeiträume', () => {
  it('schließt beide Grenzen ein', () => {
    assert.deepEqual(datesInRange('2026-08-03', '2026-08-05'), [
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ]);
  });

  it('liefert für einen einzelnen Tag genau diesen', () => {
    assert.deepEqual(datesInRange('2026-08-03', '2026-08-03'), ['2026-08-03']);
  });

  it('liefert nichts, wenn das Ende vor dem Anfang liegt', () => {
    assert.deepEqual(datesInRange('2026-08-05', '2026-08-03'), []);
  });
});

describe('Arbeitstage zählen', () => {
  it('lässt Wochenenden weg', () => {
    // Mo 3.8.2026 bis So 9.8.2026 → fünf Arbeitstage.
    assert.equal(workdaysInRange('2026-08-03', '2026-08-09', NRW), 5);
  });

  it('lässt Feiertage weg', () => {
    // 1.5.2026 ist ein Freitag und Tag der Arbeit.
    assert.equal(workdaysInRange('2026-04-27', '2026-05-01', NRW), 4);
  });

  it('zählt eine Woche über Ostern richtig', () => {
    // Karfreitag 3.4., Ostermontag 6.4.2026: Mo 30.3. bis So 12.4. sind
    // zehn Wochentage minus zwei Feiertage.
    assert.equal(workdaysInRange('2026-03-30', '2026-04-12', NRW), 8);
  });

  it('zählt ohne Feiertagsliste nur Wochenenden weg', () => {
    assert.equal(workdaysInRange('2026-04-27', '2026-05-01', new Map()), 5);
  });
});

describe('Jahresgrenzen', () => {
  it('beschneidet einen Zeitraum auf das Jahr', () => {
    assert.deepEqual(clipToYear('2026-12-28', '2027-01-05', 2026), {
      startDate: '2026-12-28',
      endDate: '2026-12-31',
    });
    assert.deepEqual(clipToYear('2026-12-28', '2027-01-05', 2027), {
      startDate: '2027-01-01',
      endDate: '2027-01-05',
    });
  });

  it('meldet null, wenn der Zeitraum das Jahr nicht berührt', () => {
    assert.equal(clipToYear('2026-05-01', '2026-05-10', 2027), null);
  });

  it('teilt einen Jahreswechsel-Urlaub auf beide Jahre auf', () => {
    // 28.12.2026 (Mo) bis 5.1.2027 (Di).
    // 2026: Mo 28., Di 29., Mi 30., Do 31. → vier Arbeitstage.
    // 2027: 1.1. ist Neujahr (Fr), Mo 4. und Di 5. → zwei Arbeitstage.
    const a = urlaub('m1', '2026-12-28', '2027-01-05');
    assert.equal(leaveDaysOf(a, 2026, NRW), 4);
    assert.equal(leaveDaysOf(a, 2027, NRW), 2);
  });
});

describe('Kontostand', () => {
  const heute = '2026-08-05';

  it('rechnet Anspruch minus genommen minus geplant', () => {
    const absences = [
      urlaub('m1', '2026-03-02', '2026-03-06'), // 5 Tage, vergangen
      urlaub('m1', '2026-10-05', '2026-10-09'), // 5 Tage, geplant
    ];
    const bilanz = balanceFor(lukas, 2026, absences, [], NRW, heute);
    assert.equal(bilanz.entitlement, 30);
    assert.equal(bilanz.taken, 5);
    assert.equal(bilanz.planned, 5);
    assert.equal(bilanz.remaining, 20);
  });

  it('zählt einen laufenden Urlaub als genommen', () => {
    const laufend = urlaub('m1', '2026-08-03', '2026-08-07');
    const bilanz = balanceFor(lukas, 2026, [laufend], [], NRW, heute);
    assert.equal(bilanz.taken, 5);
    assert.equal(bilanz.planned, 0);
  });

  it('berücksichtigt Übertrag und abweichenden Anspruch', () => {
    const jahr: LeaveYear = {
      id: 'm2-2026',
      memberId: 'm2',
      year: 2026,
      entitlementDays: 26,
      carryOverDays: 4,
    };
    const bilanz = balanceFor(svenja, 2026, [], [jahr], NRW, heute);
    assert.equal(bilanz.entitlement, 26);
    assert.equal(bilanz.carryOver, 4);
    assert.equal(bilanz.remaining, 30);
  });

  it('rechnet Krankheit und Gleitzeit nicht auf den Urlaub an', () => {
    const krank: Absence = { ...urlaub('m1', '2026-09-07', '2026-09-11'), kind: 'krank' };
    const gleitzeit: Absence = { ...urlaub('m1', '2026-09-14', '2026-09-14'), kind: 'gleitzeit' };
    const bilanz = balanceFor(lukas, 2026, [krank, gleitzeit], [], NRW, heute);
    assert.equal(bilanz.taken + bilanz.planned, 0);
    assert.equal(bilanz.remaining, 30);
  });

  it('trennt die Personen sauber', () => {
    const absences = [urlaub('m1', '2026-03-02', '2026-03-06')];
    assert.equal(balanceFor(svenja, 2026, absences, [], NRW, heute).taken, 0);
  });

  it('lässt den Anspruch ins Minus gehen, statt bei null zu stoppen', () => {
    // Wer mehr einträgt, als er hat, soll das sehen – nicht stillschweigend
    // auf null gedeckelt werden.
    const zuViel = urlaub('m1', '2026-01-05', '2026-04-30');
    const bilanz = balanceFor(lukas, 2026, [zuViel], [], NRW, heute);
    assert.ok(bilanz.remaining < 0, `Rest: ${bilanz.remaining}`);
  });
});

describe('Gemeinsame Tage', () => {
  it('findet die Überschneidung zweier Abwesenheiten', () => {
    const a = urlaub('m1', '2026-07-01', '2026-07-10');
    const b = urlaub('m2', '2026-07-08', '2026-07-15');
    assert.deepEqual(overlappingDays(a, b), [
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
    ]);
  });

  it('liefert nichts ohne Überschneidung', () => {
    const a = urlaub('m1', '2026-07-01', '2026-07-05');
    const b = urlaub('m2', '2026-07-08', '2026-07-15');
    assert.deepEqual(overlappingDays(a, b), []);
  });
});
