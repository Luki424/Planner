import { formatDateShort, formatDuration, formatTime } from './dates';
import { describeOccurrence, nextOccurrence, KIND_LABELS } from './anniversaries';
import { formatEuro } from './voice';
import type { AppState } from './types';

/**
 * Suche über alles.
 *
 * Je voller der Planer wird, desto weniger hilft Blättern. Nach dem Einlesen
 * eines Arbeitskalenders liegen dreihundert Termine im Jahr – „wann war noch
 * mal der Zählertausch" ist dann keine Frage mehr, die man mit den Pfeiltasten
 * beantwortet.
 *
 * Eine Sammlung ist bewusst *nicht* dabei: Belege. Auf einem Bild steht kein
 * durchsuchbarer Text, und die Ausgabe daneben ist ohnehin auffindbar.
 */

export type TrefferArt =
  | 'aufgabe'
  | 'termin'
  | 'einkauf'
  | 'jahrestag'
  | 'reise'
  | 'ausgabe'
  | 'rezept';

/** Wohin ein Treffer führt. Der Aufrufer setzt Ansicht und Datum entsprechend. */
export type Ziel =
  | { view: 'day'; date: string }
  | { view: 'todo' }
  | { view: 'shopping'; karte: 'liste' | 'essen' | 'ausgaben' }
  | { view: 'vacation' };

export type Treffer = {
  id: string;
  art: TrefferArt;
  titel: string;
  /** Zweite Zeile: Datum, Bereich, Betrag – was den Treffer einordnet. */
  beschreibung: string;
  ziel: Ziel;
  /** Kleiner ist besser. Nur für die Sortierung, nie angezeigt. */
  rang: number;
};

export const ART_LABELS: Record<TrefferArt, string> = {
  aufgabe: 'Aufgabe',
  termin: 'Termin',
  einkauf: 'Einkauf',
  jahrestag: 'Jahrestag',
  reise: 'Reise',
  ausgabe: 'Ausgabe',
  rezept: 'Rezept',
};

export const ART_ICONS: Record<TrefferArt, string> = {
  aufgabe: '✓',
  termin: '🕘',
  einkauf: '🛒',
  jahrestag: '🎂',
  reise: '🧳',
  ausgabe: '💶',
  rezept: '🍽',
};

