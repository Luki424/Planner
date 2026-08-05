import { toISODate } from './dates';

/**
 * Gesetzliche Feiertage in Deutschland.
 *
 * Berechnet statt nachgeschlagen: ein Dienst von außen wäre eine Abhängigkeit
 * ohne Not, und die Regeln ändern sich praktisch nie. Damit funktioniert die
 * Urlaubsrechnung auch ohne Netz.
 */

export const BUNDESLAENDER = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
} as const;

export type Bundesland = keyof typeof BUNDESLAENDER;

export type Holiday = { date: string; name: string };

const ALLE = Object.keys(BUNDESLAENDER) as Bundesland[];

/**
 * Ostersonntag nach dem Gaußschen Algorithmus in der Fassung von Meeus.
 * Alle beweglichen Feiertage hängen daran.
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function shift(base: Date, days: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return toISODate(d);
}

function fixed(year: number, month: number, day: number): string {
  return toISODate(new Date(year, month - 1, day));
}

/**
 * Buß- und Bettag: der Mittwoch vor dem 23. November, also immer im
 * Fenster 16.–22. November.
 */
function bussUndBettag(year: number): string {
  for (let day = 16; day <= 22; day += 1) {
    const date = new Date(year, 10, day);
    if (date.getDay() === 3) return toISODate(date);
  }
  // Kann nicht eintreten – in sieben Tagen liegt immer ein Mittwoch.
  return fixed(year, 11, 22);
}

type Rule = { name: string; date: (year: number, easter: Date) => string; laender: Bundesland[] };

const RULES: Rule[] = [
  { name: 'Neujahr', date: (y) => fixed(y, 1, 1), laender: ALLE },
  { name: 'Heilige Drei Könige', date: (y) => fixed(y, 1, 6), laender: ['BW', 'BY', 'ST'] },
  { name: 'Internationaler Frauentag', date: (y) => fixed(y, 3, 8), laender: ['BE', 'MV'] },
  { name: 'Karfreitag', date: (_, e) => shift(e, -2), laender: ALLE },
  { name: 'Ostersonntag', date: (_, e) => shift(e, 0), laender: ['BB'] },
  { name: 'Ostermontag', date: (_, e) => shift(e, 1), laender: ALLE },
  { name: 'Tag der Arbeit', date: (y) => fixed(y, 5, 1), laender: ALLE },
  { name: 'Christi Himmelfahrt', date: (_, e) => shift(e, 39), laender: ALLE },
  { name: 'Pfingstsonntag', date: (_, e) => shift(e, 49), laender: ['BB'] },
  { name: 'Pfingstmontag', date: (_, e) => shift(e, 50), laender: ALLE },
  {
    name: 'Fronleichnam',
    date: (_, e) => shift(e, 60),
    laender: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'],
  },
  { name: 'Mariä Himmelfahrt', date: (y) => fixed(y, 8, 15), laender: ['SL'] },
  { name: 'Weltkindertag', date: (y) => fixed(y, 9, 20), laender: ['TH'] },
  { name: 'Tag der Deutschen Einheit', date: (y) => fixed(y, 10, 3), laender: ALLE },
  {
    name: 'Reformationstag',
    date: (y) => fixed(y, 10, 31),
    laender: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'],
  },
  { name: 'Allerheiligen', date: (y) => fixed(y, 11, 1), laender: ['BW', 'BY', 'NW', 'RP', 'SL'] },
  { name: 'Buß- und Bettag', date: (y) => bussUndBettag(y), laender: ['SN'] },
  { name: '1. Weihnachtstag', date: (y) => fixed(y, 12, 25), laender: ALLE },
  { name: '2. Weihnachtstag', date: (y) => fixed(y, 12, 26), laender: ALLE },
];

/**
 * Alle Feiertage eines Jahres für ein Bundesland, nach Datum sortiert.
 *
 * Bekannte Vereinfachungen: Mariä Himmelfahrt gilt in Bayern nur in
 * überwiegend katholischen Gemeinden, Fronleichnam zusätzlich in einzelnen
 * Gemeinden Sachsens und Thüringens. Solche Sonderfälle hängen am Wohnort und
 * lassen sich nicht aus dem Bundesland ableiten – wer betroffen ist, trägt den
 * Tag als freien Tag ein.
 */
export function holidaysFor(year: number, land: Bundesland): Holiday[] {
  const easter = easterSunday(year);
  return RULES.filter((rule) => rule.laender.includes(land))
    .map((rule) => ({ date: rule.date(year, easter), name: rule.name }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Nachschlagewerk Datum → Name, für die schnelle Prüfung ganzer Zeiträume. */
export function holidayMap(years: number[], land: Bundesland): Map<string, string> {
  const map = new Map<string, string>();
  for (const year of years) {
    for (const holiday of holidaysFor(year, land)) map.set(holiday.date, holiday.name);
  }
  return map;
}
