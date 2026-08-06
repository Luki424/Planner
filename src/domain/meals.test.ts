import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectNeeded, formatQuantity, scaleQuantity } from './meals';
import type { MealEntry, PriceMemoryEntry, Recipe, RecipeIngredient, ShoppingItem } from './types';

const rezept = (id: string, title: string, servings: number): Recipe => ({
  id,
  title,
  servings,
  notes: '',
  createdAt: '2026-08-01T00:00:00.000Z',
});

const zutat = (
  recipeId: string,
  name: string,
  quantity: number | null,
  unit = '',
  staple = false,
): RecipeIngredient => ({
  id: `${recipeId}-${name}`,
  recipeId,
  name,
  quantity,
  unit,
  staple,
});

const mahlzeit = (recipeId: string | null, servings: number, title = ''): MealEntry => ({
  id: `m-${recipeId}-${servings}-${title}`,
  date: '2026-08-06',
  slot: 'abend',
  recipeId,
  title,
  servings,
  createdAt: '2026-08-01T00:00:00.000Z',
});

const einkauf = (name: string, done = false): ShoppingItem => ({
  id: `s-${name}`,
  name,
  quantity: null,
  unit: '',
  estimatedCents: null,
  done,
  note: '',
  createdAt: '2026-08-01T00:00:00.000Z',
  doneAt: null,
  createdBy: null,
});

const sammle = (
  entries: MealEntry[],
  recipes: Recipe[],
  ingredients: RecipeIngredient[],
  shopping: ShoppingItem[] = [],
  priceMemory: Record<string, PriceMemoryEntry> = {},
  includeStaples = false,
) => collectNeeded({ entries, recipes, ingredients, shopping, priceMemory, includeStaples });

describe('Mengen umrechnen', () => {
  it('rechnet auf mehr Portionen hoch', () => {
    assert.equal(scaleQuantity(500, 2, 4), 1000);
  });

  it('rechnet auf weniger Portionen herunter', () => {
    assert.equal(scaleQuantity(500, 4, 2), 250);
  });

  it('rundet auf zwei Stellen – damit lässt sich einkaufen', () => {
    assert.equal(scaleQuantity(500, 3, 2), 333.33);
  });

  it('lässt eine fehlende Menge fehlend', () => {
    assert.equal(scaleQuantity(null, 2, 4), null);
  });

  it('lässt sich von null Portionen nicht aus der Ruhe bringen', () => {
    assert.equal(scaleQuantity(500, 0, 4), 500);
  });
});

