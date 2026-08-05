import { addDays, diffDays, weekdayIndex } from './dates';
import type { Absence, ID, LeaveYear, Member } from './types';

/**
 * Urlaubsrechnung.
 *
 * Gezählt werden Arbeitstage: Wochenenden und Feiertage verbrauchen keinen
 * Urlaub. Alles hier ist reine Rechnung ohne Zustand, damit sich die Fälle an
 * Jahresgrenzen und um Feiertage herum einzeln prüfen lassen.
 */

export type Balance = {
  memberId: ID;
  year: number;
  /** Jahresanspruch in Tagen. */
  entitlement: number;
  /** Übertrag aus dem Vorjahr. */
  carryOver: number;
  /** Bereits vergangene Urlaubstage. */
  taken: number;
  /** Eingetragene Urlaubstage in der Zukunft. */
  planned: number;
  /** Anspruch + Übertrag − genommen − geplant. */
  remaining: number;
};

/** Alle Tage eines Zeitraums, Anfang und Ende eingeschlossen. */
export function datesInRange(startDate: string, endDate: string): string[] {
  if (endDate < startDate) return [];
  const count = diffDays(endDate, startDate);
  return Array.from({ length: count + 1 }, (_, i) => addDays(startDate, i));
}

export function isWeekend(date: string): boolean {
  return weekdayIndex(date) >= 5;
}

/**
 * Zählt die Arbeitstage eines Zeitraums – ohne Wochenenden und Feiertage.
 * `holidays` ist ein Nachschlagewerk Datum → Name.
 */
export function workdaysInRange(
  startDate: string,
  endDate: string,
  holidays: Map<string, string>,
): number {
  return datesInRange(startDate, endDate).filter(
    (date) => !isWeekend(date) && !holidays.has(date),
  ).length;
}

/** Beschneidet einen Zeitraum auf ein Kalenderjahr; null, wenn er nicht hineinragt. */
export function clipToYear(
  startDate: string,
  endDate: string,
  year: number,
): { startDate: string; endDate: string } | null {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const start = startDate > from ? startDate : from;
  const end = endDate < to ? endDate : to;
  return end < start ? null : { startDate: start, endDate: end };
}

/**
 * Urlaubstage einer Abwesenheit innerhalb eines Jahres.
 * Nur Abwesenheiten der Art "urlaub" verbrauchen Anspruch; Krankheit und
 * Feiertagsbrücken nicht.
 */
export function leaveDaysOf(
  absence: Absence,
  year: number,
  holidays: Map<string, string>,
): number {
  if (absence.kind !== 'urlaub') return 0;
  const clipped = clipToYear(absence.startDate, absence.endDate, year);
  if (!clipped) return 0;
  return workdaysInRange(clipped.startDate, clipped.endDate, holidays);
}

/**
 * Kontostand einer Person für ein Jahr.
 * `today` trennt genommen von geplant: was heute oder früher endete, gilt als
 * genommen.
 */
export function balanceFor(
  member: Member,
  year: number,
  absences: Absence[],
  leaveYears: LeaveYear[],
  holidays: Map<string, string>,
  today: string,
): Balance {
  const override = leaveYears.find((entry) => entry.memberId === member.id && entry.year === year);
  const entitlement = override?.entitlementDays ?? member.annualLeaveDays;
  const carryOver = override?.carryOverDays ?? 0;

  let taken = 0;
  let planned = 0;
  for (const absence of absences) {
    if (absence.memberId !== member.id) continue;
    const days = leaveDaysOf(absence, year, holidays);
    if (days === 0) continue;
    // Ein laufender Urlaub zählt zum bereits genommenen – er ist gebucht.
    if (absence.startDate <= today) taken += days;
    else planned += days;
  }

  return {
    memberId: member.id,
    year,
    entitlement,
    carryOver,
    taken,
    planned,
    remaining: entitlement + carryOver - taken - planned,
  };
}

/** Alle Abwesenheiten, die einen bestimmten Tag berühren. */
export function absencesOn(absences: Absence[], date: string): Absence[] {
  return absences.filter((a) => a.startDate <= date && date <= a.endDate);
}

/** Zeiträume, in denen beide gleichzeitig frei haben. */
export function overlappingDays(a: Absence, b: Absence): string[] {
  const start = a.startDate > b.startDate ? a.startDate : b.startDate;
  const end = a.endDate < b.endDate ? a.endDate : b.endDate;
  return datesInRange(start, end);
}

export const ABSENCE_LABELS: Record<Absence['kind'], string> = {
  urlaub: 'Urlaub',
  gleitzeit: 'Gleitzeit',
  krank: 'Krank',
  sonstiges: 'Sonstiges',
};
