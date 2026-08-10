import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { erinnerungsText, faelligeErinnerungen, vorlaufName } from './reminders';
import type { AppState } from './types';

const HEUTE = '2026-08-05';

function planer(blocks: unknown[] = [], tasks: unknown[] = []): AppState {
  return {
    version: 1,
    contexts: [{ id: 'c1', name: 'Privat', color: '#0f0' }],
    taskLists: [],
    tasks,
    blocks,
    series: [],
    shopping: [],
    members: [],
    absences: [],
    leaveYears: [],
    anniversaries: [],
    trips: [],
    tripItems: [],
    recipes: [],
    recipeIngredients: [],
    meals: [],
    expenses: [],
    recurringExpenses: [],
    receipts: [],
    trash: [],
    settings: {
      dayStartMin: 360,
      dayEndMin: 1320,
      slotMin: 15,
      capacityMin: 480,
      priceMemory: {},
      personalPhoto: null,
      personalCaption: '',
      bundesland: 'NW',
    },
  } as AppState;
}

const termin = (id: string, startMin: number, extra: Record<string, unknown> = {}) =>
  ({
    id,
    date: HEUTE,
    startMin,
    durationMin: 60,
    allDay: false,
    taskId: null,
    title: `Termin ${id}`,
    notes: '',
    contextId: 'c1',
    memberIds: [],
    ...extra,
  }) as never;

const leer = new Set<string>();

describe('Welche Erinnerung fällig ist', () => {
  it('meldet einen Termin innerhalb des Vorlaufs', () => {
    // 9:50, Termin um 10:00, 15 min Vorlauf
    const f = faelligeErinnerungen(planer([termin('b1', 600)]), HEUTE, 590, 15, leer);
    assert.equal(f.length, 1);
    assert.equal(f[0].inMin, 10);
  });

  it('meldet nichts, was noch zu weit weg ist', () => {
    const f = faelligeErinnerungen(planer([termin('b1', 600)]), HEUTE, 500, 15, leer);
    assert.deepEqual(f, []);
  });

  /*
   * Die Kulanz nach hinten ist der eigentliche Sinn: Wer den Planer erst um
   * 9:58 aufmacht, soll den Termin um 9:55 noch erfahren.
   */
  it('meldet einen Termin, der gerade erst angefangen hat', () => {
    const f = faelligeErinnerungen(planer([termin('b1', 595)]), HEUTE, 598, 15, leer);
    assert.equal(f.length, 1);
    assert.equal(f[0].inMin, -3);
  });

  it('meldet nichts, was lange vorbei ist', () => {
    assert.deepEqual(faelligeErinnerungen(planer([termin('b1', 540)]), HEUTE, 600, 15, leer), []);
  });

  it('meldet nichts zweimal', () => {
    const s = planer([termin('b1', 600)]);
    assert.equal(faelligeErinnerungen(s, HEUTE, 590, 15, new Set(['b1'])).length, 0);
  });

  it('meldet nichts, wenn der Vorlauf auf aus steht', () => {
    assert.deepEqual(faelligeErinnerungen(planer([termin('b1', 600)]), HEUTE, 590, 0, leer), []);
  });

  it('lässt Termine anderer Tage außen vor', () => {
    const s = planer([termin('b1', 600, { date: '2026-08-06' })]);
    assert.deepEqual(faelligeErinnerungen(s, HEUTE, 590, 15, leer), []);
  });

  /*
   * Ganztägiges hat keine Uhrzeit – „in 15 Minuten ist Geburtstag Oma" wäre
   * erfunden. Dafür gibt es die Jahrestage mit eigener Vorwarnung.
   */
  it('lässt Ganztägiges außen vor', () => {
    const s = planer([termin('b1', 0, { allDay: true, title: 'Geburtstag Oma' })]);
    assert.deepEqual(faelligeErinnerungen(s, HEUTE, 0, 60, leer), []);
  });

  it('nimmt den Titel der Aufgabe, wenn der Block an einer hängt', () => {
    const s = planer(
      [termin('b1', 600, { taskId: 't1', title: '' })],
      [{ id: 't1', title: 'Steuer sortieren', status: 'open' }],
    );
    const f = faelligeErinnerungen(s, HEUTE, 590, 15, leer);
    assert.equal(f[0].titel, 'Steuer sortieren');
  });

  it('sortiert nach Startzeit', () => {
    const s = planer([termin('spaet', 600), termin('frueh', 592)]);
    const f = faelligeErinnerungen(s, HEUTE, 590, 15, leer);
    assert.deepEqual(
      f.map((e) => e.id),
      ['frueh', 'spaet'],
    );
  });
});

describe('Wie eine Erinnerung heißt', () => {
  const e = (inMin: number) => ({ id: 'b', titel: 'Zahnarzt', startMin: 600, inMin });

  it('sagt, wie lange es noch ist', () => {
    assert.equal(erinnerungsText(e(15)), 'In 15 Minuten: Zahnarzt (10:00)');
  });

  it('beugt die Minute richtig', () => {
    assert.equal(erinnerungsText(e(1)), 'In einer Minute: Zahnarzt (10:00)');
  });

  it('sagt „Jetzt", wenn es jetzt ist', () => {
    assert.match(erinnerungsText(e(0)), /^Jetzt:/);
  });

  it('sagt es auch noch, wenn es gerade angefangen hat', () => {
    assert.match(erinnerungsText(e(-2)), /^Seit eben:/);
  });

  it('benennt die Stufen verständlich', () => {
    assert.equal(vorlaufName(0), 'aus');
    assert.equal(vorlaufName(15), '15 min vorher');
    assert.equal(vorlaufName(60), '1 Stunde vorher');
  });
});
