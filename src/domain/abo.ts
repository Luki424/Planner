import { addDays } from './dates';
import type { CalendarFeed } from './types';

/**
 * Das Kalender-Abo: eine Adresse, aus der wöchentlich gelesen wird.
 *
 * Hier steht keine Netzabfrage, nur die Entscheidungen darum herum – ist es
 * wieder so weit, ist die Adresse brauchbar, und was sagen wir, wenn es
 * schiefging. Das lässt sich ohne Internet prüfen, und gerade der letzte
 * Punkt ist wichtig: Ein Abgleich, der stumm scheitert, ist schlimmer als
 * keiner. Man verlässt sich darauf und merkt es am verpassten Termin.
 */

/** So oft wird nachgesehen. */
export const ABGLEICH_TAGE = 7;

/*
 * Der Typ steht bei den übrigen Zustandstypen – so gibt es eine Wahrheit
 * und nicht zwei, die auseinanderlaufen können.
 */
export type Abo = CalendarFeed;

/**
 * Macht aus einer eingefügten Adresse eine, die sich abrufen lässt.
 *
 * `webcal://` ist keine echte Netzadresse, sondern eine Anweisung an das
 * Betriebssystem – Outlook und Apple geben sie trotzdem gern so heraus.
 * Über `https://` liegt dieselbe Datei.
 *
 * `null` heißt: damit lässt sich nichts anfangen. Lieber gleich sagen als
 * eine Woche später melden, dass nichts kam.
 */
export function normalisiereUrl(roh: string): string | null {
  const text = roh.trim();
  if (!text) return null;

  const mitSchema = text.startsWith('webcal://')
    ? `https://${text.slice('webcal://'.length)}`
    : text;

  let url: URL;
  try {
    url = new URL(mitSchema);
  } catch {
    return null;
  }
  // Nur http(s): `file:` läse vom eigenen Rechner, `javascript:` wäre gefährlich.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return url.toString();
}

/** Ist wieder Abgleichtag? Ohne bisherigen Lauf: sofort. */
export function istFaellig(lastRun: string | null, heute: string, tage = ABGLEICH_TAGE): boolean {
  if (!lastRun) return true;
  return addDays(lastRun, tage) <= heute;
}

/** Der nächste Abgleich, für die Anzeige. */
export function naechsterLauf(lastRun: string | null, tage = ABGLEICH_TAGE): string | null {
  return lastRun ? addDays(lastRun, tage) : null;
}

/**
 * Warum es nicht geklappt hat – in einem Satz, der weiterhilft.
 *
 * Der wichtigste Fall ist der unscheinbarste: Ein `fetch`, den der Browser
 * wegen fehlender Freigabe abbricht, wirft einen nackten `TypeError` ohne
 * Begründung. „Failed to fetch" sagt niemandem etwas – und die eigentliche
 * Ursache steht nicht im Fehler, sondern in der Kopfzeile, die *fehlt*.
 */
export function fehlerText(fehler: unknown, status?: number): string {
  if (status === 401 || status === 403) {
    return 'Die Adresse wird abgelehnt. Ist der Kalender noch veröffentlicht?';
  }
  if (status === 404) return 'Unter der Adresse liegt nichts. Stimmt sie noch?';
  if (status && status >= 500) return 'Der Kalenderdienst antwortet gerade nicht.';
  if (status && status >= 400) return `Die Adresse wurde abgewiesen (${status}).`;

  if (fehler instanceof TypeError) {
    return (
      'Der Browser darf diese Adresse nicht lesen. Das entscheidet der Anbieter des Kalenders, ' +
      'nicht der Planer – Outlook erlaubt es meistens nicht. Der Weg über die Datei funktioniert weiterhin.'
    );
  }
  if (fehler instanceof Error && fehler.name === 'AbortError') {
    return 'Der Abruf hat zu lange gedauert.';
  }
  return fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.';
}

/** Sieht das nach einer Kalenderdatei aus? */
export function istKalender(text: string): boolean {
  return text.trimStart().startsWith('BEGIN:VCALENDAR');
}

/** Was nach einem Abgleich in der Zeile steht. */
export function standText(abo: Abo): string {
  if (abo.lastError) return `Zuletzt nicht geklappt: ${abo.lastError}`;
  if (!abo.lastRun) return 'Noch nicht abgeglichen.';
  if (abo.lastCount === 0) return `Zuletzt am ${abo.lastRun}: nichts Neues.`;
  const wort = abo.lastCount === 1 ? 'Termin' : 'Termine';
  return `Zuletzt am ${abo.lastRun}: ${abo.lastCount} ${wort} übernommen.`;
}
