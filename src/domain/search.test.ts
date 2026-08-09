import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countByKind, search } from './search';
import type { AppState } from './types';

const HEUTE = '2026-08-05';

/** Ein Planer mit je einem Eintrag pro Sammlung – mehr braucht die Suche nicht. */
function planer(patch: Partial<AppState> = {}): AppState {
  return {
    version: 1,
    contexts: [
      { id: 'c1', name: 'Beruflich', color: '#00f' },
      { id: 'c2', name: 'Privat', color: '#0f0' },
    ],
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
    ...patch,
  } as AppState;
}

const termin = (id: string, title: string, date: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    date,
    startMin: 540,
    durationMin: 60,
    allDay: false,
    taskId: null,
    title,
    notes: '',
    contextId: 'c1',
    memberIds: [],
    kind: 'fixed',
    ...extra,
  }) as never;

const aufgabe = (id: string, title: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    title,
    notes: '',
    contextId: 'c1',
    status: 'open',
    estimateMin: 30,
    allDay: false,
    dueDate: null,
    memberIds: [],
    listId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }) as never;

describe('Finden', () => {
  it('findet einen Termin am Titel', () => {
    const treffer = search(
      planer({ blocks: [termin('b1', 'Zahnarzt Dr. Berger', '2026-08-12')] }),
      'zahnarzt',
      HEUTE,
    );
    assert.equal(treffer.length, 1);
    assert.equal(treffer[0].art, 'termin');
    assert.deepEqual(treffer[0].ziel, { view: 'day', date: '2026-08-12' });
  });

  it('ist mit Umlauten und Groß-/Kleinschreibung großzügig', () => {
    const state = planer({ tasks: [aufgabe('t1', 'Küchenrolle kaufen')] });
    for (const anfrage of ['küchenrolle', 'KUECHENROLLE', 'kuechen']) {
      assert.equal(search(state, anfrage, HEUTE).length, 1, anfrage);
    }
  });

  it('findet auch mitten im Wort', () => {
    // Wer „arzt" sucht, meint auch den Zahnarzt.
    const state = planer({ blocks: [termin('b1', 'Zahnarzt', '2026-08-12')] });
    assert.equal(search(state, 'arzt', HEUTE).length, 1);
  });

  it('verlangt alle Suchwörter', () => {
    /*
     * „zahnarzt berger" soll den einen Termin finden, nicht jeden Zahnarzt
     * und jeden Berger. Sonst wird die Suche mit jedem Wort schlechter statt
     * besser – und man tippt Wörter dazu, um einzugrenzen.
     */
    const state = planer({
      blocks: [
        termin('b1', 'Zahnarzt Dr. Berger', '2026-08-12'),
        termin('b2', 'Zahnarzt Kontrolle', '2026-09-01'),
        termin('b3', 'Herr Berger anrufen', '2026-08-20'),
      ],
    });
    const treffer = search(state, 'zahnarzt berger', HEUTE);
    assert.equal(treffer.length, 1);
    assert.equal(treffer[0].id, 'b1');
  });

  it('gibt bei zu kurzer Eingabe nichts zurück', () => {
    // Ein einzelner Buchstabe träfe alles – das ist keine Antwort.
    const state = planer({ blocks: [termin('b1', 'Zahnarzt', '2026-08-12')] });
    assert.deepEqual(search(state, 'z', HEUTE), []);
    assert.deepEqual(search(state, '  ', HEUTE), []);
  });

  it('findet nichts, wo nichts ist', () => {
    assert.deepEqual(search(planer(), 'zahnarzt', HEUTE), []);
  });
});

describe('Reihenfolge', () => {
  it('stellt den Wortanfang vor die Wortmitte', () => {
    const state = planer({
      blocks: [
        termin('spaet', 'Zahnarzt', '2026-08-12'),
        termin('frueh', 'Arzttermin', '2026-08-12'),
      ],
    });
    assert.deepEqual(
      search(state, 'arzt', HEUTE).map((t) => t.id),
      ['frueh', 'spaet'],
    );
  });

  it('stellt Nahes vor Fernes', () => {
    const state = planer({
      blocks: [
        termin('fern', 'Besprechung', '2027-06-01'),
        termin('nah', 'Besprechung', '2026-08-07'),
      ],
    });
    assert.equal(search(state, 'besprechung', HEUTE)[0].id, 'nah');
  });

  it('stellt einen Titeltreffer vor einen Treffer in der Notiz', () => {
    const state = planer({
      blocks: [
        termin('notiz', 'Besprechung', '2026-08-06', { notes: 'wegen Zahnarzt verschieben' }),
        termin('titel', 'Zahnarzt', '2026-09-30'),
      ],
    });
    assert.equal(search(state, 'zahnarzt', HEUTE)[0].id, 'titel');
  });

  it('stellt Erledigtes hinten an', () => {
    const state = planer({
      tasks: [
        aufgabe('fertig', 'Reifen wechseln', { status: 'done' }),
        aufgabe('offen', 'Reifen aufpumpen'),
      ],
    });
    assert.equal(search(state, 'reifen', HEUTE)[0].id, 'offen');
  });
});

describe('Wohin ein Treffer führt', () => {
  it('schickt eine ungeplante Aufgabe in die Liste', () => {
    const treffer = search(planer({ tasks: [aufgabe('t1', 'Steuer machen')] }), 'steuer', HEUTE);
    assert.deepEqual(treffer[0].ziel, { view: 'todo' });
  });

  it('schickt eine eingeplante Aufgabe auf ihren Tag', () => {
    /*
     * Wer eine eingeplante Aufgabe sucht, will sehen, wann sie liegt – die
     * Liste zeigt sie gar nicht mehr an.
     */
    const state = planer({
      tasks: [aufgabe('t1', 'Steuer machen')],
      blocks: [termin('b1', 'Steuer machen', '2026-08-19', { taskId: 't1' })],
    });
    const treffer = search(state, 'steuer', HEUTE);
    assert.equal(treffer.length, 1, 'der Block darf nicht doppelt auftauchen');
    assert.deepEqual(treffer[0].ziel, { view: 'day', date: '2026-08-19' });
  });

  it('schickt eine Ausgabe in die Haushaltskasse', () => {
    const state = planer({
      expenses: [
        {
          id: 'a1',
          date: '2026-08-01',
          title: 'Werkstatt',
          cents: 24900,
          estimatedCents: null,
          category: 'Auto',
          memberIds: [],
          note: '',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ] as never,
    });
    const treffer = search(state, 'werkstatt', HEUTE);
    assert.deepEqual(treffer[0].ziel, { view: 'shopping', karte: 'ausgaben' });
    assert.match(treffer[0].beschreibung, /249,00/);
  });
});

describe('Übersicht', () => {
  it('zählt die Treffer je Art', () => {
    const state = planer({
      tasks: [aufgabe('t1', 'Milch holen')],
      shopping: [
        {
          id: 's1',
          name: 'Milch',
          quantity: null,
          unit: '',
          estimatedCents: 129,
          done: false,
          createdBy: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          doneAt: null,
        },
      ] as never,
    });
    assert.deepEqual(
      countByKind(search(state, 'milch', HEUTE)).sort(),
      [
        ['aufgabe', 1],
        ['einkauf', 1],
      ].sort(),
    );
  });

  it('gibt nicht mehr zurück als erlaubt', () => {
    const blocks = Array.from({ length: 60 }, (_, i) =>
      termin(`b${i}`, `Besprechung ${i}`, '2026-08-12'),
    );
    assert.equal(search(planer({ blocks }), 'besprechung', HEUTE, 10).length, 10);
  });
});
