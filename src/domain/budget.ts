import type { Expense, ID, Member, RecurringExpense, RecurringInterval } from './types';

/**
 * Haushaltskasse.
 *
 * Der Sinn ist nicht Buchhaltung, sondern eine Frage: wohin geht das Geld,
 * und stimmen die Schätzungen auf der Einkaufsliste? Deshalb hält jede
 * Ausgabe beides fest – was gerechnet war und was bezahlt wurde.
 */

export const CATEGORIES = [
  'Lebensmittel',
  'Haushalt',
  'Drogerie',
  'Freizeit',
  'Auto',
  'Wohnen',
  'Sonstiges',
] as const;

/** "12,50" oder "12.50" → Cent. Ungültiges oder Negatives ergibt null. */
export function parseAmount(value: string): number | null {
  const bereinigt = value.trim().replace('€', '').trim();
  if (!bereinigt) return null;
  const zahl = Number(bereinigt.replace(',', '.'));
  if (!Number.isFinite(zahl) || zahl < 0) return null;
  return Math.round(zahl * 100);
}

/** YYYY-MM aus einem Datum. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export function formatMonth(key: string): string {
  const [jahr, monat] = key.split('-');
  const index = Number(monat) - 1;
  return index >= 0 && index < 12 ? `${MONATE[index]} ${jahr}` : key;
}

/** Vorheriger bzw. nächster Monat als YYYY-MM. */
export function shiftMonth(key: string, delta: number): string {
  let jahr = Number(key.slice(0, 4));
  let monat = Number(key.slice(5, 7)) + delta;
  while (monat < 1) {
    monat += 12;
    jahr -= 1;
  }
  while (monat > 12) {
    monat -= 12;
    jahr += 1;
  }
  return `${jahr}-${String(monat).padStart(2, '0')}`;
}

export const INTERVAL_LABELS: Record<RecurringInterval, string> = {
  monatlich: 'monatlich',
  vierteljaehrlich: 'vierteljährlich',
  jaehrlich: 'jährlich',
};

/** Wie viele Monate zwischen zwei Fälligkeiten liegen. */
const INTERVAL_MONTHS: Record<RecurringInterval, number> = {
  monatlich: 1,
  vierteljaehrlich: 3,
  jaehrlich: 12,
};

/** Abstand zweier Monate in Monaten; negativ, wenn `to` früher liegt. */
export function monthsBetween(from: string, to: string): number {
  const jahre = Number(to.slice(0, 4)) - Number(from.slice(0, 4));
  return jahre * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
}

/**
 * Fällt ein fester Posten in diesem Monat an?
 *
 * Vierteljährlich und jährlich zählen ab dem Startmonat – eine Versicherung,
 * die im März zum ersten Mal abgeht, kommt danach im Juni, September und
 * Dezember, nicht in jedem Quartalsende.
 */
export function dueInMonth(rule: RecurringExpense, month: string): boolean {
  if (month < rule.startMonth) return false;
  if (rule.endMonth && month > rule.endMonth) return false;
  const abstand = monthsBetween(rule.startMonth, month);
  return abstand >= 0 && abstand % INTERVAL_MONTHS[rule.interval] === 0;
}

/**
 * Feste Posten eines Monats als Ausgaben.
 *
 * Sie werden gerechnet und nicht gespeichert: So kann kein Monat fehlen, nur
 * weil ihn niemand geöffnet hat, und es entstehen keine Karteileichen für
 * Jahre in der Zukunft. Die Kennung bleibt über Monate hinweg stabil, damit
 * React beim Blättern nicht alles neu aufbaut.
 */
export function recurringForMonth(rules: RecurringExpense[], month: string): Expense[] {
  return rules
    .filter((rule) => dueInMonth(rule, month))
    .map((rule) => ({
      id: `fix:${rule.id}:${month}`,
      date: `${month}-01`,
      title: rule.title,
      cents: rule.cents,
      // Feste Posten tragen keine Schätzung – sie stehen ja fest.
      estimatedCents: null,
      category: rule.category,
      memberIds: rule.memberIds,
      note: rule.note,
      createdAt: rule.createdAt,
    }));
}

/** Summe der festen Posten eines Monats. */
export function fixedTotal(rules: RecurringExpense[], month: string): number {
  return recurringForMonth(rules, month).reduce((sum, e) => sum + e.cents, 0);
}

/**
 * Was ein fester Posten im Jahr kostet – hilft beim Vergleich von Abos, die
 * mal monatlich, mal jährlich abgerechnet werden.
 */
export function yearlyCost(rule: RecurringExpense): number {
  return rule.cents * (12 / INTERVAL_MONTHS[rule.interval]);
}

