import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDueDate } from './dates';
import { NO_LIST, dueToday, groupByList, isOverdue, openCountByList } from './todo';
import type { Task, TaskList } from './types';

const HEUTE = '2026-08-06';

const liste = (id: string, name: string, order: number): TaskList => ({
  id,
  name,
  order,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: extra.title ?? id,
  notes: '',
  contextId: extra.contextId ?? 'privat',
  estimateMin: extra.estimateMin ?? 30,
  status: extra.status ?? 'open',
  createdAt: extra.createdAt ?? '2026-08-01T00:00:00.000Z',
  completedAt: extra.completedAt ?? null,
  dueDate: extra.dueDate ?? null,
  seriesId: null,
  seriesDate: null,
  memberIds: [],
  listId: extra.listId ?? null,
});

const alleBereiche = new Set(['privat', 'beruflich']);

const gruppiere = (
  tasks: Task[],
  lists: TaskList[] = [],
  extra: { activeLists?: Set<string>; showDone?: boolean; activeContexts?: Set<string> } = {},
) =>
  groupByList({
    tasks,
    lists,
    activeContexts: extra.activeContexts ?? alleBereiche,
    activeLists: extra.activeLists ?? new Set(),
    showDone: extra.showDone ?? false,
  });

describe('Nach Listen gruppieren', () => {
  const listen = [liste('haus', 'Haus', 0), liste('garten', 'Garten', 1)];

  it('sortiert Aufgaben in ihre Liste', () => {
    const gruppen = gruppiere(
      [aufgabe('a', { listId: 'haus' }), aufgabe('b', { listId: 'garten' })],
      listen,
    );
    assert.deepEqual(
      gruppen.map((g) => [g.list?.name, g.open.map((t) => t.id)]),
      [
        ['Haus', ['a']],
        ['Garten', ['b']],
      ],
    );
  });

  it('hält die Reihenfolge der Listen ein', () => {
    const gruppen = gruppiere([], [liste('b', 'Zweite', 1), liste('a', 'Erste', 0)]);
    assert.deepEqual(
      gruppen.map((g) => g.list?.name),
      ['Erste', 'Zweite'],
    );
  });

  it('behält leere Listen sichtbar', () => {
    // Eine abgearbeitete Liste soll nicht verschwinden – sonst weiß man
    // nicht mehr, wohin das Nächste gehört.
    const gruppen = gruppiere([], listen);
    assert.equal(gruppen.length, 2);
  });

  it('stellt Aufgaben ohne Liste nach oben', () => {
    const gruppen = gruppiere([aufgabe('lose'), aufgabe('a', { listId: 'haus' })], listen);
    assert.equal(gruppen[0].list, null);
    assert.deepEqual(
      gruppen[0].open.map((t) => t.id),
      ['lose'],
    );
  });

  it('lässt „ohne Liste" weg, wenn dort nichts liegt', () => {
    const gruppen = gruppiere([aufgabe('a', { listId: 'haus' })], listen);
    assert.ok(gruppen.every((g) => g.list !== null));
  });

  it('sortiert eine Aufgabe mit unbekannter Liste zu „ohne Liste"', () => {
    // Etwa nach dem Löschen der Liste auf einem anderen Gerät.
    const gruppen = gruppiere([aufgabe('a', { listId: 'weg' })], listen);
    assert.equal(gruppen[0].list, null);
    assert.deepEqual(
      gruppen[0].open.map((t) => t.id),
      ['a'],
    );
  });
});

describe('Reihenfolge innerhalb einer Liste', () => {
  it('stellt Fälliges nach vorn, Undatiertes ans Ende', () => {
    const gruppen = gruppiere([
      aufgabe('ohne'),
      aufgabe('spaet', { dueDate: '2026-09-01' }),
      aufgabe('bald', { dueDate: '2026-08-07' }),
    ]);
    assert.deepEqual(
      gruppen[0].open.map((t) => t.id),
      ['bald', 'spaet', 'ohne'],
    );
  });

  it('sortiert bei gleichem Datum nach Anlage', () => {
    const gruppen = gruppiere([
      aufgabe('neu', { dueDate: '2026-08-07', createdAt: '2026-08-05T00:00:00.000Z' }),
      aufgabe('alt', { dueDate: '2026-08-07', createdAt: '2026-08-01T00:00:00.000Z' }),
    ]);
    assert.deepEqual(
      gruppen[0].open.map((t) => t.id),
      ['alt', 'neu'],
    );
  });

  it('zeigt zuletzt Abgehaktes zuerst', () => {
    const gruppen = gruppiere(
      [
        aufgabe('frueh', { status: 'done', completedAt: '2026-08-01T10:00:00.000Z' }),
        aufgabe('spaet', { status: 'done', completedAt: '2026-08-05T10:00:00.000Z' }),
      ],
      [],
      { showDone: true },
    );
    assert.deepEqual(
      gruppen[0].done.map((t) => t.id),
      ['spaet', 'frueh'],
    );
  });
});

