import type { Block, Settings } from './types';

export type Interval = { startMin: number; endMin: number };

export function blockEnd(b: Block): number {
  return b.startMin + b.durationMin;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

/** Rundet auf das Raster der Zeitachse. */
export function snap(min: number, slotMin: number): number {
  return Math.round(min / slotMin) * slotMin;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Sucht die erste freie Lücke des Tages, in die `durationMin` passt.
 * Fällt auf das Tagesende zurück, wenn der Tag durchgehend belegt ist.
 */
export function findFreeSlot(
  dayBlocks: Block[],
  durationMin: number,
  settings: Settings,
  preferFrom?: number,
): number {
  const from = clamp(
    snap(preferFrom ?? settings.dayStartMin, settings.slotMin),
    settings.dayStartMin,
    settings.dayEndMin,
  );
  // Ganztägige Einträge belegen keine Uhrzeit – sie dürfen die Suche nach
  // einer freien Lücke nicht blockieren.
  const busy = dayBlocks
    .filter((b) => !b.allDay)
    .map((b) => ({ startMin: b.startMin, endMin: blockEnd(b) }))
    .sort((a, b) => a.startMin - b.startMin);

  let cursor = from;
  for (const interval of busy) {
    if (interval.endMin <= cursor) continue;
    if (interval.startMin - cursor >= durationMin) return cursor;
    cursor = Math.max(cursor, interval.endMin);
  }
  if (cursor + durationMin <= settings.dayEndMin) return cursor;
  // Kein Platz mehr: ans Ende hängen, der Nutzer sieht die Überlastung.
  return clamp(settings.dayEndMin - durationMin, settings.dayStartMin, settings.dayEndMin);
}

/**
 * Legt Blöcke, die sich zeitlich überschneiden, nebeneinander.
 * Liefert pro Block Spaltenindex und Spaltenanzahl seiner Gruppe.
 */
export function layoutBlocks(blocks: Block[]): Map<string, { column: number; columns: number }> {
  const sorted = [...blocks].sort(
    (a, b) => a.startMin - b.startMin || a.durationMin - b.durationMin,
  );
  const result = new Map<string, { column: number; columns: number }>();

  let group: Block[] = [];
  let groupEnd = -1;

  const flush = () => {
    if (!group.length) return;
    const columnEnds: number[] = [];
    const assigned: Array<{ id: string; column: number }> = [];
    for (const block of group) {
      let column = columnEnds.findIndex((end) => end <= block.startMin);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(blockEnd(block));
      } else {
        columnEnds[column] = blockEnd(block);
      }
      assigned.push({ id: block.id, column });
    }
    for (const entry of assigned) {
      result.set(entry.id, { column: entry.column, columns: columnEnds.length });
    }
    group = [];
    groupEnd = -1;
  };

  for (const block of sorted) {
    if (group.length && block.startMin >= groupEnd) flush();
    group.push(block);
    groupEnd = Math.max(groupEnd, blockEnd(block));
  }
  flush();

  return result;
}

/**
 * Wie viel ein Block vom Tag wegnimmt.
 *
 * Ganztägiges zählt nicht mit. Zuerst war es umgekehrt gelöst – ein
 * ganztägiger Eintrag belegte die volle Tageskapazität, damit ein Tag mit
 * Fortbildung nicht leer aussieht. In der Benutzung war das falsch: „Kita
 * geschlossen" oder ein Geburtstag machen den Tag nicht voll, färbten den
 * Balken aber rot. Die Auslastung beantwortet, wie viel *Zeit* verplant ist;
 * dass etwas Ganztägiges ansteht, zeigt der Streifen darüber.
 */
export function effectiveMinutes(block: Block): number {
  return block.allDay ? 0 : block.durationMin;
}

export function plannedMinutes(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + effectiveMinutes(b), 0);
}

/** Ganztägige Einträge stehen nicht auf der Zeitachse. */
export function timedBlocks(blocks: Block[]): Block[] {
  return blocks.filter((b) => !b.allDay);
}

export function allDayBlocks(blocks: Block[]): Block[] {
  return blocks.filter((b) => b.allDay);
}
