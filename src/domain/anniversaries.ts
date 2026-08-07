import { diffDays, parseISODate, toISODate } from './dates';
import type { Anniversary } from './types';

/**
 * Jährlich wiederkehrende Daten.
 *
 * Der Unterschied zu einer Serie liegt im Zweck: Eine Serie will, dass etwas
 * getan wird. Ein Jahrestag will nur, dass man ihn nicht verpasst – rechtzeitig
 * genug, um noch ein Geschenk zu besorgen. Deshalb der Vorlauf.
 */

export type Occurrence = {
  anniversary: Anniversary;
  /** Der Termin in diesem Durchlauf, YYYY-MM-DD. */
  date: string;
  /** 0 = heute, 3 = in drei Tagen. Negativ heißt vorbei. */
  inDays: number;
  /**
   * Der wievielte: 60 bei „wird 60", 5 beim fünften Hochzeitstag.
   * null, wenn kein Anfangsjahr hinterlegt ist.
   */
  ordinal: number | null;
};

/**
 * Der Termin in einem bestimmten Jahr.
 *
 * Der 29. Februar existiert nur alle vier Jahre. Gefeiert wird dann am
 * 1. März – dem Tag, an dem das neue Lebensjahr beginnt. Ihn auf den
 * 28. Februar zu legen hieße, einen Tag zu früh zu gratulieren.
 */
export function occurrenceIn(anniversary: Anniversary, year: number): string {
  const { month, day } = anniversary;
  if (month === 2 && day === 29) {
    const schaltjahr = new Date(year, 1, 29).getMonth() === 1;
    return schaltjahr ? `${year}-02-29` : `${year}-03-01`;
  }
  return toISODate(new Date(year, month - 1, day));
}

function ordinalFor(anniversary: Anniversary, date: string): number | null {
  if (anniversary.sinceYear === null) return null;
  const jahr = parseISODate(date).getFullYear();
  const zahl = jahr - anniversary.sinceYear;
  // Das Anfangsjahr selbst zählt nicht mit: im Geburtsjahr wird niemand eins.
  return zahl > 0 ? zahl : null;
}

/** Der nächste Termin ab einschließlich `from`. */
export function nextOccurrence(anniversary: Anniversary, from: string): Occurrence {
  const jahr = parseISODate(from).getFullYear();
  let date = occurrenceIn(anniversary, jahr);
  if (date < from) date = occurrenceIn(anniversary, jahr + 1);
  return {
    anniversary,
    date,
    inDays: diffDays(date, from),
    ordinal: ordinalFor(anniversary, date),
  };
}

/** Was genau an diesem Tag ansteht. */
export function occurrencesOn(list: Anniversary[], date: string): Occurrence[] {
  return list
    .filter((a) => occurrenceIn(a, parseISODate(date).getFullYear()) === date)
    .map((a) => ({ anniversary: a, date, inDays: 0, ordinal: ordinalFor(a, date) }))
    .sort(byTitle);
}

/**
 * Was jetzt angekündigt gehört: heute selbst und alles, dessen Vorlauf
 * angebrochen ist. Ein Jahrestag ohne Vorlauf meldet sich nur am Tag selbst.
 */
export function dueNotices(list: Anniversary[], today: string): Occurrence[] {
  return list
    .map((a) => nextOccurrence(a, today))
    .filter((o) => o.inDays <= Math.max(0, o.anniversary.leadDays))
    .sort((a, b) => a.inDays - b.inDays || byTitle(a, b));
}

/** Die nächsten Termine, für die Übersicht in den Einstellungen. */
export function upcoming(list: Anniversary[], today: string, horizonDays = 365): Occurrence[] {
  return list
    .map((a) => nextOccurrence(a, today))
    .filter((o) => o.inDays <= horizonDays)
    .sort((a, b) => a.inDays - b.inDays || byTitle(a, b));
}

function byTitle(a: Occurrence, b: Occurrence): number {
  return a.anniversary.title.localeCompare(b.anniversary.title, 'de');
}

/** „Mama wird 60" – oder ohne Jahrgang schlicht „Mama hat Geburtstag". */
export function describeOccurrence(occurrence: Occurrence): string {
  const { anniversary: a, ordinal } = occurrence;
  if (a.kind === 'geburtstag') {
    return ordinal === null ? `${a.title} hat Geburtstag` : `${a.title} wird ${ordinal}`;
  }
  return ordinal === null ? a.title : `${a.title} · zum ${ordinal}. Mal`;
}

/** „heute", „morgen", „in 3 Tagen" – das, was man beim Lesen im Kopf ausrechnet. */
export function describeLead(inDays: number): string {
  if (inDays <= 0) return 'heute';
  if (inDays === 1) return 'morgen';
  if (inDays === 2) return 'übermorgen';
  return `in ${inDays} Tagen`;
}

export const KIND_LABELS: Record<Anniversary['kind'], string> = {
  geburtstag: 'Geburtstag',
  jahrestag: 'Jahrestag',
};

export const KIND_ICONS: Record<Anniversary['kind'], string> = {
  geburtstag: '🎂',
  jahrestag: '🎉',
};
