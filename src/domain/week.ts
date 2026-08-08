import { isoWeekNumber } from './dates';
import { allDayBlocks, plannedMinutes, timedBlocks } from './scheduling';
import type { Block } from './types';

/**
 * Der Blick auf eine ganze Kalenderwoche.
 *
 * Die sieben Spalten zeigen jeden Termin einzeln – aber nicht, ob die Woche
 * als Ganzes zu voll ist und wo noch Luft bleibt. Genau das steht hier: eine
 * Zeile, die man liest, bevor man sich in die Spalten vertieft.
 */

export type Tagesblick = {
  date: string;
  minuten: number;
  /** Termine mit Uhrzeit. Ganztägiges zählt nicht in die Auslastung. */
  termine: number;
  ganztags: number;
  /** Über der Tageskapazität? */
  voll: boolean;
};

export type Wochenblick = {
  kw: number;
  /** Termine mit Uhrzeit in der ganzen Woche. */
  termine: number;
  ganztags: number;
  minuten: number;
  /** Tageskapazität mal sieben – der Bezug, gegen den die Auslastung zählt. */
  kapazitaetMinuten: number;
  auslastung: number;
  proTag: Tagesblick[];
  /** Der vollste Tag, sofern überhaupt etwas geplant ist. */
  vollster: Tagesblick | null;
  /** Tage ganz ohne Eintrag. */
  freieTage: Tagesblick[];
  /** Tage über der Tageskapazität. */
  volleTage: Tagesblick[];
};

/**
 * Fasst eine Woche zusammen.
 *
 * `blocks` ist bereits gefiltert – die Zusammenfassung entscheidet nicht,
 * was sichtbar ist, sondern rechnet nur, was ihr gegeben wird. Sonst zeigte
 * die Zeile andere Zahlen als die Spalten darunter.
 */
export function weekSummary(days: string[], blocks: Block[], capacityMin: number): Wochenblick {
  const proTag: Tagesblick[] = days.map((date) => {
    const desTages = blocks.filter((b) => b.date === date);
    const minuten = plannedMinutes(desTages);
    return {
      date,
      minuten,
      termine: timedBlocks(desTages).length,
      ganztags: allDayBlocks(desTages).length,
      voll: capacityMin > 0 && minuten > capacityMin,
    };
  });

  const minuten = proTag.reduce((sum, tag) => sum + tag.minuten, 0);
  const kapazitaetMinuten = capacityMin * days.length;
  /*
   * Der vollste Tag nur, wenn überhaupt etwas ansteht: „am vollsten: Montag
   * mit null Minuten" wäre eine Auskunft, die niemand braucht.
   */
  const vollster = proTag.reduce<Tagesblick | null>(
    (beste, tag) => (tag.minuten > 0 && (!beste || tag.minuten > beste.minuten) ? tag : beste),
    null,
  );

  return {
    kw: days.length > 0 ? isoWeekNumber(days[0]) : 0,
    termine: proTag.reduce((sum, tag) => sum + tag.termine, 0),
    ganztags: proTag.reduce((sum, tag) => sum + tag.ganztags, 0),
    minuten,
    kapazitaetMinuten,
    auslastung: kapazitaetMinuten > 0 ? Math.round((minuten / kapazitaetMinuten) * 100) : 0,
    proTag,
    vollster,
    freieTage: proTag.filter((tag) => tag.termine === 0 && tag.ganztags === 0),
    volleTage: proTag.filter((tag) => tag.voll),
  };
}