function normalisieren(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Wie gut passt der Text zur Suche? `null` heißt: gar nicht.
 *
 * Drei Stufen, und der Unterschied ist der zwischen brauchbar und ärgerlich:
 * Wer „arzt" sucht, will „Zahnarzt" finden – aber „Arzttermin" zuerst.
 *
 * Alle Suchwörter müssen vorkommen. „zahnarzt berger" soll den einen Termin
 * finden und nicht jeden Zahnarzt und jeden Berger.
 */
function passt(text: string, woerter: string[]): number | null {
  const heu = normalisieren(text);
  if (!heu) return null;
  let summe = 0;
  for (const wort of woerter) {
    const stelle = heu.indexOf(wort);
    if (stelle < 0) return null;
    // Am Anfang, am Wortanfang, irgendwo – in dieser Reihenfolge.
    summe += stelle === 0 ? 0 : heu[stelle - 1] === ' ' ? 1 : 3;
  }
  return summe;
}

/** Wie weit ist das Datum von heute weg? Näher zählt mehr. */
function naehe(datum: string | null, heute: string): number {
  if (!datum) return 40;
  const tage = Math.abs(
    Math.round((Date.parse(datum) - Date.parse(heute)) / (24 * 60 * 60 * 1000)),
  );
  // Gedeckelt: In drei Jahren ist alles gleich weit weg.
  return Math.min(60, tage / 20);
}

/**
 * Durchsucht den ganzen Planer.
 *
 * Gesucht wird in Titeln und Notizen, nicht in allem: Ein Treffer, den man
 * im Ergebnis nicht wiedererkennt, ist keiner.
 */
export function search(state: AppState, query: string, heute: string, limit = 40): Treffer[] {
  const woerter = normalisieren(query)
    .split(' ')
    .filter((w) => w.length >= 2);
  if (woerter.length === 0) return [];

  const treffer: Treffer[] = [];
  const nimm = (
    art: TrefferArt,
    id: string,
    titel: string,
    felder: string[],
    beschreibung: string,
    ziel: Ziel,
    zuschlag: number,
  ) => {
    /*
     * Der Titel zählt am meisten. Eine Notiz darf einen Treffer begründen,
     * soll ihn aber nicht vor einen Titeltreffer schieben.
     */
    const imTitel = passt(titel, woerter);
    const irgendwo = imTitel ?? passt([titel, ...felder].join(' '), woerter);
    if (irgendwo === null) return;
    treffer.push({
      id,
      art,
      titel,
      beschreibung,
      ziel,
      rang: (imTitel === null ? 12 : 0) + irgendwo + zuschlag,
    });
  };

  const bereich = (id: string) => state.contexts.find((c) => c.id === id)?.name ?? '';

  // --- Aufgaben ---
  for (const task of state.tasks) {
    const geplant = state.blocks.find((b) => b.taskId === task.id);
    const teile = [
      task.status === 'done' ? 'erledigt' : null,
      bereich(task.contextId),
      task.dueDate ? `fällig ${formatDateShort(task.dueDate)}` : null,
      task.allDay ? 'ganztägig' : task.estimateMin > 0 ? formatDuration(task.estimateMin) : null,
    ].filter(Boolean);
    nimm(
      'aufgabe',
      task.id,
      task.title,
      [task.notes ?? ''],
      teile.join(' · '),
      geplant ? { view: 'day', date: geplant.date } : { view: 'todo' },
      // Erledigtes steht hinten: Man sucht meist, was noch aussteht.
      (task.status === 'done' ? 25 : 0) + naehe(task.dueDate ?? null, heute),
    );
  }

  // --- Termine ---
  for (const block of state.blocks) {
    // Blöcke einer Aufgabe tragen deren Titel – sie stehen schon oben.
    if (block.taskId) continue;
    const zeit = block.allDay ? 'ganztägig' : formatTime(block.startMin);
    nimm(
      'termin',
      block.id,
      block.title,
      [block.notes ?? ''],
      `${formatDateShort(block.date)} · ${zeit}${bereich(block.contextId) ? ` · ${bereich(block.contextId)}` : ''}`,
      { view: 'day', date: block.date },
      naehe(block.date, heute),
    );
  }

  // --- Einkaufsliste ---
  for (const item of state.shopping) {
    nimm(
      'einkauf',
      item.id,
      item.name,
      [],
      [
        item.done ? 'im Wagen' : 'offen',
        item.estimatedCents !== null ? formatEuro(item.estimatedCents) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      { view: 'shopping', karte: 'liste' },
      item.done ? 20 : 0,
    );
  }

  // --- Jahrestage ---
  for (const jahrestag of state.anniversaries) {
    const naechste = nextOccurrence(jahrestag, heute);
    nimm(
      'jahrestag',
      jahrestag.id,
      jahrestag.title,
      [jahrestag.notes ?? ''],
      naechste ? describeOccurrence(naechste) : KIND_LABELS[jahrestag.kind],
      naechste ? { view: 'day', date: naechste.date } : { view: 'day', date: heute },
      naechste ? naehe(naechste.date, heute) : 40,
    );
  }

  // --- Reisen und ihre Punkte ---
  for (const trip of state.trips) {
    nimm(
      'reise',
      trip.id,
      trip.title,
      [trip.notes ?? ''],
      `${formatDateShort(trip.startDate)} – ${formatDateShort(trip.endDate)}`,
      { view: 'vacation' },
      naehe(trip.startDate, heute),
    );
  }
  for (const punkt of state.tripItems) {
    const trip = state.trips.find((t) => t.id === punkt.tripId);
    nimm(
      'reise',
      punkt.id,
      punkt.title,
      [punkt.note ?? ''],
      trip ? `in „${trip.title}"` : 'Reisepunkt',
      { view: 'vacation' },
      // Einzelne Punkte hinter der Reise selbst.
      6 + (trip ? naehe(trip.startDate, heute) : 40),
    );
  }

  // --- Ausgaben ---
  for (const ausgabe of state.expenses) {
    nimm(
      'ausgabe',
      ausgabe.id,
      ausgabe.title,
      [ausgabe.note ?? '', ausgabe.category],
      `${formatDateShort(ausgabe.date)} · ${ausgabe.category} · ${formatEuro(ausgabe.cents)}`,
      { view: 'shopping', karte: 'ausgaben' },
      naehe(ausgabe.date, heute),
    );
  }

  // --- Rezepte ---
  for (const rezept of state.recipes) {
    const zutaten = state.recipeIngredients
      .filter((z) => z.recipeId === rezept.id)
      .map((z) => z.name);
    nimm(
      'rezept',
      rezept.id,
      rezept.title,
      [rezept.notes ?? '', ...zutaten],
      zutaten.length > 0 ? `${zutaten.length} Zutaten` : 'Rezept',
      { view: 'shopping', karte: 'essen' },
      10,
    );
  }

  return treffer
    .sort((a, b) => a.rang - b.rang || a.titel.localeCompare(b.titel, 'de'))
    .slice(0, limit);
}

/** Zählt die Treffer je Art – für die Kopfzeile der Ergebnisse. */
export function countByKind(treffer: Treffer[]): Array<[TrefferArt, number]> {
  const zaehler = new Map<TrefferArt, number>();
  for (const t of treffer) zaehler.set(t.art, (zaehler.get(t.art) ?? 0) + 1);
  return [...zaehler.entries()];
}
