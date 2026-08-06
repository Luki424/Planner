import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estimateDeviation,
  formatMonth,
  memberLabel,
  monthKey,
  monthlyTotals,
  parseAmount,
  recentMonths,
  shiftMonth,
  summarizeMonth,
} from './budget';
import type { Expense, Member } from './types';

const ausgabe = (
  date: string,
  cents: number,
  extra: Partial<Expense> = {},
): Expense => ({
  id: `${date}-${cents}-${extra.title ?? ''}`,
  date,
  title: extra.title ?? 'Einkauf',
  cents,
  estimatedCents: extra.estimatedCents ?? null,
  category: extra.category ?? 'Lebensmittel',
  memberIds: extra.memberIds ?? [],
  note: '',
  createdAt: '2026-08-01T00:00:00.000Z',
});

const lukas: Member = { id: 'l', name: 'Lukas', color: '#2e6f63', annualLeaveDays: 30 };
const svenja: Member = { id: 's', name: 'Svenja', color: '#a3741f', annualLeaveDays: 30 };

describe('Betrag lesen', () => {
  it('liest Komma als Dezimaltrenner', () => {
    assert.equal(parseAmount('12,50'), 1250);
  });

  it('liest auch den Punkt', () => {
    assert.equal(parseAmount('12.50'), 1250);
  });

  it('lässt sich vom Eurozeichen nicht stören', () => {
    assert.equal(parseAmount(' 12,50 € '), 1250);
  });

  it('rundet auf ganze Cent', () => {
    assert.equal(parseAmount('12,509'), 1251);
  });

  it('lehnt Text ab', () => {
    assert.equal(parseAmount('viel'), null);
  });

  it('lehnt negative Beträge ab', () => {
    assert.equal(parseAmount('-5'), null);
  });

  it('behandelt eine leere Eingabe als fehlend', () => {
    assert.equal(parseAmount('   '), null);
  });
});

describe('Monate rechnen', () => {
  it('zieht den Monat aus einem Datum', () => {
    assert.equal(monthKey('2026-08-06'), '2026-08');
  });

  it('geht über den Jahreswechsel zurück', () => {
    assert.equal(shiftMonth('2026-01', -1), '2025-12');
  });

  it('geht über den Jahreswechsel vor', () => {
    assert.equal(shiftMonth('2026-12', 1), '2027-01');
  });

  it('springt auch über mehrere Jahre', () => {
    assert.equal(shiftMonth('2026-03', -15), '2024-12');
  });

  it('schreibt den Monat aus', () => {
    assert.equal(formatMonth('2026-08'), 'August 2026');
  });

  it('liefert die jüngsten Monate zuerst', () => {
    assert.deepEqual(recentMonths('2026-03', 4), ['2026-03', '2026-02', '2026-01', '2025-12']);
  });
});

describe('Monatsübersicht', () => {
  const monat = [
    ausgabe('2026-08-03', 4520, { category: 'Lebensmittel' }),
    ausgabe('2026-08-10', 1200, { category: 'Drogerie' }),
    ausgabe('2026-08-20', 8000, { category: 'Lebensmittel' }),
    ausgabe('2026-07-30', 9999, { category: 'Lebensmittel' }),
  ];

  it('summiert nur den gefragten Monat', () => {
    assert.equal(summarizeMonth(monat, '2026-08').total, 4520 + 1200 + 8000);
    assert.equal(summarizeMonth(monat, '2026-08').count, 3);
  });

  it('fasst Kategorien zusammen und sortiert nach Höhe', () => {
    assert.deepEqual(summarizeMonth(monat, '2026-08').byCategory, [
      { category: 'Lebensmittel', cents: 12520 },
      { category: 'Drogerie', cents: 1200 },
    ]);
  });

  it('führt Ausgaben ohne Kategorie unter Sonstiges', () => {
    const s = summarizeMonth([ausgabe('2026-08-01', 500, { category: '  ' })], '2026-08');
    assert.equal(s.byCategory[0].category, 'Sonstiges');
  });

  it('liefert für einen leeren Monat Nullen statt Fehler', () => {
    const s = summarizeMonth(monat, '2026-01');
    assert.equal(s.total, 0);
    assert.equal(s.count, 0);
    assert.deepEqual(s.byCategory, []);
  });
});