describe('Filtern', () => {
  const listen = [liste('haus', 'Haus', 0)];

  it('blendet Erledigtes standardmäßig aus', () => {
    const gruppen = gruppiere([aufgabe('a', { status: 'done' })]);
    assert.equal(gruppen.length, 0);
  });

  it('zeigt Erledigtes auf Wunsch', () => {
    const gruppen = gruppiere([aufgabe('a', { status: 'done' })], [], { showDone: true });
    assert.deepEqual(
      gruppen[0].done.map((t) => t.id),
      ['a'],
    );
  });

  it('beachtet den Bereichsfilter', () => {
    const gruppen = gruppiere(
      [aufgabe('a', { contextId: 'privat' }), aufgabe('b', { contextId: 'beruflich' })],
      [],
      { activeContexts: new Set(['privat']) },
    );
    assert.deepEqual(
      gruppen[0].open.map((t) => t.id),
      ['a'],
    );
  });

  it('zeigt bei leerem Listenfilter alles', () => {
    const gruppen = gruppiere([aufgabe('a', { listId: 'haus' }), aufgabe('b')], listen);
    assert.equal(
      gruppen.reduce((n, g) => n + g.open.length, 0),
      2,
    );
  });

  it('grenzt auf gewählte Listen ein', () => {
    const gruppen = gruppiere([aufgabe('a', { listId: 'haus' }), aufgabe('b')], listen, {
      activeLists: new Set(['haus']),
    });
    assert.equal(
      gruppen.reduce((n, g) => n + g.open.length, 0),
      1,
    );
  });

  it('lässt sich auch auf „ohne Liste" eingrenzen', () => {
    const gruppen = gruppiere([aufgabe('a', { listId: 'haus' }), aufgabe('b')], listen, {
      activeLists: new Set([NO_LIST]),
    });
    assert.deepEqual(
      gruppen.flatMap((g) => g.open.map((t) => t.id)),
      ['b'],
    );
  });
});

describe('Zähler und Fälligkeit', () => {
  it('zählt offene Aufgaben je Liste', () => {
    const zaehler = openCountByList([
      aufgabe('a', { listId: 'haus' }),
      aufgabe('b', { listId: 'haus' }),
      aufgabe('c'),
      aufgabe('d', { listId: 'haus', status: 'done' }),
    ]);
    assert.equal(zaehler.get('haus'), 2);
    assert.equal(zaehler.get(NO_LIST), 1);
  });

  it('erkennt Überfälliges', () => {
    assert.equal(isOverdue(aufgabe('a', { dueDate: '2026-08-05' }), HEUTE), true);
    assert.equal(isOverdue(aufgabe('a', { dueDate: HEUTE }), HEUTE), false);
    assert.equal(isOverdue(aufgabe('a'), HEUTE), false);
  });

  it('zählt Erledigtes nicht als überfällig', () => {
    const erledigt = aufgabe('a', { dueDate: '2026-08-01', status: 'done' });
    assert.equal(isOverdue(erledigt, HEUTE), false);
  });

  it('sammelt, was heute oder früher fällig ist', () => {
    const heute = dueToday(
      [
        aufgabe('gestern', { dueDate: '2026-08-05' }),
        aufgabe('heute', { dueDate: HEUTE }),
        aufgabe('morgen', { dueDate: '2026-08-07' }),
        aufgabe('ohne'),
      ],
      HEUTE,
    );
    assert.deepEqual(
      heute.map((t) => t.id),
      ['gestern', 'heute'],
    );
  });
});

describe('Fälligkeitsdatum', () => {
  it('lässt das laufende Jahr weg', () => {
    assert.equal(formatDueDate('2026-08-06', HEUTE), '6.8.');
  });

  it('nennt das Jahr, wenn es ein anderes ist', () => {
    assert.equal(formatDueDate('2020-01-01', HEUTE), '1.1.2020');
    assert.equal(formatDueDate('2027-12-24', HEUTE), '24.12.2027');
  });
});
