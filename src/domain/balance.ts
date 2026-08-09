import { WEEKDAY_SHORT, addDays, weekdayIndex } from './dates';
import { blockMemberIds } from './people';
import { allDayBlocks, plannedMinutes, timedBlocks } from './scheduling';
import type { Block, Context, ID, Member, Task } from './types';

/**
 * Wo geht die Zeit hin?
 *
 * Der Tagesplan beantwortet „passt das noch rein", die Woche „ist zu viel
 * drin". Diese Auswertung beantwortet die Frage, die man sich erst nach ein
 * paar Monaten stellt: *Wohin* geht sie eigentlich – und geht sie bei uns
 * beiden gleichmäßig hin?
 *
 * Gerechnet wird nur mit Geplantem, nicht mit Gelebtem. Der Planer weiß
 * nicht, ob ein Termin stattgefunden hat; er weiß, was vorgesehen war. Das
 * ist die ehrlichere Aussage und die einzige, die er belegen kann.
 */

export type Zeitraum = { von: string; bis: string; label: string };

/** Die üblichen Zeiträume. Weiter zurück lohnt selten – der Plan ändert sich. */
export function zeitraeume(heute: string): Zeitraum[] {
  return [
    { von: addDays(heute, -27), bis: heute, label: 'letzte 4 Wochen' },
    { von: addDays(heute, -90), bis: heute, label: 'letzte 3 Monate' },
    { von: addDays(heute, -364), bis: heute, label: 'letztes Jahr' },
  ];
}

export type Anteil = {
  id: ID;
  name: string;
  farbe?: string;
  minuten: number;
  /** Prozent an der Gesamtzeit, gerundet. */
  prozent: number;
};

export type Bilanz = {
  /** Summe aller verplanten Minuten mit Uhrzeit. */
  minuten: number;
  /** Wie viele Tage der Zeitraum umfasst. */
  tage: number;
  /** Wie viele Termine mit Uhrzeit. */
  termine: number;
  /** Ganztägiges zählt eigens – es belegt keine Stunden. */
  ganztags: number;
  /** Durchschnitt je Woche, in Minuten. */
  proWoche: number;
  nachBereich: Anteil[];
  nachPerson: Anteil[];
  /** Minuten je Wochentag, Montag zuerst. */
  proWochentag: number[];
  /** Der Wochentag mit der meisten Zeit, oder null wenn nichts geplant war. */
  vollsterTag: { index: number; name: string; minuten: number } | null;
  /** Tage über der Tageskapazität. */
  ueberTage: number;
  /** Tage ganz ohne Termin. */
  freieTage: number;
};

function anteile(
  roh: Array<{ id: ID; name: string; farbe?: string; minuten: number }>,
  gesamt: number,
): Anteil[] {
  return roh
    .filter((e) => e.minuten > 0)
    .map((e) => ({ ...e, prozent: gesamt > 0 ? Math.round((e.minuten / gesamt) * 100) : 0 }))
    .sort((a, b) => b.minuten - a.minuten);
}

/**
 * Rechnet einen Zeitraum aus.
 *
 * `blocks` ist bereits gefiltert – die Auswertung entscheidet nicht, was
 * zählt, sondern rechnet, was ihr gegeben wird.
 */
export function timeBalance(
  blocks: Block[],
  tasks: Task[],
  contexts: Context[],
  members: Member[],
  zeitraum: Zeitraum,
  capacityMin: number,
): Bilanz {
  const drin = blocks.filter((b) => b.date >= zeitraum.von && b.date <= zeitraum.bis);
  const mitUhrzeit = timedBlocks(drin);
  const minuten = plannedMinutes(drin);

  const tage =
    Math.round((Date.parse(zeitraum.bis) - Date.parse(zeitraum.von)) / (24 * 60 * 60 * 1000)) + 1;

  // --- Nach Bereich ---
  const jeBereich = new Map<ID, number>();
  for (const block of mitUhrzeit) {
    jeBereich.set(block.contextId, (jeBereich.get(block.contextId) ?? 0) + block.durationMin);
  }

  /*
   * Nach Person. Ein Termin für zwei zählt bei beiden voll – die Frage ist
   * „wie viel steht bei dir an", nicht „wie teilen wir die Stunde auf".
   * Ohne Zuordnung gilt er für alle und taucht deshalb nirgends auf; sonst
   * hinge die Aussage daran, wie fleißig jemand Häkchen setzt.
   */
  const jePerson = new Map<ID, number>();
  for (const block of mitUhrzeit) {
    for (const id of blockMemberIds(block, tasks)) {
      jePerson.set(id, (jePerson.get(id) ?? 0) + block.durationMin);
    }
  }

  // --- Nach Wochentag ---
  const proWochentag = [0, 0, 0, 0, 0, 0, 0];
  for (const block of mitUhrzeit) proWochentag[weekdayIndex(block.date)] += block.durationMin;
  const bester = proWochentag.reduce((beste, min, i) => (min > proWochentag[beste] ? i : beste), 0);

  // --- Tage über der Kapazität, Tage ohne alles ---
  const jeTag = new Map<string, number>();
  for (const block of mitUhrzeit) {
    jeTag.set(block.date, (jeTag.get(block.date) ?? 0) + block.durationMin);
  }
  const ueberTage =
    capacityMin > 0 ? [...jeTag.values()].filter((min) => min > capacityMin).length : 0;

  return {
    minuten,
    tage,
    termine: mitUhrzeit.length,
    ganztags: allDayBlocks(drin).length,
    proWoche: tage > 0 ? Math.round((minuten / tage) * 7) : 0,
    nachBereich: anteile(
      contexts.map((c) => ({
        id: c.id,
        name: c.name,
        farbe: c.color,
        minuten: jeBereich.get(c.id) ?? 0,
      })),
      minuten,
    ),
    nachPerson: anteile(
      members.map((m) => ({
        id: m.id,
        name: m.name,
        farbe: m.color,
        minuten: jePerson.get(m.id) ?? 0,
      })),
      // Bezug ist die Summe über die Personen, nicht die Gesamtzeit: Ein
      // gemeinsamer Termin steckt bei beiden drin, sonst käme über 100 %.
      [...jePerson.values()].reduce((s, m) => s + m, 0),
    ),
    proWochentag,
    vollsterTag:
      proWochentag[bester] > 0
        ? { index: bester, name: WEEKDAY_SHORT[bester], minuten: proWochentag[bester] }
        : null,
    ueberTage,
    freieTage: tage - jeTag.size,
  };
}
