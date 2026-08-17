import type { ID } from './types';

/**
 * Die Bucketlist.
 *
 * Was hier steht, ist ausdrücklich **keine Aufgabe**. Eine Aufgabe hat eine
 * Dauer, einen Bereich und irgendwann eine Frist; sie drückt, solange sie
 * offen ist. Ein Eintrag auf der Bucketlist drückt nie. „Nordlichter sehen"
 * steht vielleicht sieben Jahre da, und das ist kein Rückstand.
 *
 * Daraus folgt alles Weitere:
 *
 * - **Kein Fälligkeitsdatum.** Höchstens ein Jahr als Wunsch („2027 wäre
 *   schön"), und auch das ist unverbindlich – es sortiert, es mahnt nicht.
 * - **Erledigtes verschwindet nicht.** Bei einer Aufgabenliste ist Abhaken
 *   ein Aufräumen; hier ist es der Ertrag. Was geschafft ist, bleibt stehen,
 *   mit dem Datum daneben, und wird nach unten gereiht.
 * - **Kein Bereich.** Beruflich oder privat ist bei einem Lebenswunsch keine
 *   sinnvolle Frage.
 */

export type BucketItem = {
  id: ID;
  title: string;
  /** Wo, was, was es kostet – alles, was man sonst wieder suchen müsste. */
  note: string;
  /** Wunschjahr, unverbindlich. Null heißt „irgendwann". */
  targetYear: number | null;
  /** Wen es betrifft. Leer heißt: uns beide. */
  memberIds: ID[];
  done: boolean;
  /** Wann es geschafft war, ISO-Datum. */
  doneAt: string | null;
  createdAt: string;
};

/** Ab hier wird ein Jahr nicht mehr als Wunsch, sondern als Vertipper gelesen. */
export const JAHR_VON = 1900;
export const JAHR_BIS = 2200;

export function jahrGueltig(wert: string): boolean {
  if (!wert.trim()) return true; // leer ist erlaubt: „irgendwann"
  const n = Number(wert);
  return Number.isInteger(n) && n >= JAHR_VON && n <= JAHR_BIS;
}

/**
 * Die Reihenfolge der Liste.
 *
 * Offenes zuerst – danach schaut man, wenn man die Liste aufmacht. Innerhalb
 * des Offenen zuerst, was ein Jahr trägt, und davon das nächste; ein Wunsch
 * mit Jahr ist konkreter als einer ohne. Geschafftes kommt darunter, das
 * Jüngste oben: Wer zurückblickt, will das Letzte zuerst sehen.
 */
export function sortiert(items: BucketItem[]): BucketItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) return (b.doneAt ?? '').localeCompare(a.doneAt ?? '');
    if (a.targetYear !== b.targetYear) {
      if (a.targetYear === null) return 1;
      if (b.targetYear === null) return -1;
      return a.targetYear - b.targetYear;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** „3 von 11 geschafft" – die einzige Zahl, die bei einer Bucketlist zählt. */
export function standText(items: BucketItem[]): string {
  if (items.length === 0) return 'Noch nichts drauf.';
  const geschafft = items.filter((i) => i.done).length;
  if (geschafft === 0) return `${items.length} ${items.length === 1 ? 'Wunsch' : 'Wünsche'}`;
  return `${geschafft} von ${items.length} geschafft`;
}

/**
 * Das Jahr in Worten.
 *
 * Bewusst ohne Mahnung: Ein Wunschjahr, das vorbei ist, heißt nicht „zu spät",
 * sondern nur, dass es weiter offen ist. Genau deshalb steht auf einer
 * Bucketlist auch nach zehn Jahren noch „Nordlichter sehen".
 */
export function jahrText(item: BucketItem, jetzt: Date = new Date()): string {
  if (item.done) return item.doneAt ? `geschafft ${jahrMonat(item.doneAt)}` : 'geschafft';
  if (item.targetYear === null) return 'irgendwann';
  const dieses = jetzt.getFullYear();
  if (item.targetYear === dieses) return 'dieses Jahr';
  if (item.targetYear === dieses + 1) return 'nächstes Jahr';
  if (item.targetYear < dieses) return `war für ${item.targetYear} gedacht`;
  return `bis ${item.targetYear}`;
}

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/** „im Juni 2026" aus einem ISO-Datum. */
export function jahrMonat(iso: string): string {
  const m = Number(iso.slice(5, 7));
  const j = iso.slice(0, 4);
  if (!m || !j) return iso;
  return `im ${MONATE[m - 1]} ${j}`;
}
