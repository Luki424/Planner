import { PRICE_MEMORY_LIMIT, type PriceMemoryEntry, type ShoppingItem } from './types';

/**
 * Preisgedächtnis der Einkaufsliste.
 *
 * Reine Funktionen ohne Zustand – dadurch lassen sich Vereinheitlichung,
 * Verdrängung und Vorschlagsreihenfolge einzeln prüfen.
 */

export type PriceMemory = Record<string, PriceMemoryEntry>;

/**
 * Vereinheitlicht einen Artikelnamen für den Abgleich: Groß-/Kleinschreibung,
 * Mehrfach-Leerzeichen und Umlautschreibweisen sollen keine zwei Einträge
 * ergeben ("Müsli" und "Muesli" sind derselbe Artikel).
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/** Merkt sich einen Preis und verdrängt bei Bedarf die ältesten Einträge. */
export function rememberPrice(
  memory: PriceMemory,
  name: string,
  cents: number,
  at = new Date().toISOString(),
): PriceMemory {
  const key = normalizeName(name);
  if (!key || cents <= 0) return memory;

  // Unverändert? Dann dasselbe Objekt zurückgeben – die Sync-Schicht erkennt
  // Änderungen an der Objektgleichheit und schriebe sonst ohne Anlass.
  const known = memory[key];
  if (known && known.cents === cents && known.name === name.trim()) return memory;

  const next: PriceMemory = { ...memory, [key]: { cents, at, name: name.trim() } };

  const keys = Object.keys(next);
  if (keys.length <= PRICE_MEMORY_LIMIT) return next;

  // Ältestes zuerst verdrängen – der frisch gemerkte Eintrag bleibt.
  const byAge = keys.sort((a, b) => (next[a].at < next[b].at ? -1 : 1));
  for (const stale of byAge.slice(0, keys.length - PRICE_MEMORY_LIMIT)) {
    delete next[stale];
  }
  return next;
}

/** Was hat dieser Artikel zuletzt gekostet? */
export function recallPrice(memory: PriceMemory, name: string): number | null {
  return memory[normalizeName(name)]?.cents ?? null;
}

export type Suggestion = { name: string; cents: number | null };

/**
 * Vorschläge zum Getippten. Einträge, die mit der Eingabe beginnen, stehen vor
 * solchen, die sie nur enthalten; innerhalb einer Gruppe zählt der jüngste
 * Kauf zuerst. Bereits auf der Liste stehende Artikel fallen weg – sie
 * vorzuschlagen wäre nur eine Einladung zum Doppeleintrag.
 */
export function suggestItems(
  memory: PriceMemory,
  displayNames: Map<string, string>,
  query: string,
  onList: ShoppingItem[],
  limit = 4,
): Suggestion[] {
  const needle = normalizeName(query);
  if (needle.length < 1) return [];

  const taken = new Set(onList.filter((item) => !item.done).map((item) => normalizeName(item.name)));

  const scored = Object.entries(memory)
    .filter(([key]) => key.includes(needle) && !taken.has(key) && key !== needle)
    .map(([key, entry]) => ({
      key,
      entry,
      startsWith: key.startsWith(needle),
    }))
    .sort((a, b) => {
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      return a.entry.at > b.entry.at ? -1 : 1;
    });

  return scored.slice(0, limit).map(({ key, entry }) => ({
    // Die gemerkte Schreibweise gewinnt: sie überlebt auch das Aufräumen
    // der Liste, aus der displayNames stammt.
    name: entry.name || displayNames.get(key) || key,
    cents: entry.cents,
  }));
}

/**
 * Sammelt die zuletzt benutzte Schreibweise je Artikel, damit Vorschläge
 * "Müsli" anzeigen und nicht den vereinheitlichten Schlüssel "muesli".
 */
export function collectDisplayNames(items: ShoppingItem[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const item of [...items].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
    names.set(normalizeName(item.name), item.name.trim());
  }
  return names;
}
