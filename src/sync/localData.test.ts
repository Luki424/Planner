import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SYNCED_COLLECTIONS, type AppState } from '../domain/types';
import { localSummary } from './localData';

/** Ein Zustand wie nach dem allerersten Start: nur die beiden Startbereiche. */
function frisch(): AppState {
  const state = { version: 1, settings: {} } as unknown as AppState;
  for (const name of SYNCED_COLLECTIONS) (state[name] as unknown[]) = [];
  (state.contexts as unknown[]) = [{ id: 'a' }, { id: 'b' }];
  return state;
}

describe('Stand auf diesem Gerät', () => {
  it('warnt auf einem frisch eingerichteten Gerät nicht', () => {
    const summary = localSummary(frisch());
    assert.equal(summary.warn, false);
    assert.deepEqual(summary.parts, ['2 Bereiche']);
  });

  it('warnt, sobald wirklich etwas darin steht', () => {
    const state = frisch();
    (state.tasks as unknown[]) = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const summary = localSummary(state);
    assert.equal(summary.warn, true);
    assert.deepEqual(summary.parts, ['2 Bereiche', '3 Aufgaben']);
  });

  it('setzt die Einzahl richtig', () => {
    const state = frisch();
    (state.contexts as unknown[]) = [];
    (state.blocks as unknown[]) = [{ id: '1' }];
    assert.deepEqual(localSummary(state).parts, ['1 Termin']);
  });

  it('zählt auch das, was nur an einer Stelle steht', () => {
    const state = frisch();
    (state.contexts as unknown[]) = [];
    (state.expenses as unknown[]) = [{ id: '1' }, { id: '2' }];
    const summary = localSummary(state);
    assert.equal(summary.warn, true);
    assert.deepEqual(summary.parts, ['2 Ausgaben']);
  });

  it('kennt jede synchronisierte Sammlung', () => {
    // Fällt eine neue Sammlung durch, stünde sie in der Warnung nicht –
    // man verlöre sie beim Beitreten, ohne sie vorher gesehen zu haben.
    const state = frisch();
    (state.contexts as unknown[]) = [];
    for (const name of SYNCED_COLLECTIONS) (state[name] as unknown[]) = [{ id: '1' }];
    const summary = localSummary(state);
    assert.equal(summary.parts.length, SYNCED_COLLECTIONS.length);
    assert.ok(!summary.parts.some((p) => p.includes('undefined')));
  });
});