export type MonthSummary = {
  month: string;
  total: number;
  /** Anteil der festen Posten an der Summe. */
  fixed: number;
  /** Alles, was nicht fest ist – worauf man also Einfluss hat. */
  variable: number;
  /** Summe der Schätzungen, nur über Ausgaben, die eine haben. */
  estimated: number;
  /**
   * Was diese Ausgaben tatsächlich gekostet haben. Getrennt von `total`,
   * weil sonst Ausgaben ohne Schätzung den Vergleich verfälschen würden –
   * ein Tankstopp ohne Schätzung ließe jede Liste zu niedrig aussehen.
   */
  actualOfEstimated: number;
  /** Wie viele Ausgaben überhaupt eine Schätzung tragen. */
  estimatedCount: number;
  count: number;
  byCategory: Array<{ category: string; cents: number }>;
  byMember: Array<{ memberId: ID | null; cents: number }>;
};

/**
 * Alles zu einem Monat, sortiert nach Höhe.
 *
 * Die festen Posten werden aus ihren Regeln gerechnet und wie gewöhnliche
 * Ausgaben mitgezählt – nur getrennt ausgewiesen, damit sichtbar bleibt,
 * worauf man überhaupt Einfluss hat.
 */
export function summarizeMonth(
  expenses: Expense[],
  month: string,
  recurring: RecurringExpense[] = [],
): MonthSummary {
  const fest = recurringForMonth(recurring, month);
  const imMonat = [...fest, ...expenses.filter((e) => monthKey(e.date) === month)];
  const fixed = fest.reduce((sum, e) => sum + e.cents, 0);

  const kategorien = new Map<string, number>();
  const personen = new Map<ID | null, number>();
  let total = 0;
  let estimated = 0;
  let actualOfEstimated = 0;
  let estimatedCount = 0;

  for (const e of imMonat) {
    total += e.cents;
    if (e.estimatedCents !== null) {
      estimated += e.estimatedCents;
      actualOfEstimated += e.cents;
      estimatedCount += 1;
    }
    const kat = e.category.trim() || 'Sonstiges';
    kategorien.set(kat, (kategorien.get(kat) ?? 0) + e.cents);

    if (e.memberIds.length === 0) {
      personen.set(null, (personen.get(null) ?? 0) + e.cents);
    } else {
      /*
       * Eine gemeinsam getragene Ausgabe wird geteilt, nicht doppelt gezählt:
       * bei "wer hat wie viel bezahlt" muss die Summe der Anteile den
       * Gesamtbetrag ergeben. (Beim Zeitaufwand ist es umgekehrt – dort ist
       * die Stunde bei beiden weg.)
       */
      const anteil = Math.round(e.cents / e.memberIds.length);
      for (const id of e.memberIds) personen.set(id, (personen.get(id) ?? 0) + anteil);
    }
  }

  return {
    month,
    total,
    fixed,
    variable: total - fixed,
    estimated,
    actualOfEstimated,
    estimatedCount,
    count: imMonat.length,
    byCategory: [...kategorien.entries()]
      .map(([category, cents]) => ({ category, cents }))
      .sort((a, b) => b.cents - a.cents),
    byMember: [...personen.entries()]
      .map(([memberId, cents]) => ({ memberId, cents }))
      .sort((a, b) => b.cents - a.cents),
  };
}

/** Die letzten `count` Monate, jüngster zuerst. */
export function recentMonths(from: string, count = 6): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(shiftMonth(from, -i));
  return out;
}

/** Summen je Monat – Grundlage für den Verlauf, feste Posten eingerechnet. */
export function monthlyTotals(
  expenses: Expense[],
  months: string[],
  recurring: RecurringExpense[] = [],
): Array<{ month: string; cents: number }> {
  return months.map((month) => ({
    month,
    cents:
      expenses.filter((e) => monthKey(e.date) === month).reduce((sum, e) => sum + e.cents, 0) +
      fixedTotal(recurring, month),
  }));
}

/**
 * Wie weit lagen Schätzung und Rechnung auseinander?
 * Null, wenn im Monat nichts mit Schätzung erfasst wurde.
 */
export function estimateDeviation(
  summary: MonthSummary,
): { cents: number; percent: number } | null {
  if (summary.estimatedCount === 0 || summary.estimated === 0) return null;
  const abweichung = summary.actualOfEstimated - summary.estimated;
  return {
    cents: abweichung,
    percent: Math.round((abweichung / summary.estimated) * 100),
  };
}

/** Namen zu den Anteilen, "Gemeinsam" für Ausgaben ohne Zuordnung. */
export function memberLabel(memberId: ID | null, members: Member[]): string {
  if (memberId === null) return 'Gemeinsam';
  return members.find((m) => m.id === memberId)?.name ?? 'Entfernt';
}