describe('Zutaten zusammenfassen', () => {
  it('summiert dieselbe Zutat aus mehreren Gerichten', () => {
    const result = sammle(
      [mahlzeit('r1', 2), mahlzeit('r2', 2)],
      [rezept('r1', 'Chili', 2), rezept('r2', 'Suppe', 2)],
      [zutat('r1', 'Zwiebeln', 2, 'Stück'), zutat('r2', 'Zwiebeln', 1, 'Stück')],
    );
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].quantity, 3);
    assert.deepEqual(result.items[0].from, ['Chili', 'Suppe']);
  });

  it('rechnet die Portionen der geplanten Mahlzeit ein', () => {
    const result = sammle(
      [mahlzeit('r1', 4)],
      [rezept('r1', 'Chili', 2)],
      [zutat('r1', 'Hackfleisch', 400, 'g')],
    );
    assert.equal(result.items[0].quantity, 800);
  });

  it('addiert nur bei gleicher Einheit', () => {
    // "500 g Mehl" und "2 Packungen Mehl" lassen sich nicht addieren.
    const result = sammle(
      [mahlzeit('r1', 2), mahlzeit('r2', 2)],
      [rezept('r1', 'A', 2), rezept('r2', 'B', 2)],
      [zutat('r1', 'Mehl', 500, 'g'), zutat('r2', 'Mehl', 2, 'Packung')],
    );
    assert.equal(result.items.length, 2);
  });

  it('fasst unterschiedliche Schreibweisen zusammen', () => {
    const result = sammle(
      [mahlzeit('r1', 2), mahlzeit('r2', 2)],
      [rezept('r1', 'A', 2), rezept('r2', 'B', 2)],
      [zutat('r1', 'Zwiebeln', 1, 'Stück'), zutat('r2', 'zwiebeln', 2, 'Stück')],
    );
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].quantity, 3);
  });

  it('bleibt ohne Menge, wenn eine Angabe fehlt', () => {
    // "etwas Petersilie" plus "etwas Petersilie" ergibt keine Zahl.
    const result = sammle(
      [mahlzeit('r1', 2), mahlzeit('r2', 2)],
      [rezept('r1', 'A', 2), rezept('r2', 'B', 2)],
      [zutat('r1', 'Petersilie', null), zutat('r2', 'Petersilie', 1, '')],
    );
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].quantity, null);
  });

  it('lässt Vorräte weg und zählt sie', () => {
    const result = sammle(
      [mahlzeit('r1', 2)],
      [rezept('r1', 'Chili', 2)],
      [zutat('r1', 'Hackfleisch', 400, 'g'), zutat('r1', 'Salz', null, '', true)],
    );
    assert.equal(result.items.length, 1);
    assert.equal(result.staplesSkipped, 1);
  });

  it('nimmt Vorräte auf Wunsch mit', () => {
    const result = sammle(
      [mahlzeit('r1', 2)],
      [rezept('r1', 'Chili', 2)],
      [zutat('r1', 'Hackfleisch', 400, 'g'), zutat('r1', 'Salz', null, '', true)],
      [],
      {},
      true,
    );
    assert.equal(result.items.length, 2);
    assert.equal(result.staplesSkipped, 0);
  });

  it('markiert, was schon offen auf der Liste steht', () => {
    const result = sammle(
      [mahlzeit('r1', 2)],
      [rezept('r1', 'Chili', 2)],
      [zutat('r1', 'Zwiebeln', 2, 'Stück')],
      [einkauf('Zwiebeln')],
    );
    assert.equal(result.items[0].alreadyListed, true);
  });

  it('zählt Abgehaktes nicht als offen', () => {
    const result = sammle(
      [mahlzeit('r1', 2)],
      [rezept('r1', 'Chili', 2)],
      [zutat('r1', 'Zwiebeln', 2, 'Stück')],
      [einkauf('Zwiebeln', true)],
    );
    assert.equal(result.items[0].alreadyListed, false);
  });

  it('übernimmt den zuletzt bezahlten Preis', () => {
    const result = sammle(
      [mahlzeit('r1', 2)],
      [rezept('r1', 'Chili', 2)],
      [zutat('r1', 'Hackfleisch', 400, 'g')],
      [],
      { hackfleisch: { cents: 599, at: '2026-08-01', name: 'Hackfleisch' } },
    );
    assert.equal(result.items[0].estimatedCents, 599);
  });

  it('zählt geplante Mahlzeiten ohne Rezept getrennt', () => {
    const result = sammle([mahlzeit(null, 2, 'Essen gehen')], [], []);
    assert.equal(result.items.length, 0);
    assert.equal(result.withoutRecipe, 1);
  });

  it('zählt ein gelöschtes Rezept wie eine Mahlzeit ohne Rezept', () => {
    const result = sammle([mahlzeit('weg', 2)], [], []);
    assert.equal(result.withoutRecipe, 1);
  });

  it('sortiert nach Namen', () => {
    const result = sammle(
      [mahlzeit('r1', 2)],
      [rezept('r1', 'A', 2)],
      [zutat('r1', 'Zwiebeln', 1), zutat('r1', 'Butter', 1), zutat('r1', 'Mehl', 1)],
    );
    assert.deepEqual(
      result.items.map((i) => i.name),
      ['Butter', 'Mehl', 'Zwiebeln'],
    );
  });
});

describe('Mengen anzeigen', () => {
  it('zeigt ganze Zahlen ohne Nachkomma', () => {
    assert.equal(formatQuantity(3, 'Stück'), '3 Stück');
  });

  it('zeigt gebrochene Zahlen mit Komma', () => {
    assert.equal(formatQuantity(1.5, 'kg'), '1,5 kg');
  });

  it('zeigt bei fehlender Menge nur die Einheit', () => {
    assert.equal(formatQuantity(null, 'Prise'), 'Prise');
  });

  it('kommt ohne Einheit aus', () => {
    assert.equal(formatQuantity(2, ''), '2');
  });
});
