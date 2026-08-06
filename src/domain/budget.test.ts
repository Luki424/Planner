import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dueInMonth,
  estimateDeviation,
  fixedTotal,
  monthsBetween,
  recurringForMonth,
  yearlyCost,
  formatMonth,
  memberLabel,
  monthKey,
  monthlyTotals,
  parseAmount,
  recentMonths,
  shiftMonth,
  summarizeMonth,
} from './budget';
import type { Expense, Member, RecurringExpense, RecurringInterval } from './types';

const fix = (
  title: string,
  cents: number,
  startMonth: string,
  extra: Partial<RecurringExpense> = {},
): RecurringExpense => ({
  id: `fix-${title}`,
  title,
  cents,
  category: extra.category ?? 'Wohnen',
  memberIds: extra.memberIds ?? [],
  interval: (extra.interval ?? 'monatlich') as RecurringInterval,
  startMonth,
  endMonth: extra.endMonth ?? null,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
});

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


describe('Feste Kosten: wann sie anfallen', () => {
  it('zählt Monate über den Jahreswechsel', () => {
    assert.equal(monthsBetween('2025-11', '2026-02'), 3);
    assert.equal(monthsBetween('2026-02', '2025-11'), -3);
  });

  it('fällt monatlich in jedem Monat ab dem Start an', () => {
    const miete = fix('Miete', 95000, '2026-03');
    assert.equal(dueInMonth(miete, '2026-02'), false);
    assert.equal(dueInMonth(miete, '2026-03'), true);
    assert.equal(dueInMonth(miete, '2026-04'), true);
    assert.equal(dueInMonth(miete, '2027-01'), true);
  });

  it('zählt vierteljährlich ab dem Startmonat, nicht ab Quartalsende', () => {
    /*
     * Eine Versicherung, die im März zum ersten Mal abgeht, kommt im Juni,
     * September und Dezember – nicht im Januar, April, Juli, Oktober.
     */
    const police = fix('Versicherung', 12000, '2026-03', { interval: 'vierteljaehrlich' });
    assert.deepEqual(
      ['2026-03', '2026-04', '2026-05', '2026-06', '2026-09', '2026-12', '2027-03'].map((m) =>
        dueInMonth(police, m),
      ),
      [true, false, false, true, true, true, true],
    );
  });

  it('zählt jährlich nur im Startmonat des Jahres', () => {
    const rundfunk = fix('Beitrag', 22000, '2026-05', { interval: 'jaehrlich' });
    assert.equal(dueInMonth(rundfunk, '2026-05'), true);
    assert.equal(dueInMonth(rundfunk, '2026-06'), false);
    assert.equal(dueInMonth(rundfunk, '2027-05'), true);
  });

  it('hört nach dem Endmonat auf', () => {
    const abo = fix('Abo', 999, '2026-01', { endMonth: '2026-03' });
    assert.equal(dueInMonth(abo, '2026-03'), true);
    assert.equal(dueInMonth(abo, '2026-04'), false);
  });
});

describe('Feste Kosten in der Übersicht', () => {
  const regeln = [
    fix('Miete', 95000, '2026-01'),
    fix('Strom', 8500, '2026-01'),
    fix('Versicherung', 12000, '2026-03', { interval: 'vierteljaehrlich', category: 'Wohnen' }),
  ];

  it('summiert die festen Posten eines Monats', () => {
    assert.equal(fixedTotal(regeln, '2026-02'), 95000 + 8500);
    assert.equal(fixedTotal(regeln, '2026-03'), 95000 + 8500 + 12000);
  });

  it('gibt festen Posten eine stabile Kennung je Monat', () => {
    const [erster] = recurringForMonth(regeln, '2026-02');
    assert.equal(erster.id, 'fix:fix-Miete:2026-02');
    assert.equal(recurringForMonth(regeln, '2026-02')[0].id, erster.id);
    assert.notEqual(recurringForMonth(regeln, '2026-03')[0].id, erster.id);
  });

  it('rechnet feste Posten in die Monatssumme ein und weist sie getrennt aus', () => {
    const s = summarizeMonth([ausgabe('2026-02-05', 4500)], '2026-02', regeln);
    assert.equal(s.fixed, 103500);
    assert.equal(s.variable, 4500);
    assert.equal(s.total, 108000);
  });

  it('lässt den Schätzungsvergleich unberührt', () => {
    // Feste Posten tragen keine Schätzung; sie dürfen den Vergleich nicht kippen.
    const s = summarizeMonth(
      [ausgabe('2026-02-05', 5500, { estimatedCents: 5000 })],
      '2026-02',
      regeln,
    );
    assert.deepEqual(estimateDeviation(s), { cents: 500, percent: 10 });
  });

  it('bleibt ohne feste Posten unverändert', () => {
    const ohne = summarizeMonth([ausgabe('2026-02-05', 4500)], '2026-02');
    assert.equal(ohne.fixed, 0);
    assert.equal(ohne.variable, 4500);
    assert.equal(ohne.total, 4500);
  });

  it('nimmt feste Posten in den Verlauf auf', () => {
    const verlauf = monthlyTotals([], ['2026-02', '2026-03'], regeln);
    assert.deepEqual(verlauf, [
      { month: '2026-02', cents: 103500 },
      { month: '2026-03', cents: 115500 },
    ]);
  });

  it('führt feste Posten unter ihrer Kategorie', () => {
    const s = summarizeMonth([], '2026-02', regeln);
    assert.equal(s.byCategory[0].category, 'Wohnen');
    assert.equal(s.byCategory[0].cents, 103500);
  });
});

describe('Jahreskosten vergleichen', () => {
  it('rechnet monatlich aufs Jahr hoch', () => {
    assert.equal(yearlyCost(fix('Abo', 999, '2026-01')), 999 * 12);
  });

  it('rechnet vierteljährlich aufs Jahr hoch', () => {
    assert.equal(yearlyCost(fix('Police', 12000, '2026-01', { interval: 'vierteljaehrlich' })), 48000);
  });

  it('lässt jährlich unverändert', () => {
    assert.equal(yearlyCost(fix('Beitrag', 22000, '2026-01', { interval: 'jaehrlich' })), 22000);
  });
});