describe('Wer hat bezahlt', () => {
  it('führt Ausgaben ohne Zuordnung als gemeinsam', () => {
    const s = summarizeMonth([ausgabe('2026-08-01', 1000)], '2026-08');
    assert.deepEqual(s.byMember, [{ memberId: null, cents: 1000 }]);
  });

  it('teilt eine gemeinsam getragene Ausgabe auf', () => {
    // Anders als beim Zeitaufwand: die Summe der Anteile muss den Betrag ergeben.
    const s = summarizeMonth([ausgabe('2026-08-01', 1000, { memberIds: ['l', 's'] })], '2026-08');
    const summe = s.byMember.reduce((x, m) => x + m.cents, 0);
    assert.equal(summe, 1000);
    assert.equal(s.byMember.length, 2);
  });

  it('rechnet einer einzelnen Person den vollen Betrag zu', () => {
    const s = summarizeMonth([ausgabe('2026-08-01', 1000, { memberIds: ['l'] })], '2026-08');
    assert.deepEqual(s.byMember, [{ memberId: 'l', cents: 1000 }]);
  });

  it('benennt die Anteile', () => {
    assert.equal(memberLabel(null, [lukas, svenja]), 'Gemeinsam');
    assert.equal(memberLabel('s', [lukas, svenja]), 'Svenja');
    assert.equal(memberLabel('weg', [lukas, svenja]), 'Entfernt');
  });
});

describe('Schätzung gegen Rechnung', () => {
  it('meldet nichts, solange keine Schätzung erfasst ist', () => {
    const s = summarizeMonth([ausgabe('2026-08-01', 5000)], '2026-08');
    assert.equal(estimateDeviation(s), null);
  });

  it('rechnet die Abweichung aus', () => {
    const s = summarizeMonth(
      [ausgabe('2026-08-01', 5500, { estimatedCents: 5000 })],
      '2026-08',
    );
    assert.deepEqual(estimateDeviation(s), { cents: 500, percent: 10 });
  });

  it('zeigt auch, wenn es günstiger war', () => {
    const s = summarizeMonth(
      [ausgabe('2026-08-01', 4500, { estimatedCents: 5000 })],
      '2026-08',
    );
    assert.deepEqual(estimateDeviation(s), { cents: -500, percent: -10 });
  });

  it('vergleicht nur Ausgaben, die auch eine Schätzung haben', () => {
    /*
     * Sonst würde ein Tankstopp ohne Schätzung die Einkaufsliste zu niedrig
     * aussehen lassen, obwohl sie genau gestimmt hat.
     */
    const s = summarizeMonth(
      [
        ausgabe('2026-08-01', 5000, { estimatedCents: 5000 }),
        ausgabe('2026-08-02', 9000, { title: 'Tanken', category: 'Auto' }),
      ],
      '2026-08',
    );
    assert.equal(s.total, 14000);
    assert.deepEqual(estimateDeviation(s), { cents: 0, percent: 0 });
  });
});

describe('Verlauf', () => {
  it('liefert je Monat eine Summe, auch für leere Monate', () => {
    const verlauf = monthlyTotals(
      [ausgabe('2026-08-01', 1000), ausgabe('2026-06-01', 2000)],
      ['2026-08', '2026-07', '2026-06'],
    );
    assert.deepEqual(verlauf, [
      { month: '2026-08', cents: 1000 },
      { month: '2026-07', cents: 0 },
      { month: '2026-06', cents: 2000 },
    ]);
  });
});
