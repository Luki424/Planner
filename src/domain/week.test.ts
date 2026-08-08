import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { weekSummary } from './week';
import { weekDates } from './dates';
import type { Block } from './types';

function block(date: string, startMin: number, durationMin: number, allDay = false): Block {
  return {
    id: `${date}-${startMin}`,
    date,
    startMin,
    durationMin,
    allDay,
    taskId: null,
    title: 'Termin',
    notes: '',
    contextId: 'c1',
    memberIds: [],
    kind: 'fixed',
  } as unknown as Block;
}

// Eine feste Woche, damit der Test nicht vom Wochentag abhängt, an dem er läuft.
const TAGE = weekDates('2026-08-05'); // Mi in KW 32
const KAPAZITAET = 480;

describe('Wochenblick', () => {
  it('nennt die Kalenderwoche des ersten Tages', () => {
    assert.equal(weekSummary(TAGE, [], KAPAZITAET).kw, 32);
  });

  it('zählt Termine und Minuten über die ganze Woche', () => {
    const blick = weekSummary(
      TAGE,
      [block(TAGE[0], 540, 60), block(TAGE[0], 660, 30), block(TAGE[2], 600, 90)],
      KAPAZITAET,
    );
    assert.equal(blick.termine, 3);
    assert.equal(blick.minuten, 180);
  });

  it('lässt Ganztägiges aus der Auslastung heraus', () => {
    /*
     * Ein Geburtstag macht den Tag nicht voll. Dieselbe Regel gilt in der
     * Tages- und der Monatsansicht – hier darf sie nicht anders sein.
     */
    const blick = weekSummary(TAGE, [block(TAGE[1], 0, 1440, true)], KAPAZITAET);
    assert.equal(blick.minuten, 0);
    assert.equal(blick.ganztags, 1);
    assert.equal(blick.termine, 0);
    assert.equal(blick.auslastung, 0);
  });

  it('rechnet die Auslastung gegen die ganze Woche', () => {
    // Sieben Tage à 480 Minuten = 3360; 336 Minuten sind 10 %.
    const blick = weekSummary(TAGE, [block(TAGE[0], 540, 336)], KAPAZITAET);
    assert.equal(blick.kapazitaetMinuten, 3360);
    assert.equal(blick.auslastung, 10);
  });

  it('findet den vollsten Tag', () => {
    const blick = weekSummary(
      TAGE,
      [block(TAGE[0], 540, 60), block(TAGE[3], 540, 240)],
      KAPAZITAET,
    );
    assert.equal(blick.vollster?.date, TAGE[3]);
  });

  it('nennt keinen vollsten Tag, wenn nichts ansteht', () => {
    // „Am vollsten: Montag mit null Minuten" wäre keine Auskunft.
    assert.equal(weekSummary(TAGE, [], KAPAZITAET).vollster, null);
  });

  it('zählt einen Tag mit Ganztägigem nicht als frei', () => {
    const blick = weekSummary(TAGE, [block(TAGE[5], 0, 1440, true)], KAPAZITAET);
    assert.equal(blick.freieTage.length, 6);
    assert.ok(!blick.freieTage.some((tag) => tag.date === TAGE[5]));
  });

  it('meldet Tage über der Tageskapazität', () => {
    const blick = weekSummary(TAGE, [block(TAGE[2], 480, 540)], KAPAZITAET);
    assert.deepEqual(
      blick.volleTage.map((tag) => tag.date),
      [TAGE[2]],
    );
  });

  it('kommt mit einer leeren Woche zurecht', () => {
    const blick = weekSummary([], [], KAPAZITAET);
    assert.equal(blick.kw, 0);
    assert.equal(blick.auslastung, 0);
    assert.deepEqual(blick.proTag, []);
  });
});
