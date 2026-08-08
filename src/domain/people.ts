import { effectiveMinutes } from './scheduling';
import type { Block, ID, Member, Task } from './types';

/**
 * Zuständigkeiten. Personen gab es zuerst nur im Urlaubsplaner; seit Aufgaben,
 * Termine und Serien ebenfalls eine Zuordnung tragen, liegen die Regeln dafür
 * hier an einer Stelle.
 *
 * Grundsatz: eine leere Zuordnung heißt "noch offen", nicht "niemand". Solche
 * Einträge bleiben deshalb immer sichtbar – sonst verschwände genau das aus
 * dem Blick, worüber man sich noch einigen muss.
 */

/** Ältere Stände kennen das Feld nicht; fehlende Zuordnung ist leer. */
export function memberIdsOf(entity: { memberIds?: ID[] }): ID[] {
  return entity.memberIds ?? [];
}

/**
 * Wer bei einem Block zuständig ist. Hängt er an einer Aufgabe, zählt deren
 * Zuordnung – nur fixe Termine führen eine eigene.
 */
export function blockMemberIds(block: Block, tasks: Task[]): ID[] {
  if (!block.taskId) return memberIdsOf(block);
  const task = tasks.find((t) => t.id === block.taskId);
  return task ? memberIdsOf(task) : [];
}

/**
 * Sichtbar bei einem Personenfilter? Ohne Zuordnung immer, sonst sobald
 * mindestens eine beteiligte Person eingeblendet ist.
 */
export function matchesMembers(ids: ID[], visible: Set<ID>): boolean {
  if (ids.length === 0) return true;
  return ids.some((id) => visible.has(id));
}

/** Eine Person aus- oder abwählen. */
export function toggleMember(ids: ID[], id: ID): ID[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/**
 * Nur die Personen, die es noch gibt. Wird eine Person gelöscht, bleiben ihre
 * Verweise in Aufgaben stehen; sie dürfen nicht als leere Punkte auftauchen.
 */
export function knownMembers(ids: ID[], members: Member[]): Member[] {
  return ids.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => Boolean(m));
}

/** Kürzel für den farbigen Punkt – erster Buchstabe reicht bei zwei Personen. */
export function initialOf(member: Member): string {
  return member.name.trim().slice(0, 1).toUpperCase() || '?';
}

/**
 * Verplante Minuten je Person für einen Satz Blöcke. Ein Termin, den sich zwei
 * teilen, zählt für beide voll: die Zeit ist bei beiden weg.
 */
export function minutesPerMember(
  blocks: Block[],
  tasks: Task[],
  capacityMin: number,
): Map<ID, number> {
  const out = new Map<ID, number>();
  for (const block of blocks) {
    for (const id of blockMemberIds(block, tasks)) {
      out.set(id, (out.get(id) ?? 0) + effectiveMinutes(block, capacityMin));
    }
  }
  return out;
}
