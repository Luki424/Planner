import { fehlerText, istKalender, type Abo } from '../domain/abo';
import { addDays, today as todayISO } from '../domain/dates';
import { parseIcs } from '../domain/ics';
import { importCalendar, updateSettings } from './store';

/**
 * Den abonnierten Kalender holen und einlesen.
 *
 * Der Netzteil des Abos – deshalb hier und nicht in `domain/`. Was er
 * entscheidet, steht dort; hier steht nur, wie geholt wird.
 *
 * **Ob das überhaupt geht, entscheidet der Kalenderanbieter.** Ein Browser
 * darf eine fremde Adresse nur lesen, wenn deren Server das ausdrücklich
 * erlaubt. Outlook tut das in der Regel nicht. Der Abruf ist deshalb ein
 * Versuch mit ehrlichem Ausgang – und kein Versprechen.
 */

/** Wie weit zurück und wie weit voraus eingelesen wird – wie beim Datei-Import. */
const ZURUECK_TAGE = 30;
const VORAUS_TAGE = 365;
/** Nach so langer Zeit wird abgebrochen; ein hängender Abruf hilft niemandem. */
const FRIST_MS = 20_000;

export type AbrufErgebnis = { neu: number } | { fehler: string };

export async function gleicheKalenderAb(abo: Abo): Promise<AbrufErgebnis> {
  const heute = todayISO();
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), FRIST_MS);

  try {
    const antwort = await fetch(abo.url, { signal: abbruch.signal, redirect: 'follow' });
    if (!antwort.ok) {
      const text = fehlerText(null, antwort.status);
      updateSettings({ calendarFeed: { ...abo, lastError: text } });
      return { fehler: text };
    }

    const text = await antwort.text();
    /*
     * Wer die falsche Adresse einfügt, bekommt oft eine Anmeldeseite als
     * HTML zurück – mit Erfolgsmeldung. Ohne diese Prüfung stünde danach
     * „nichts Neues" da, und niemand wüsste, warum.
     */
    if (!istKalender(text)) {
      const meldung =
        'Unter der Adresse liegt kein Kalender, sondern etwas anderes – oft eine Anmeldeseite.';
      updateSettings({ calendarFeed: { ...abo, lastError: meldung } });
      return { fehler: meldung };
    }

    const gelesen = parseIcs(text, addDays(heute, -ZURUECK_TAGE), addDays(heute, VORAUS_TAGE));
    // Doppel erkennt der Import selbst – ein zweiter Lauf legt nichts erneut an.
    const ergebnis = importCalendar({
      events: gelesen.events,
      contextId: abo.contextId,
      privateContextId: abo.privateContextId,
      memberIds: abo.memberIds,
    });
    const neu = ergebnis.added;

    updateSettings({
      calendarFeed: { ...abo, lastRun: heute, lastError: null, lastCount: neu },
    });
    return { neu };
  } catch (err) {
    const meldung = fehlerText(err);
    updateSettings({ calendarFeed: { ...abo, lastError: meldung } });
    return { fehler: meldung };
  } finally {
    clearTimeout(uhr);
  }
}
