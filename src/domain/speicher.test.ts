import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verbrauch } from './speicher';
import type { AppState } from './types';

/*
 * Die Zusicherung, auf die es ankommt: Der größte Posten steht oben, und der
 * Papierkorb wird mitgezählt. Beides war der Grund für diese Anzeige – ein
 * gelöschter Beleg liegt dort samt Bild weiter, und wer das nicht sieht,
 * löscht zweimal umsonst.
 */

function planer(patch: Partial<AppState> = {}): AppState {
  return {
    version: 1,
    contexts: [],
    taskLists: [],
    tasks: [],
    blocks: [],
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
    places: [],
    bucket: [],
    settings: {
      dayStartMin: 360,
      dayEndMin: 1320,
      slotMin: 15,
      capacityMin: 480,
      priceMemory: {},
      personalPhoto: null,
      personalCaption: '',
      bundesland: 'BW',
    },
    ...patch,
  } as AppState;
}

const beleg = (id: string, bytes: number) =>
  ({
    id,
    expenseId: `e-${id}`,
    image: `data:image/jpeg;base64,${'A'.repeat(bytes)}`,
    addedBy: null,
    createdAt: '2026-10-17T08:00:00.000Z',
  }) as AppState['receipts'][number];

describe('Speicherverbrauch', () => {
  it('nennt den größten Posten zuerst', () => {
    const v = verbrauch(
      planer({
        receipts: [beleg('r1', 300_000), beleg('r2', 300_000)],
        settings: {
          ...planer().settings,
          personalPhoto: `data:image/jpeg;base64,${'A'.repeat(50)}`,
        },
      }),
    );
    assert.ok(v.posten[0].name.startsWith('Belegbilder'), v.posten[0].name);
    assert.ok(v.posten[0].bytes > 600_000);
  });

  it('zählt den Papierkorb mit – dort liegen gelöschte Belege samt Bild', () => {
    const ohne = verbrauch(planer());
    const mit = verbrauch(
      planer({
        trash: [
          {
            id: 't1',
            kind: 'Beleg',
            at: '2026-10-17T08:00:00.000Z',
            by: null,
            data: { receipts: [beleg('r1', 400_000)] },
          },
        ] as unknown as AppState['trash'],
      }),
    );
    const posten = mit.posten.find((p) => p.name === 'Papierkorb');
    assert.ok(posten, 'Papierkorb fehlt in der Aufstellung');
    assert.ok(posten.bytes > 400_000, `nur ${posten.bytes}`);
    assert.ok(mit.gesamt > ohne.gesamt + 400_000);
    // Und er steht oben, weil er hier das Fass füllt.
    assert.equal(mit.posten[0].name, 'Papierkorb');
  });

  it('lässt leere Posten weg', () => {
    const v = verbrauch(planer());
    assert.ok(!v.posten.some((p) => p.bytes === 0));
    assert.ok(!v.posten.some((p) => p.name === 'Persönliches Bild'));
  });

  it('die Summe der Posten bleibt bei der Gesamtgröße', () => {
    const v = verbrauch(
      planer({
        receipts: [beleg('r1', 1000)],
        settings: {
          ...planer().settings,
          personalPhoto: `data:image/jpeg;base64,${'A'.repeat(2000)}`,
        },
      }),
    );
    const summe = v.posten.reduce((s, p) => s + p.bytes, 0);
    assert.equal(summe, v.gesamt);
  });
});
