import { daysInMonth, parseISODate, startOfWeek, toISODate } from './dates';

/**
 * Monatsraster.
 *
 * Ein Monat beginnt selten am Montag. Damit die Wochen als Zeilen lesbar
 * bleiben, wird vorne und hinten mit den Nachbartagen aufgefüllt – sie
 * gehören zum Bild, aber nicht zum Monat.
 */

const MONATSNAMEN = [
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

export function monthStart(iso: string): string {
  const d = parseISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function monthEnd(iso: string): string {
  const d = parseISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/**
 * Einen Monat weiter oder zurück, ausgehend von einem Datum.
 *
 * Der Tag im Monat wird gekappt, wenn der Zielmonat kürzer ist. Ohne das
 * würde aus dem 31. Januar plus einem Monat der 3. März – man landete beim
 * Blättern im übernächsten Monat.
 */
export function shiftMonthByDate(iso: string, delta: number): string {
  const d = parseISODate(iso);
  const jahr = d.getFullYear();
  const monat = d.getMonth() + delta;
  const ziel = new Date(jahr, monat, 1);
  const tag = Math.min(d.getDate(), daysInMonth(ziel.getFullYear(), ziel.getMonth()));
  return toISODate(new Date(ziel.getFullYear(), ziel.getMonth(), tag));
}

/**
 * Die Wochen des Monats als Zeilen, jede mit sieben Tagen von Montag an.
 * Immer volle Wochen – der erste und der letzte Streifen ragen in die
 * Nachbarmonate hinein.
 */
export function monthGrid(iso: string): string[][] {
  const ersterTag = startOfWeek(monthStart(iso));
  const letzterTag = monthEnd(iso);

  const wochen: string[][] = [];
  let cursor = parseISODate(ersterTag);

  // Solange, bis der letzte Tag des Monats in einer fertigen Woche steckt.
  do {
    const woche: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      woche.push(toISODate(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
    wochen.push(woche);
  } while (wochen[wochen.length - 1][6] < letzterTag);

  return wochen;
}

/** Gehört dieser Tag zum Monat des Ankerdatums – oder nur zum Rand? */
export function isSameMonth(iso: string, anchor: string): boolean {
  return iso.slice(0, 7) === anchor.slice(0, 7);
}

/** „August 2026" */
export function monthLabel(iso: string): string {
  const d = parseISODate(iso);
  return `${MONATSNAMEN[d.getMonth()]} ${d.getFullYear()}`;
}

/** „Aug 2026" – für die schmale Kopfzeile am Handy. */
export function monthLabelShort(iso: string): string {
  const d = parseISODate(iso);
  return `${MONATSNAMEN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}
