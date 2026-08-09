import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { timeBalance, zeitraeume } from './balance';
import type { Block, Context, Member, Task } from './types';

const KONTEXTE: Context[] = [
  { id: 'beruf', name: 'Beruflich', color: '#00f' },
  { id: 'privat', name: 'Privat', color: '#0f0' },
];
const PERSONEN: Member[] = [
  { id: 'l', name: 'Lukas', color: '#a00' },
  { id: 's', name: 'Svenja', color: '#0a0' },
] as Member[];

// Montag, 3. August 2026, bis Sonntag, 9. August – genau eine Woche.
const WOCHE = { von: '2026-08-03', bis: '2026-08-09', label: 'Testwoche' };
const KAPAZITAET = 480;

function block(
  date: string,
  durationMin: number,
  extra: Partial<Block> & { contextId?: string } = {},
): Block {
  return {
    id: `${date}-${durationMin}-${extra.contextId ?? 'beruf'}-${Math.random()}`,
    date,
    startMin: 540,
    durationMin,
    allDay: false,
    taskId: null,
    title: 'Termin',
    notes: '',
    contextId: 'beruf',
    memberIds: [],
    kind: 'fixed',
    ...extra,
  } as unknown as Block;
}

const rechne = (blocks: Block[], tasks: Task[] = [], zeitraum = WOCHE) =>
  timeBalance(blocks, tasks, KONTEXTE, PERSONEN, zeitraum, KAPAZITAET);

describe('Zeiträume', () => {
  it('bietet vier Wochen, drei Monate, ein Jahr', () => {
    const z = zeitraeume('2026-08-09');
    assert.deepEqual(
      z.map((e) => e.label),
      ['letzte 4 Wochen', 'letzte 3 Monate', 'letztes Jahr'],
    );
    // Vier Wochen sind 28 Tage einschließlich heute.
    assert.equal(z[0].von, '2026-07-13');
    assert.equal(z[0].bis, '2026-08-09');
  });
});

describe('Was gezählt wird', () => {
  it('summiert nur, was im Zeitraum liegt', () => {
    const bilanz = rechne([
      block('2026-08-03', 60),
      block('2026-08-09', 30),
      block('2026-08-10', 600), // einen Tag zu spät
      block('2026-08-02', 600), // einen Tag zu früh
    ]);
    assert.equal(bilanz.minuten, 90);
    assert.equal(bilanz.termine, 2);
  });

  it('lässt Ganztägiges aus den Stunden heraus', () => {
    /*
     * Dieselbe Regel wie in Tag, Woche und Monat: Ein Geburtstag belegt
     * keine Stunden. Er wird trotzdem genannt, sonst sähe die Woche leerer
     * aus, als sie war.
     */
    const bilanz = rechne([block('2026-08-05', 1440, { allDay: true }), block('2026-08-05', 60)]);
    assert.equal(bilanz.minuten, 60);
    assert.equal(bilanz.ganztags, 1);
    assert.equal(bilanz.termine, 1);
  });

  it('zählt die Tage des Zeitraums einschließlich beider Enden', () => {
    assert.equal(rechne([]).tage, 7);
  });
});

describe('Wohin die Zeit geht', () => {
  it('teilt nach Bereich auf', () => {
    const bilanz = rechne([
      block('2026-08-03', 180, { contextId: 'beruf' }),
      block('2026-08-04', 60, { contextId: 'privat' }),
    ]);
    assert.deepEqual(
      bilanz.nachBereich.map((a) => [a.name, a.minuten, a.prozent]),
      [
        ['Beruflich', 180, 75],
        ['Privat', 60, 25],
      ],
    );
  });

  it('nennt keinen Bereich ohne Zeit', () => {
    // Eine Null-Prozent-Zeile ist keine Auskunft, nur eine Zeile.
    const bilanz = rechne([block('2026-08-03', 60, { contextId: 'beruf' })]);
    assert.equal(bilanz.nachBereich.length, 1);
  });

  it('zählt einen gemeinsamen Termin bei beiden voll', () => {
    /*
     * Die Frage ist „wie viel steht bei dir an", nicht „wie teilen wir die
     * Stunde auf". Deshalb ist der Bezug die Summe über die Personen –
     * sonst käme mehr als hundert Prozent heraus.
     */
    const bilanz = rechne([block('2026-08-03', 60, { memberIds: ['l', 's'] })]);
    assert.deepEqual(
      bilanz.nachPerson.map((a) => [a.name, a.minuten, a.prozent]),
      [
        ['Lukas', 60, 50],
        ['Svenja', 60, 50],
      ],
    );
  });

  it('holt die Zuordnung bei einer eingeplanten Aufgabe von der Aufgabe', () => {
    const task = { id: 't1', memberIds: ['s'] } as unknown as Task;
    const bilanz = rechne([block('2026-08-03', 90, { taskId: 't1', memberIds: [] })], [task]);
    assert.deepEqual(
      bilanz.nachPerson.map((a) => a.name),
      ['Svenja'],
    );
  });

  it('lässt Termine ohne Zuordnung aus der Personenaufteilung', () => {
    // Sie gelten für alle – sie jemandem zuzuschlagen wäre erfunden.
    assert.deepEqual(rechne([block('2026-08-03', 60)]).nachPerson, []);
  });
});

describe('Muster über die Woche', () => {
  it('findet den vollsten Wochentag', () => {
    const bilanz = rechne([
      block('2026-08-03', 60), // Montag
      block('2026-08-06', 240), // Donnerstag
    ]);
    assert.equal(bilanz.vollsterTag?.name, 'Do');
    assert.equal(bilanz.vollsterTag?.minuten, 240);
  });

  it('nennt keinen vollsten Tag, wenn nichts geplant war', () => {
    assert.equal(rechne([]).vollsterTag, null);
  });

  it('zählt Tage über der Kapazität', () => {
    const bilanz = rechne([
      block('2026-08-03', 540), // über 8 h
      block('2026-08-04', 60),
    ]);
    assert.equal(bilanz.ueberTage, 1);
  });

  it('zählt Tage ganz ohne Termin', () => {
    assert.equal(rechne([block('2026-08-03', 60)]).freieTage, 6);
    assert.equal(rechne([]).freieTage, 7);
  });

  it('rechnet den Schnitt je Woche hoch', () => {
    // 210 Minuten in sieben Tagen sind 210 je Woche.
    assert.equal(rechne([block('2026-08-03', 210)]).proWoche, 210);
    // Und in vierzehn Tagen die Hälfte davon.
    const zwei = { von: '2026-08-03', bis: '2026-08-16', label: 'zwei Wochen' };
    assert.equal(rechne([block('2026-08-03', 210)], [], zwei).proWoche, 105);
  });
});

describe('Leerer Zeitraum', () => {
  it('bleibt rechenbar', () => {
    const bilanz = rechne([]);
    assert.equal(bilanz.minuten, 0);
    assert.equal(bilanz.proWoche, 0);
    assert.deepEqual(bilanz.nachBereich, []);
    assert.deepEqual(bilanz.proWochentag, [0, 0, 0, 0, 0, 0, 0]);
  });
});
