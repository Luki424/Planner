import { buildIcs, type ExportEvent } from './ics';
import { formatDateShort, formatTime } from './dates';
import type { Block, Context, Member, Task } from './types';

/**
 * Einen Termin an den Handy-Kalender übergeben.
 *
 * Der Planer erinnert nur, solange er offen ist – das ist die Grenze einer
 * Internetseite ohne Server, und sie lässt sich nicht wegprogrammieren. Ein
 * Handy-Kalender hat diese Grenze nicht. Statt sie zu verwalten, geben wir
 * den Termin dorthin ab, wo das Wecken zuverlässig funktioniert.
 *
 * Hier steht nur die Vorbereitung: Aus einem Block wird eine Kalenderdatei.
 * Das Weiterreichen selbst gehört zum Browser und steht woanders – so lässt
 * sich das hier ohne Browser prüfen.
 */

/**
 * Was die Übergabe an Umgebung braucht – nicht der ganze Zustand.
 *
 * Der Dialog, aus dem sie aufgerufen wird, kennt ohnehin nur diese drei
 * Listen. Den Gesamtzustand zu verlangen hieße, ihn nur zum Weiterreichen
 * herumzureichen.
 */
export type Umfeld = { contexts: Context[]; members: Member[]; tasks: Task[] };

/** Der Titel eines Blocks; bei Aufgabenblöcken steht er an der Aufgabe. */
function titelVon(umfeld: Umfeld, block: Block): string {
  if (block.taskId) return umfeld.tasks.find((t) => t.id === block.taskId)?.title ?? block.title;
  return block.title;
}

/**
 * Die Notiz, die im fremden Kalender neben dem Termin steht.
 *
 * Sie nennt den Bereich und die Zuständigen, weil beides drüben sonst
 * verloren ginge – und sagt, woher der Eintrag stammt. Wer ihn in einem Jahr
 * im Kalender wiederfindet, soll das einordnen können.
 */
export function uebergabeNotiz(umfeld: Umfeld, block: Block): string {
  const teile: string[] = [];
  const bereich = umfeld.contexts.find((c) => c.id === block.contextId)?.name;
  if (bereich) teile.push(bereich);

  const namen = block.memberIds
    .map((id) => umfeld.members.find((m) => m.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (namen.length > 0) teile.push(`Für: ${namen.join(', ')}`);

  if (block.notes) teile.push(block.notes);
  teile.push('Aus dem Tagesplaner');
  return teile.join('\n');
}

/**
 * Baut die Kalenderdatei für genau einen Termin.
 *
 * `alarmMin` ist der Vorlauf, mit dem der fremde Kalender wecken soll –
 * derselbe, der im Planer eingestellt ist. Steht der auf „aus", wird
 * trotzdem geweckt: Wer einen Termin ausdrücklich in den Handy-Kalender
 * legt, tut das, damit er daran erinnert wird.
 */
export const ERSATZ_VORLAUF = 15;

export function terminAlsKalenderdatei(
  umfeld: Umfeld,
  block: Block,
  alarmMin: number,
  now = new Date(),
): string {
  const event: ExportEvent = {
    // Die eigene Kennung mitgeben: Ein zweites Übergeben legt kein Doppel an.
    uid: `${block.id}@tagesplaner`,
    title: titelVon(umfeld, block) || 'Termin',
    date: block.date,
    startMin: block.startMin,
    durationMin: block.durationMin,
    allDay: block.allDay,
    description: uebergabeNotiz(umfeld, block),
    alarmMin: alarmMin > 0 ? alarmMin : ERSATZ_VORLAUF,
  };
  return buildIcs([event], now);
}

/** Ein Dateiname, den man im Download-Ordner wiedererkennt. */
export function dateiname(umfeld: Umfeld, block: Block): string {
  const titel = (titelVon(umfeld, block) || 'Termin')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${block.date}-${titel || 'Termin'}.ics`;
}

/** Ein Satz, der sagt, was gleich passiert. */
export function uebergabeText(umfeld: Umfeld, block: Block): string {
  const titel = titelVon(umfeld, block) || 'Termin';
  const wann = block.allDay
    ? formatDateShort(block.date)
    : `${formatDateShort(block.date)} um ${formatTime(block.startMin)}`;
  return `${titel} – ${wann}`;
}
