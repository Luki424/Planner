import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allDayBlocks,
  effectiveMinutes,
  findFreeSlot,
  plannedMinutes,
  timedBlocks,
} from './scheduling';
import type { Block, Settings } from './types';

const KAPAZITAET = 8 * 60;

const einstellungen: Settings = {
  dayStartMin: 6 * 60,
  dayEndMin: 22 * 60,
  slotMin: 15,
  capacityMin: KAPAZITAET,
  priceMemory: {},
  personalPhoto: null,
  personalCaption: '',
  bundesland: 'NW',
};

const block = (extra: Partial<Block> = {}): Block => ({
  id: extra.id ?? 'b',
  date: '2026-08-07',
  startMin: extra.startMin ?? 9 * 60,
  durationMin: extra.durationMin ?? 60,
  allDay: extra.allDay,
  taskId: null,
  title: extra.title ?? 'Termin',
  contextId: 'privat',
  memberIds: [],
});

describe('Ganztägige Einträge', () => {
  it('nehmen den ganzen Tag, nicht ihre gespeicherte Dauer', () => {
    // Gespeichert ist null – gezählt wird die Tageskapazität.
    assert.equal(effectiveMinutes(block({ allDay: true, durationMin: 0 }), KAPAZITAET), KAPAZITAET);
  });

  it('lassen zeitgebundene Einträge unberührt', () => {
    assert.equal(effectiveMinutes(block({ durationMin: 90 }), KAPAZITAET), 90);
  });

  it('machen den Tag in der Auslastung sichtbar voll', () => {
    const tag = [block({ id: 'a', allDay: true, durationMin: 0 })];
    assert.equal(plannedMinutes(tag, KAPAZITAET), KAPAZITAET);
  });

  it('zählen neben zeitgebundenen Einträgen dazu', () => {
    const tag = [
      block({ id: 'a', allDay: true, durationMin: 0 }),
      block({ id: 'b', durationMin: 60 }),
    ];
    assert.equal(plannedMinutes(tag, KAPAZITAET), KAPAZITAET + 60);
  });

  it('werden von der Zeitachse getrennt', () => {
    const tag = [
      block({ id: 'a', allDay: true }),
      block({ id: 'b' }),
      block({ id: 'c', allDay: true }),
    ];
    assert.deepEqual(
      timedBlocks(tag).map((b) => b.id),
      ['b'],
    );
    assert.deepEqual(
      allDayBlocks(tag).map((b) => b.id),
      ['a', 'c'],
    );
  });
});

describe('Freie Lücke suchen', () => {
  it('belegt eine Uhrzeit hinter einem bestehenden Termin', () => {
    const belegt = [block({ startMin: 6 * 60, durationMin: 60 })];
    assert.equal(findFreeSlot(belegt, 30, einstellungen), 7 * 60);
  });

  it('lässt sich von Ganztägigem nicht blockieren', () => {
    /*
     * Ein ganztägiger Eintrag hat keine Uhrzeit. Zählte er als belegt,
     * fände die Suche keinen Platz mehr – obwohl der Tag zeitlich leer ist.
     */
    const belegt = [block({ allDay: true, startMin: 0, durationMin: 0 })];
    assert.equal(findFreeSlot(belegt, 30, einstellungen), einstellungen.dayStartMin);
  });

  it('findet trotzdem die Lücke zwischen zwei Terminen', () => {
    const belegt = [
      block({ id: 'ganz', allDay: true, startMin: 0, durationMin: 0 }),
      block({ id: 'a', startMin: 6 * 60, durationMin: 60 }),
      block({ id: 'b', startMin: 9 * 60, durationMin: 60 }),
    ];
    assert.equal(findFreeSlot(belegt, 60, einstellungen), 7 * 60);
  });
});
