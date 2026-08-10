import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { istWeckwort, ohneWeckwort } from './weckwort';

describe('Das Weckwort erkennen', () => {
  it('hört die üblichen Anreden', () => {
    for (const satz of ['Hey Planer', 'hallo planer', 'OK Planer', 'Hey, Planer!']) {
      assert.ok(istWeckwort(satz), satz);
    }
  });

  /* Die Erkennung verhört „Planer" gern – daran soll es nicht scheitern. */
  it('verzeiht die üblichen Verhörer', () => {
    for (const satz of ['Hey Planner', 'Hallo Plana', 'Hey Planet']) {
      assert.ok(istWeckwort(satz), satz);
    }
  });

  /*
   * Der wichtigere Teil: Ein Weckwort, das zu leicht anspringt, öffnet den
   * Assistenten beim Abendessen.
   */
  it('springt nicht auf beiläufige Sätze an', () => {
    for (const satz of [
      'Du bist ein guter Planer',
      'Der Planer zeigt Donnerstag nichts',
      'Hallo Schatz',
      'Planer',
      'Sag mal hey Planer',
      '',
    ]) {
      assert.equal(istWeckwort(satz), false, satz);
    }
  });

  it('braucht die Anrede, nicht nur den Gruß', () => {
    assert.equal(istWeckwort('Hey, wie viel haben wir ausgegeben'), false);
  });
});

describe('Was nach dem Weckwort kommt', () => {
  it('gibt die Frage zurück', () => {
    assert.equal(
      ohneWeckwort('Hey Planer, was steht Donnerstag an'),
      'was steht Donnerstag an',
    );
  });

  it('gibt nichts zurück, wenn nur gerufen wurde', () => {
    assert.equal(ohneWeckwort('Hey Planer'), '');
    assert.equal(ohneWeckwort('Hallo Planer!'), '');
  });

  it('lässt einen Satz ohne Weckwort unangetastet', () => {
    assert.equal(ohneWeckwort('was steht Donnerstag an'), 'was steht Donnerstag an');
  });

  it('räumt Leerzeichen und Zeilenumbrüche weg', () => {
    assert.equal(ohneWeckwort('  Hey   Planer   was ist   heute  '), 'was ist heute');
  });
});
