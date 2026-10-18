/**
 * „1 Termin", „2 Termine" – nicht „1 Termine".
 *
 * Gefunden bei einem Rundgang durch alle Ansichten: „1 Zutaten", „1 Termine
 * übernommen", „1 Einträge stammen aus einem Kalender". Jede Stelle hatte
 * die Mehrzahl fest eingebaut, weil beim Schreiben selten genau eins da war.
 */
export function anzahl(n: number, einzahl: string, mehrzahl: string): string {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`;
}
