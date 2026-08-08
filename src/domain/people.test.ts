import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockMemberIds,
  knownMembers,
  matchesMembers,
  memberIdsOf,
  minutesPerMember,
  toggleMember,
} from './people';
import type { Block, Member, Task } from './types';

const lukas: Member = { id: 'l', name: 'Lukas', color: '#2e6f63', annualLeaveDays: 30 };
const svenja: Member = { id: 's', name: 'Svenja', color: '#a3741f', annualLeaveDays: 30 };

const task = (id: string, memberIds: string[]): Task => ({
  id,
  title: id,
  notes: '',
  contextId: 'c',
  estimateMin: 30,
  status: 'open',
  createdAt: '2026-08-01T00:00:00.000Z',
  completedAt: null,
  dueDate: null,
  seriesId: null,
  seriesDate: null,
  memberIds,
});

const block = (
  id: string,
  taskId: string | null,
  memberIds: string[],
  durationMin = 60,
): Block => ({
  id,
  date: '2026-08-05',
  startMin: 540,
  durationMin,
  taskId,
  title: id,
  contextId: 'c',
  memberIds,
});

describe('Zuordnung lesen', () => {
  it('nimmt eine fehlende Zuordnung als leer', () => {
    assert.deepEqual(memberIdsOf({} as { memberIds?: string[] }), []);
  });

  it('nimmt beim Aufgabenblock die Zuordnung der Aufgabe', () => {
    const tasks = [task('t1', ['s'])];
    assert.deepEqual(blockMemberIds(block('b1', 't1', []), tasks), ['s']);
  });

  it('ignoriert eine eigene Zuordnung am Aufgabenblock', () => {
    // Sonst könnten Aufgabe und Block auseinanderlaufen.
    const tasks = [task('t1', ['s'])];
    assert.deepEqual(blockMemberIds(block('b1', 't1', ['l']), tasks), ['s']);
  });

  it('nimmt beim festen Termin die eigene Zuordnung', () => {
    assert.deepEqual(blockMemberIds(block('b1', null, ['l']), []), ['l']);
  });

  it('liefert nichts, wenn die Aufgabe zum Block fehlt', () => {
    assert.deepEqual(blockMemberIds(block('b1', 'weg', []), []), []);
  });
});

describe('Personenfilter', () => {
  it('zeigt Einträge ohne Zuordnung immer', () => {
    assert.equal(matchesMembers([], new Set()), true);
  });

  it('zeigt einen Eintrag, sobald eine beteiligte Person sichtbar ist', () => {
    assert.equal(matchesMembers(['l', 's'], new Set(['s'])), true);
  });

  it('blendet einen Eintrag aus, wenn keine beteiligte Person sichtbar ist', () => {
    assert.equal(matchesMembers(['l'], new Set(['s'])), false);
  });
});

describe('Auswahl umschalten', () => {
  it('nimmt eine Person auf', () => {
    assert.deepEqual(toggleMember([], 'l'), ['l']);
  });

  it('nimmt eine Person wieder heraus', () => {
    assert.deepEqual(toggleMember(['l', 's'], 'l'), ['s']);
  });
});

describe('Gelöschte Personen', () => {
  it('lässt Verweise auf entfernte Personen weg', () => {
    assert.deepEqual(
      knownMembers(['l', 'weg', 's'], [lukas, svenja]).map((m) => m.name),
      ['Lukas', 'Svenja'],
    );
  });
});

describe('Auslastung je Person', () => {
  it('zählt geteilte Termine bei beiden voll – die Zeit ist bei beiden weg', () => {
    const tasks = [task('t1', ['l', 's'])];
    const minuten = minutesPerMember([block('b1', 't1', [], 90)], tasks);
    assert.equal(minuten.get('l'), 90);
    assert.equal(minuten.get('s'), 90);
  });

  it('summiert mehrere Blöcke einer Person', () => {
    const tasks = [task('t1', ['l']), task('t2', ['l'])];
    const minuten = minutesPerMember([block('b1', 't1', [], 60), block('b2', 't2', [], 30)], tasks);
    assert.equal(minuten.get('l'), 90);
  });

  it('lässt Einträge ohne Zuordnung aus der Rechnung', () => {
    const minuten = minutesPerMember([block('b1', null, [], 60)], []);
    assert.equal(minuten.size, 0);
  });

  it('lässt Ganztägiges außen vor – es belegt keine Zeit', () => {
    const tasks = [task('t1', ['l'])];
    // Auch mit gespeicherter Dauer: ganztägig heißt, es zählt nicht mit.
    const ganztags = { ...block('b1', 't1', [], 90), allDay: true };
    assert.equal(minutesPerMember([ganztags], tasks).get('l'), 0);
  });
});
