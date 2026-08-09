import { SYNCED_COLLECTIONS, type AppState, type SyncedCollection } from '../domain/types';

/** Ein- und Mehrzahl je Sammlung – nur für die Warnung vor dem Beitreten. */
const LABELS: Record<SyncedCollection, [string, string]> = {
  contexts: ['Bereich', 'Bereiche'],
  taskLists: ['Liste', 'Listen'],
  tasks: ['Aufgabe', 'Aufgaben'],
  blocks: ['Termin', 'Termine'],
  series: ['Serie', 'Serien'],
  shopping: ['Einkaufseintrag', 'Einkaufseinträge'],
  members: ['Person', 'Personen'],
  absences: ['Abwesenheit', 'Abwesenheiten'],
  leaveYears: ['Urlaubsjahr', 'Urlaubsjahre'],
  anniversaries: ['Jahrestag', 'Jahrestage'],
  trips: ['Reise', 'Reisen'],
  tripItems: ['Packeintrag', 'Packeinträge'],
  recipes: ['Rezept', 'Rezepte'],
  recipeIngredients: ['Zutat', 'Zutaten'],
  meals: ['Essensplan-Eintrag', 'Essensplan-Einträge'],
  expenses: ['Ausgabe', 'Ausgaben'],
  recurringExpenses: ['Fixkosten-Regel', 'Fixkosten-Regeln'],
  receipts: ['Beleg', 'Belege'],
  trash: ['gelöschter Eintrag', 'gelöschte Einträge'],
};

export type LocalSummary = {
  /** Steht hier genug, dass ein Beitritt etwas kosten könnte? */
  warn: boolean;
  /** Menschenlesbar, z.B. ["12 Aufgaben", "3 Termine"]. */
  parts: string[];
};

/**
 * Was auf diesem Gerät liegt.
 *
 * Beim Beitreten übernimmt das Gerät den Stand des Haushalts. Sammlungen, in
 * denen der Haushalt schon etwas hat, ersetzen die hiesigen – nur wo er noch
 * leer ist, wandert der lokale Stand hinauf. Wer hier also schon gearbeitet
 * hat, soll das vorher wissen.
 *
 * Bereiche lösen die Warnung nicht aus: zwei davon legt die App beim ersten
 * Start selbst an. Zählten sie mit, erschiene die Warnung auch auf einem
 * frisch eingerichteten Gerät – und eine Warnung, die immer kommt, liest
 * nach dem zweiten Mal niemand mehr. In der Aufzählung stehen sie trotzdem.
 */
export function localSummary(state: AppState): LocalSummary {
  const parts: string[] = [];
  let eigene = 0;

  for (const name of SYNCED_COLLECTIONS) {
    const anzahl = state[name].length;
    if (anzahl === 0) continue;
    const [einzahl, mehrzahl] = LABELS[name];
    parts.push(`${anzahl} ${anzahl === 1 ? einzahl : mehrzahl}`);
    if (name !== 'contexts') eigene += anzahl;
  }

  return { warn: eigene > 0, parts };
}
