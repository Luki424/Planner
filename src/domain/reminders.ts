import { formatTime } from './dates';
import type { AppState, Block } from './types';

/**
 * Erinnerungen vor Terminen.
 *
 * Reine Rechnung, kein Browser: *welcher* Termin ist *wann* dran. Das
 * Melden selbst steht woanders – hier lässt sich prüfen, was sonst nur
 * auffiele, wenn man zufällig danebensitzt, wenn eine Erinnerung fällig
 * wäre.
 *
 * Eine Grenze steht am Anfang, weil sie alles Weitere bestimmt: **Es gibt
 * keinen Server.** Erinnert werden kann nur, solange der Planer offen ist.
 * Eine Erinnerung, die verspricht, auch bei geschlossener App zu kommen,
 * wäre eine Lüge – und zwar eine, die man erst bemerkt, wenn man den Termin
 * verpasst hat.
 */

/** Vorlauf in Minuten. `0` heißt: keine Erinnerungen. */
export const VORLAUF_STUFEN = [0, 5, 10, 15, 30, 60] as const;
export type Vorlauf = (typeof VORLAUF_STUFEN)[number];

export const STANDARD_VORLAUF: Vorlauf = 15;

export function vorlaufName(v: Vorlauf): string {
  if (v === 0) return 'aus';
  return v === 60 ? '1 Stunde vorher' : `${v} min vorher`;
}

export type Erinnerung = {
  /** Die Kennung des Blocks – zugleich das Merkmal, dass schon erinnert wurde. */
  id: string;
  titel: string;
  /** Startzeit in Minuten seit Mitternacht. */
  startMin: number;
  /** Wie viele Minuten es noch sind. Negativ heißt: läuft schon. */
  inMin: number;
};

/**
 * Wie ein Block heißt – bei Aufgabenblöcken steht der Titel an der Aufgabe.
 */
function titelVon(state: AppState, b: Block): string {
  if (b.taskId) return state.tasks.find((t) => t.id === b.taskId)?.title ?? b.title;
  return b.title;
}

/**
 * Welche Termine jetzt eine Erinnerung wert sind.
 *
 * `jetztMin` ist die Uhrzeit in Minuten seit Mitternacht, `gemeldet` die
 * Menge der Blöcke, für die schon erinnert wurde.
 *
 * Ganztägige Einträge bleiben außen vor: Sie haben keine Uhrzeit, „in
 * 15 Minuten ist Geburtstag Oma" wäre also erfunden. Für die gibt es die
 * Jahrestage mit ihrer eigenen Vorwarnung.
 */
export function faelligeErinnerungen(
  state: AppState,
  heute: string,
  jetztMin: number,
  vorlauf: Vorlauf,
  gemeldet: ReadonlySet<string>,
): Erinnerung[] {
  if (vorlauf <= 0) return [];

  return state.blocks
    .filter((b) => b.date === heute && !b.allDay && !gemeldet.has(b.id))
    .filter((b) => {
      const bis = b.startMin - jetztMin;
      /*
       * Von „gleich" bis „gerade angefangen". Die Kulanz nach hinten ist
       * Absicht: Wer den Planer erst um 9:58 aufmacht, soll den Termin um
       * 9:55 noch erfahren – nicht erfahren, dass er ihn verpasst hat.
       */
      return bis <= vorlauf && bis >= -NACHLAUF_MIN;
    })
    .map((b) => ({
      id: b.id,
      titel: titelVon(state, b) || 'Termin',
      startMin: b.startMin,
      inMin: b.startMin - jetztMin,
    }))
    .sort((a, b) => a.startMin - b.startMin);
}

/** So lange nach dem Start wird noch erinnert. */
const NACHLAUF_MIN = 5;

/** „In 15 Minuten: Zahnarzt (10:00)" – ein Satz, der allein steht. */
export function erinnerungsText(e: Erinnerung): string {
  const wann =
    e.inMin > 1
      ? `In ${e.inMin} Minuten`
      : e.inMin === 1
        ? 'In einer Minute'
        : e.inMin === 0
          ? 'Jetzt'
          : 'Seit eben';
  return `${wann}: ${e.titel} (${formatTime(e.startMin)})`;
}
