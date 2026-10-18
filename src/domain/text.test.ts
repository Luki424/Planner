import assert from 'node:assert/strict';
import { it } from 'node:test';
import { anzahl } from './text';

it('nimmt bei genau eins die Einzahl', () => {
  assert.equal(anzahl(1, 'Termin', 'Termine'), '1 Termin');
  assert.equal(anzahl(0, 'Termin', 'Termine'), '0 Termine');
  assert.equal(anzahl(2, 'Eintrag stammt', 'Einträge stammen'), '2 Einträge stammen');
});
