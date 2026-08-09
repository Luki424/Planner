import { formatDateShort } from './dates';
import type { Entity, ID, SyncedCollection } from './types';

/**
 * Der Papierkorb.
 *
 * Bis hierher war jedes Löschen sofort und endgültig – und über die
 * Synchronisation eine Sekunde später auch beim anderen weg. Ein Fehlgriff
 * am Handy war damit nicht mehr zu retten, und gerade dort passiert er:
 * Das Kreuz zum Löschen sitzt einen Daumen neben dem Häkchen zum Abhaken.
 *
 * Deshalb wandert Gelöschtes zuerst hierher. Der Papierkorb wird
 * mitsynchronisiert: Wer zurückholt, muss nicht derjenige sein, der gelöscht
 * hat.
 */

/** Ein gelöschter Eintrag samt der Sammlung, in die er zurückgehört. */
export type TrashItem = { collection: SyncedCollection; entity: Entity };

export type TrashEntry = {
  id: ID;
  /** Was es war, in Worten: „Aufgabe „Steuer machen"". */
  label: string;
  /*
   * Mehrere Dinge, weil manches zusammengehört: Eine Ausgabe nimmt ihren
   * Beleg mit, eine Reise ihre Punkte. Zurück kommt dann auch alles – sonst
   * wäre das Wiederherstellen ein halbes.
   */
  items: TrashItem[];
  /** YYYY-MM-DD; für die Aufräumfrist reicht der Tag. */
  deletedOn: string;
  deletedAt: string;
  deletedBy: string | null;
};

/**
 * So lange bleibt Gelöschtes liegen.
 *
 * Lang genug, dass ein Versehen auffällt – auch eines, das erst beim
 * nächsten Blick in die Kasse auffällt. Kurz genug, dass der Papierkorb
 * nicht heimlich zum zweiten Datenbestand wird.
 */
export const TRASH_DAYS = 30;

/** Wie viele Einträge höchstens liegen bleiben, unabhängig vom Alter. */
export const TRASH_LIMIT = 100;

function tageSeit(deletedOn: string, heute: string): number {
  return Math.round((Date.parse(heute) - Date.parse(deletedOn)) / (24 * 60 * 60 * 1000));
}

/** Ist der Eintrag über die Frist hinaus? */
export function expired(entry: TrashEntry, heute: string): boolean {
  return tageSeit(entry.deletedOn, heute) >= TRASH_DAYS;
}

/**
 * Räumt auf: Abgelaufenes fliegt, und mehr als `TRASH_LIMIT` bleibt nicht
 * liegen. Das Neueste steht vorn.
 */
export function purge(entries: TrashEntry[], heute: string): TrashEntry[] {
  return entries
    .filter((e) => !expired(e, heute))
    .sort((a, b) => (a.deletedAt > b.deletedAt ? -1 : 1))
    .slice(0, TRASH_LIMIT);
}

/** „heute", „gestern", „vor 3 Tagen" – das, was man beim Lesen ausrechnet. */
export function describeAge(entry: TrashEntry, heute: string): string {
  const tage = tageSeit(entry.deletedOn, heute);
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'gestern';
  if (tage < 7) return `vor ${tage} Tagen`;
  return formatDateShort(entry.deletedOn);
}

/** Wie viele Tage bleiben noch, bis der Eintrag von selbst verschwindet? */
export function daysLeft(entry: TrashEntry, heute: string): number {
  return Math.max(0, TRASH_DAYS - tageSeit(entry.deletedOn, heute));
}
