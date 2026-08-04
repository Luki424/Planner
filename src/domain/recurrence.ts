import { daysInMonth, diffDays, parseISODate, startOfWeek, weekdayIndex } from './dates';
import type { RecurrencePattern, Series } from './types';

/** Trifft das Muster auf diesen Tag zu? (Start-/Enddatum werden hier nicht geprüft.) */
export function patternMatches(pattern: RecurrencePattern, date: string, startDate: string): boolean {
  switch (pattern.type) {
    case 'daily': {
      const interval = Math.max(1, pattern.interval);
      const delta = diffDays(date, startDate);
      return delta >= 0 && delta % interval === 0;
    }
    case 'weekly': {
      const interval = Math.max(1, pattern.interval);
      if (!pattern.weekdays.includes(weekdayIndex(date))) return false;
      const weeks = diffDays(startOfWeek(date), startOfWeek(startDate)) / 7;
      return weeks >= 0 && weeks % interval === 0;
    }
    case 'monthly': {
      const d = parseISODate(date);
      const last = daysInMonth(d.getFullYear(), d.getMonth());
      // Der 31. eines Monats fällt in kurzen Monaten auf den letzten Tag.
      const target = Math.min(pattern.day, last);
      return d.getDate() === target;
    }
  }
}

/** Erzeugt die Serie an diesem Tag eine Aufgabe? */
export function seriesOccursOn(series: Series, date: string): boolean {
  if (!series.active) return false;
  if (date < series.startDate) return false;
  if (series.endDate && date > series.endDate) return false;
  if (series.skipped.includes(date)) return false;
  return patternMatches(series.pattern, date, series.startDate);
}

export function describePattern(pattern: RecurrencePattern): string {
  switch (pattern.type) {
    case 'daily':
      return pattern.interval === 1 ? 'täglich' : `alle ${pattern.interval} Tage`;
    case 'weekly': {
      const names = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
      const days = [...pattern.weekdays].sort((a, b) => a - b).map((d) => names[d]);
      const prefix = pattern.interval === 1 ? 'wöchentlich' : `alle ${pattern.interval} Wochen`;
      return days.length ? `${prefix} · ${days.join(', ')}` : prefix;
    }
    case 'monthly':
      return `monatlich am ${pattern.day}.`;
  }
}
