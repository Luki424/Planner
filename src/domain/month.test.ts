import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSameMonth,
  monthEnd,
  monthGrid,
  monthLabel,
  monthStart,
  shiftMonthByDate,
} from './month';

describe('Monatsgrenzen', () => {
  it('findet Anfang und Ende', () => {
    assert.equal(monthStart('2026-08-07'), '2026-08-01');
    assert.equal(monthEnd('2026-08-07'), '2026-08-31');
  });

  it('kennt die kurzen Monate', () => {
    assert.equal(monthEnd('2026-02-10'), '2026-02-28');
    assert.equal(monthEnd('2028-02-10'), '2028-02-29');
    assert.equal(monthEnd('2026-04-10'), '2026-04-30');
  });
});

describe('Blättern', () => {
  it('geht einen Monat vor und zurück', () => {
    assert.equal(shiftMonthByDate('2026-08-07', 1), '2026-09-07');
    assert.equal(shiftMonthByDate('2026-08-07', -1), '2026-07-07');
  });

  it('springt über den Jahreswechsel', () => {
    assert.equal(shiftMonthByDate('2026-12-15', 1), '2027-01-15');
    assert.equal(shiftMonthByDate('2026-01-15', -1), '2025-12-15');
  });

  it('kappt den Tag, statt in den übernächsten Monat zu rutschen', () => {
    /*
     * Naiv gerechnet wäre der 31. Januar plus ein Monat der 3. März – man
     * überspränge beim Blättern den Februar.
     */
    assert.equal(shiftMonthByDate('2026-01-31', 1), '2026-02-28');
    assert.equal(shiftMonthByDate('2026-03-31', -1), '2026-02-28');
    assert.equal(shiftMonthByDate('2026-05-31', 1), '2026-06-30');
  });

  it('kappt auch im Schaltjahr richtig', () => {
    assert.equal(shiftMonthByDate('2028-01-31', 1), '2028-02-29');
  });

  it('kommt nach dem Kappen wieder heraus', () => {
    // Vom gekappten 28. Februar aus weiterzublättern führt auf den 28. März,
    // nicht zurück auf den 31. – das ist der Preis fürs Kappen und in Ordnung.
    assert.equal(shiftMonthByDate(shiftMonthByDate('2026-01-31', 1), 1), '2026-03-28');
  });
});

describe('Raster', () => {
  it('beginnt montags und füllt vorne auf', () => {
    // Der 1. August 2026 ist ein Samstag.
    const wochen = monthGrid('2026-08-15');
    assert.equal(wochen[0][0], '2026-07-27');
    assert.equal(wochen[0][5], '2026-08-01');
  });

  it('liefert immer volle Wochen', () => {
    for (const datum of ['2026-01-15', '2026-02-15', '2026-08-15', '2028-02-15']) {
      for (const woche of monthGrid(datum)) assert.equal(woche.length, 7);
    }
  });

  it('umschließt den ganzen Monat', () => {
    const wochen = monthGrid('2026-08-15');
    const alle = wochen.flat();
    assert.ok(alle.includes('2026-08-01'));
    assert.ok(alle.includes('2026-08-31'));
  });

  it('bleibt bei einem Februar, der genau aufgeht, bei vier Zeilen', () => {
    // Februar 2027 beginnt an einem Montag und hat 28 Tage.
    assert.equal(monthGrid('2027-02-10').length, 4);
  });

  it('braucht sechs Zeilen, wenn der Monat spät beginnt', () => {
    // Mai 2027 beginnt an einem Samstag und hat 31 Tage.
    assert.equal(monthGrid('2027-05-10').length, 6);
  });

  it('hat lückenlos aufeinanderfolgende Tage', () => {
    const alle = monthGrid('2026-08-15').flat();
    for (let i = 1; i < alle.length; i += 1) {
      const vorher = new Date(`${alle[i - 1]}T12:00:00`);
      const jetzt = new Date(`${alle[i]}T12:00:00`);
      assert.equal(Math.round((jetzt.getTime() - vorher.getTime()) / 86_400_000), 1);
    }
  });
});

describe('Zugehörigkeit und Beschriftung', () => {
  it('unterscheidet Monatstage von Randtagen', () => {
    assert.equal(isSameMonth('2026-08-01', '2026-08-15'), true);
    assert.equal(isSameMonth('2026-07-31', '2026-08-15'), false);
    assert.equal(isSameMonth('2025-08-15', '2026-08-15'), false);
  });

  it('schreibt den Monat aus', () => {
    assert.equal(monthLabel('2026-08-07'), 'August 2026');
    assert.equal(monthLabel('2026-03-01'), 'März 2026');
  });
});
