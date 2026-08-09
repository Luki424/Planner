import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WERKZEUGE, contextSummary, systemPrompt, toVorschlag } from './assistant';
import type { AppState } from './types';

const HEUTE = '2026-08-05';

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
    members: [{ id: 'm1', name: 'Lukas', color: '#f00' }],
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

const ausgabe = (id: string, title: string, cents: number, date: string, category: string) =>
  ({ id, date, title, cents, category, memberId: null, receiptId: null }) as never;

describe('Was der Assistent mitbekommt', () => {
  it('nennt Termine der nächsten zwei Wochen mit Zeit und Titel', () => {
    const s = planer({ blocks: [termin('b1', 'Zahnarzt', '2026-08-07')] });
    const z = contextSummary(s, HEUTE);
    assert.match(z, /2026-08-07 09:00–10:00 Zahnarzt/);
  });

  it('lässt Termine weg, die weiter als zwei Wochen weg sind', () => {
    const s = planer({
      blocks: [termin('b1', 'Weit weg', '2026-09-30'), termin('b2', 'Bald', '2026-08-06')],
    });
    const z = contextSummary(s, HEUTE);
    assert.match(z, /Bald/);
    assert.doesNotMatch(z, /Weit weg/);
  });

  it('lässt Vergangenes weg', () => {
    const s = planer({ blocks: [termin('b1', 'Gestern gewesen', '2026-08-04')] });
    assert.doesNotMatch(contextSummary(s, HEUTE), /Gestern gewesen/);
  });

  it('nennt nur offene Aufgaben', () => {
    const s = planer({
      tasks: [aufgabe('t1', 'Steuer machen'), aufgabe('t2', 'Schon fertig', { status: 'done' })],
    });
    const z = contextSummary(s, HEUTE);
    assert.match(z, /Steuer machen/);
    assert.doesNotMatch(z, /Schon fertig/);
  });

  /*
   * Der Kern der Zusage aus den Einstellungen: Ausgaben gehen nur als Summe
   * hinaus. Wer wann was gekauft hat, ist ein Kontoauszug – und der bleibt hier.
   */
  it('schickt Ausgaben als Summe je Kategorie, nicht als einzelne Buchungen', () => {
    const s = planer({
      expenses: [
        ausgabe('a1', 'Rewe', 4250, '2026-08-02', 'Lebensmittel'),
        ausgabe('a2', 'Aldi', 1750, '2026-08-04', 'Lebensmittel'),
        ausgabe('a3', 'Tanken', 8000, '2026-08-03', 'Auto'),
      ],
    });
    const z = contextSummary(s, HEUTE);
    assert.match(z, /Lebensmittel: 60,00/);
    assert.match(z, /Auto: 80,00/);
    assert.doesNotMatch(z, /Rewe/);
    assert.doesNotMatch(z, /Aldi/);
    assert.doesNotMatch(z, /Tanken/);
  });

  it('zählt nur den laufenden Monat zu den Summen', () => {
    const s = planer({
      expenses: [
        ausgabe('a1', 'Im Monat', 1000, '2026-08-02', 'Lebensmittel'),
        ausgabe('a2', 'Letzter Monat', 9900, '2026-07-30', 'Lebensmittel'),
      ],
    });
    assert.match(contextSummary(s, HEUTE), /Lebensmittel: 10,00/);
  });

  it('schickt weder Notizen noch Belege mit', () => {
    const s = planer({
      blocks: [termin('b1', 'Termin', '2026-08-06', { notes: 'GEHEIMNIS' })],
      receipts: [{ id: 'r1', dataUrl: 'data:image/jpeg;base64,AAAA', createdAt: '' }] as never,
      settings: { ...planer().settings, personalPhoto: 'data:image/jpeg;base64,BBBB' },
    });
    const z = contextSummary(s, HEUTE);
    assert.doesNotMatch(z, /GEHEIMNIS/);
    assert.doesNotMatch(z, /base64/);
  });

  it('sagt auch, wenn nichts da ist', () => {
    const z = contextSummary(planer(), HEUTE);
    assert.match(z, /# Termine der nächsten zwei Wochen\n\(keine\)/);
    assert.match(z, /# Einkaufsliste \(offen\)\n\(leer\)/);
  });

  it('gibt dem Modell das heutige Datum und die Bereiche mit', () => {
    const p = systemPrompt(planer(), HEUTE);
    assert.match(p, /2026-08-05/);
    assert.match(p, /Beruflich, Privat/);
    assert.match(p, /Lukas/);
  });
});

describe('Vorschläge prüfen', () => {
  it('macht aus einem Termin einen lesbaren Satz', () => {
    const v = toVorschlag(
      'termin_anlegen',
      { titel: 'Zahnarzt', datum: '2026-08-11', von: '10:00', dauerMin: 45 },
      'v1',
    );
    assert.ok(v);
    assert.equal(v.werkzeug, 'termin_anlegen');
    assert.match(v.text, /Zahnarzt/);
    assert.match(v.text, /10:00/);
    assert.match(v.text, /45/);
  });

  /*
   * Der eigentliche Zweck der Prüfung: Das Modell schreibt gelegentlich
   * „nächsten Dienstag" statt eines Datums. Ein Vorschlag, der nach dem
   * Bestätigen anders aussieht als angekündigt, wäre schlimmer als keiner.
   */
  it('lehnt ein Datum ab, das keines ist', () => {
    assert.equal(
      toVorschlag('termin_anlegen', { titel: 'X', datum: 'nächsten Dienstag', von: '10:00' }, 'v'),
      null,
    );
  });

  it('lehnt eine unmögliche Uhrzeit ab', () => {
    assert.equal(
      toVorschlag('termin_anlegen', { titel: 'X', datum: '2026-08-11', von: '25:00' }, 'v'),
      null,
    );
    assert.equal(
      toVorschlag('termin_anlegen', { titel: 'X', datum: '2026-08-11', von: 'morgens' }, 'v'),
      null,
    );
  });

  it('lehnt einen Termin ohne Uhrzeit ab – außer er ist ganztägig', () => {
    assert.equal(toVorschlag('termin_anlegen', { titel: 'X', datum: '2026-08-11' }, 'v'), null);
    const g = toVorschlag(
      'termin_anlegen',
      { titel: 'Geburtstag Oma', datum: '2026-08-11', ganztags: true },
      'v',
    );
    assert.ok(g);
    assert.match(g.text, /Ganztägig/);
  });

  it('lehnt unsinnige Dauern ab', () => {
    const args = { titel: 'X', datum: '2026-08-11', von: '10:00' };
    assert.equal(toVorschlag('termin_anlegen', { ...args, dauerMin: 0 }, 'v'), null);
    assert.equal(toVorschlag('termin_anlegen', { ...args, dauerMin: 5000 }, 'v'), null);
  });

  it('lehnt leere Titel ab', () => {
    assert.equal(toVorschlag('aufgabe_anlegen', { titel: '   ' }, 'v'), null);
    assert.equal(toVorschlag('einkauf_hinzufuegen', { name: '' }, 'v'), null);
  });

  it('nimmt eine Aufgabe mit und ohne Stichtag', () => {
    assert.ok(toVorschlag('aufgabe_anlegen', { titel: 'Steuer' }, 'v'));
    const m = toVorschlag('aufgabe_anlegen', { titel: 'Steuer', faellig: '2026-08-31' }, 'v');
    assert.ok(m);
    assert.match(m.text, /fällig/);
    assert.equal(toVorschlag('aufgabe_anlegen', { titel: 'Steuer', faellig: 'bald' }, 'v'), null);
  });

  it('schreibt Menge, Einheit und Preis in den Einkaufsvorschlag', () => {
    const v = toVorschlag(
      'einkauf_hinzufuegen',
      { name: 'Milch', menge: 2, einheit: 'l', preisEuro: 1.29 },
      'v',
    );
    assert.ok(v);
    assert.match(v.text, /2 l Milch/);
    assert.match(v.text, /1,29/);
  });

  it('lehnt Ausgaben ohne oder mit unsinnigem Betrag ab', () => {
    assert.equal(toVorschlag('ausgabe_buchen', { titel: 'Rewe' }, 'v'), null);
    assert.equal(toVorschlag('ausgabe_buchen', { titel: 'Rewe', betragEuro: -5 }, 'v'), null);
    const v = toVorschlag('ausgabe_buchen', { titel: 'Rewe', betragEuro: 42.5 }, 'v');
    assert.ok(v);
    assert.match(v.text, /42,50/);
  });

  it('nimmt einen Betrag auch mit Komma an', () => {
    const v = toVorschlag('ausgabe_buchen', { titel: 'Rewe', betragEuro: '42,50' }, 'v');
    assert.ok(v);
    assert.match(v.text, /42,50/);
  });

  it('kennt kein Werkzeug außer den vier', () => {
    assert.equal(toVorschlag('datei_loeschen', { pfad: '/' }, 'v'), null);
    assert.equal(WERKZEUGE.length, 4);
  });

  /* Beide Anbieter bekommen dasselbe Schema – es muss für beide gültig sein. */
  it('beschreibt jedes Werkzeug als Objekt mit Pflichtfeldern', () => {
    for (const w of WERKZEUGE) {
      assert.equal(w.schema.type, 'object');
      assert.ok(Array.isArray(w.schema.required));
      assert.ok((w.schema.required as string[]).length > 0);
      assert.ok(w.beschreibung.length > 10);
    }
  });
});
