import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectDisplayNames,
  normalizeName,
  recallPrice,
  rememberPrice,
  suggestItems,
  type PriceMemory,
} from './prices';
import { PRICE_MEMORY_LIMIT, type ShoppingItem } from './types';

function item(name: string, done = false, createdAt = '2026-01-01T00:00:00.000Z'): ShoppingItem {
  return {
    id: name,
    name,
    quantity: null,
    unit: '',
    estimatedCents: null,
    done,
    note: '',
    createdAt,
    doneAt: null,
    createdBy: null,
  };
}

describe('Namen vereinheitlichen', () => {
  it('macht aus Schreibvarianten denselben Schlüssel', () => {
    assert.equal(normalizeName('Müsli'), normalizeName('muesli'));
    assert.equal(normalizeName('  Frische   Milch '), 'frische milch');
    assert.equal(normalizeName('Weißbrot'), 'weissbrot');
  });
});

describe('Preise merken', () => {
  it('merkt und findet einen Preis wieder', () => {
    const memory = rememberPrice({}, 'Milch', 149);
    assert.equal(recallPrice(memory, 'milch'), 149);
    assert.equal(recallPrice(memory, 'MILCH'), 149);
  });

  it('überschreibt mit dem neueren Preis', () => {
    let memory = rememberPrice({}, 'Milch', 149, '2026-01-01T00:00:00.000Z');
    memory = rememberPrice(memory, 'Milch', 169, '2026-02-01T00:00:00.000Z');
    assert.equal(recallPrice(memory, 'Milch'), 169);
  });

  it('ignoriert leere Namen und Preise ohne Wert', () => {
    assert.deepEqual(rememberPrice({}, '   ', 100), {});
    assert.deepEqual(rememberPrice({}, 'Milch', 0), {});
  });

  it('meldet null für Unbekanntes', () => {
    assert.equal(recallPrice({}, 'Milch'), null);
  });

  it('verdrängt die ältesten Einträge an der Obergrenze', () => {
    let memory: PriceMemory = {};
    for (let i = 0; i < PRICE_MEMORY_LIMIT; i += 1) {
      const stamp = new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();
      memory = rememberPrice(memory, `Artikel ${i}`, 100 + i, stamp);
    }
    assert.equal(Object.keys(memory).length, PRICE_MEMORY_LIMIT);

    memory = rememberPrice(memory, 'Neuling', 999, '2026-06-01T00:00:00.000Z');
    assert.equal(Object.keys(memory).length, PRICE_MEMORY_LIMIT);
    assert.equal(recallPrice(memory, 'Neuling'), 999, 'der neue Eintrag muss bleiben');
    assert.equal(recallPrice(memory, 'Artikel 0'), null, 'der älteste muss weichen');
    assert.equal(recallPrice(memory, 'Artikel 1'), 101, 'der zweitälteste bleibt');
  });
});

describe('Vorschläge', () => {
  const memory: PriceMemory = {
    milch: { cents: 149, at: '2026-03-01T00:00:00.000Z', name: 'Milch' },
    milchreis: { cents: 199, at: '2026-01-01T00:00:00.000Z', name: 'Milchreis' },
    buttermilch: { cents: 99, at: '2026-04-01T00:00:00.000Z', name: 'Buttermilch' },
    brot: { cents: 299, at: '2026-02-01T00:00:00.000Z', name: 'Brot' },
  };
  const names = new Map([
    ['milch', 'Milch'],
    ['milchreis', 'Milchreis'],
    ['buttermilch', 'Buttermilch'],
    ['brot', 'Brot'],
  ]);

  it('stellt Treffer am Wortanfang nach vorn', () => {
    const result = suggestItems(memory, names, 'milch', []);
    assert.deepEqual(
      result.map((s) => s.name),
      ['Milchreis', 'Buttermilch'],
    );
  });

  it('liefert den gemerkten Preis mit', () => {
    const [first] = suggestItems(memory, names, 'bro', []);
    assert.equal(first.name, 'Brot');
    assert.equal(first.cents, 299);
  });

  it('lässt exakte Treffer weg – die tippt man ja gerade', () => {
    const result = suggestItems(memory, names, 'brot', []);
    assert.ok(!result.some((s) => s.name === 'Brot'));
  });

  it('schlägt nichts vor, was schon offen auf der Liste steht', () => {
    const result = suggestItems(memory, names, 'milch', [item('Buttermilch')]);
    assert.deepEqual(
      result.map((s) => s.name),
      ['Milchreis'],
    );
  });

  it('schlägt Abgehaktes wieder vor – das kommt nächste Woche erneut', () => {
    const result = suggestItems(memory, names, 'milch', [item('Buttermilch', true)]);
    assert.ok(result.some((s) => s.name === 'Buttermilch'));
  });

  it('nimmt die gemerkte Schreibweise, auch ohne Einträge auf der Liste', () => {
    // Genau der Fall nach "Abgehaktes entfernen": die Liste ist leer,
    // das Gedächtnis muss die Groß-/Kleinschreibung trotzdem kennen.
    const result = suggestItems(memory, new Map(), 'butter', []);
    assert.deepEqual(
      result.map((s) => s.name),
      ['Buttermilch'],
    );
  });

  it('bleibt bei leerer Eingabe still', () => {
    assert.deepEqual(suggestItems(memory, names, '', []), []);
    assert.deepEqual(suggestItems(memory, names, '  ', []), []);
  });

  it('hält sich an die Höchstzahl', () => {
    assert.equal(suggestItems(memory, names, 'r', [], 2).length, 2);
  });
});

describe('Anzeigenamen', () => {
  it('nimmt die zuletzt benutzte Schreibweise', () => {
    const names = collectDisplayNames([
      item('milch', false, '2026-01-01T00:00:00.000Z'),
      item('Milch', false, '2026-02-01T00:00:00.000Z'),
    ]);
    assert.equal(names.get('milch'), 'Milch');
  });
});
