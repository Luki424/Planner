import { addDays, formatDateShort, formatDuration, formatTime, weekDates } from './dates';
import { formatEuro } from './voice';
import { plannedMinutes } from './scheduling';
import type { AppState } from './types';

/**
 * Der Assistent: was er sehen darf und was er tun darf.
 *
 * Diese Datei enthält keinen Netzverkehr. Sie beantwortet nur zwei Fragen –
 * *was schicken wir hin* und *was machen wir mit dem, was zurückkommt* – und
 * ist deshalb ohne Schlüssel und ohne Internet prüfbar.
 *
 * Zwei Grundsätze:
 *
 * 1. **So wenig wie möglich hinschicken.** Was hier steht, verlässt euren
 *    Haushalt. Also nur, was für die Frage gebraucht wird: die laufende
 *    Woche, offene Aufgaben, die Einkaufsliste, eine Zusammenfassung der
 *    Ausgaben – keine Belege, keine Notizen, keine Kalenderhistorie.
 * 2. **Nichts passiert von selbst.** Der Assistent schlägt vor; geändert
 *    wird erst nach einem Fingertipp. Ein Missverständnis ist damit eine
 *    Rückfrage und kein falscher Termin.
 */

/** Was der Assistent tun darf. Mehr gibt es nicht – die Liste ist die Grenze. */
export type WerkzeugName =
  | 'termin_anlegen'
  | 'aufgabe_anlegen'
  | 'einkauf_hinzufuegen'
  | 'ausgabe_buchen';

export type Werkzeug = {
  name: WerkzeugName;
  beschreibung: string;
  /** JSON-Schema, wie beide Anbieter es erwarten. */
  schema: Record<string, unknown>;
};

const feld = (type: string, description: string) => ({ type, description });

export const WERKZEUGE: Werkzeug[] = [
  {
    name: 'termin_anlegen',
    beschreibung:
      'Legt einen festen Termin mit Uhrzeit an. Für alles mit fester Zeit: Arzt, Besprechung, Abholen.',
    schema: {
      type: 'object',
      properties: {
        titel: feld('string', 'Kurz und wie im Kalender, z.B. "Zahnarzt Dr. Berger".'),
        datum: feld('string', 'YYYY-MM-DD.'),
        von: feld('string', 'Uhrzeit HH:MM.'),
        dauerMin: feld('number', 'Dauer in Minuten. Ohne Angabe 60.'),
        bereich: feld('string', 'Name eines vorhandenen Bereichs, z.B. "Privat".'),
        ganztags: feld('boolean', 'true für Dinge ohne Uhrzeit, etwa Geburtstage.'),
      },
      required: ['titel', 'datum'],
    },
  },
  {
    name: 'aufgabe_anlegen',
    beschreibung:
      'Legt eine Aufgabe ohne feste Uhrzeit an – etwas, das erledigt werden muss, aber nicht zu einer bestimmten Zeit.',
    schema: {
      type: 'object',
      properties: {
        titel: feld('string', 'Was zu tun ist.'),
        faellig: feld('string', 'YYYY-MM-DD, wenn es einen Stichtag gibt.'),
        dauerMin: feld('number', 'Geschätzte Dauer in Minuten.'),
        bereich: feld('string', 'Name eines vorhandenen Bereichs.'),
      },
      required: ['titel'],
    },
  },
  {
    name: 'einkauf_hinzufuegen',
    beschreibung: 'Setzt etwas auf die Einkaufsliste.',
    schema: {
      type: 'object',
      properties: {
        name: feld('string', 'Der Artikel, z.B. "Milch".'),
        menge: feld('number', 'Zahl, wenn genannt.'),
        einheit: feld('string', 'z.B. "l", "kg", "Stück".'),
        preisEuro: feld('number', 'Preis in Euro, wenn genannt.'),
      },
      required: ['name'],
    },
  },
  {
    name: 'ausgabe_buchen',
    beschreibung: 'Trägt eine bezahlte Ausgabe in die Haushaltskasse ein.',
    schema: {
      type: 'object',
      properties: {
        titel: feld('string', 'Wofür.'),
        betragEuro: feld('number', 'Betrag in Euro.'),
        datum: feld('string', 'YYYY-MM-DD. Ohne Angabe heute.'),
        kategorie: feld('string', 'z.B. "Lebensmittel", "Auto".'),
      },
      required: ['titel', 'betragEuro'],
    },
  },
];

/**
 * Die Leitplanken für das Modell.
 *
 * Bewusst ausführlich beim Datum: Ein Assistent, der „nächsten Dienstag"
 * falsch rechnet, ist schlimmer als keiner.
 */
export function systemPrompt(state: AppState, heute: string): string {
  const bereiche = state.contexts.map((c) => c.name).join(', ');
  const personen = state.members.map((m) => m.name).join(', ');
  return [
    'Du hilfst einem Paar bei der Tagesplanung. Antworte kurz, auf Deutsch, in ganzen Sätzen.',
    `Heute ist ${formatDateShort(heute)} (${heute}).`,
    'Rechne Datumsangaben immer selbst in YYYY-MM-DD um. "Morgen", "nächsten Dienstag", "in zwei Wochen" beziehen sich auf heute.',
    bereiche && `Vorhandene Bereiche: ${bereiche}.`,
    personen && `Personen im Haushalt: ${personen}.`,
    'Wenn etwas eingetragen werden soll, benutze ein Werkzeug. Erfinde nichts dazu – frag lieber nach.',
    'Wenn nur eine Frage gestellt wird, antworte aus dem mitgelieferten Stand und benutze kein Werkzeug.',
    'Du siehst nur einen Ausschnitt: die laufenden zwei Wochen, offene Aufgaben, die Einkaufsliste und eine Zusammenfassung der Ausgaben. Sag es, wenn die Antwort darüber hinausginge.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Der Ausschnitt des Planers, der mitgeschickt wird.
 *
 * Als Text, nicht als JSON: Er ist kürzer, das Modell liest ihn besser, und
 * – das ist der eigentliche Grund – man kann ihn vor dem Absenden lesen und
 * beurteilen, was da eigentlich hinausgeht.
 */
export function contextSummary(state: AppState, heute: string): string {
  const bis = addDays(heute, 13);
  const zeilen: string[] = [];

  const bereichName = (id: string) => state.contexts.find((c) => c.id === id)?.name ?? '';

  const bloecke = state.blocks
    .filter((b) => b.date >= heute && b.date <= bis)
    .sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1));

  zeilen.push('# Termine der nächsten zwei Wochen');
  if (bloecke.length === 0) zeilen.push('(keine)');
  for (const b of bloecke.slice(0, 60)) {
    const titel = b.taskId
      ? (state.tasks.find((t) => t.id === b.taskId)?.title ?? b.title)
      : b.title;
    const wann = b.allDay
      ? 'ganztägig'
      : `${formatTime(b.startMin)}–${formatTime(b.startMin + b.durationMin)}`;
    zeilen.push(
      `- ${b.date} ${wann} ${titel}${bereichName(b.contextId) ? ` [${bereichName(b.contextId)}]` : ''}`,
    );
  }

  const offen = state.tasks.filter((t) => t.status === 'open');
  zeilen.push('', '# Offene Aufgaben');
  if (offen.length === 0) zeilen.push('(keine)');
  for (const t of offen.slice(0, 40)) {
    zeilen.push(
      `- ${t.title}${t.dueDate ? ` (fällig ${t.dueDate})` : ''}${
        t.estimateMin > 0 && !t.allDay ? ` [${formatDuration(t.estimateMin)}]` : ''
      }`,
    );
  }

  const einkauf = state.shopping.filter((i) => !i.done);
  zeilen.push('', '# Einkaufsliste (offen)');
  if (einkauf.length === 0) zeilen.push('(leer)');
  for (const i of einkauf.slice(0, 40)) {
    zeilen.push(`- ${i.quantity ?? ''} ${i.unit} ${i.name}`.replace(/\s+/g, ' ').trim());
  }

  /*
   * Ausgaben nur als Summe je Kategorie. Einzelne Buchungen wären ein
   * Kontoauszug – das braucht niemand, um „wie viel war das im Monat" zu
   * beantworten.
   */
  const monat = heute.slice(0, 7);
  const jeKategorie = new Map<string, number>();
  for (const a of state.expenses.filter((e) => e.date.startsWith(monat))) {
    jeKategorie.set(a.category, (jeKategorie.get(a.category) ?? 0) + a.cents);
  }
  zeilen.push('', `# Ausgaben im ${monat} (Summen)`);
  if (jeKategorie.size === 0) zeilen.push('(keine)');
  for (const [kategorie, cents] of jeKategorie) zeilen.push(`- ${kategorie}: ${formatEuro(cents)}`);

  const woche = weekDates(heute);
  const dieseWoche = state.blocks.filter((b) => woche.includes(b.date));
  zeilen.push(
    '',
    `# Auslastung`,
    `- Tageskapazität: ${formatDuration(state.settings.capacityMin)}`,
    `- diese Woche verplant: ${formatDuration(plannedMinutes(dieseWoche))}`,
  );

  return zeilen.join('\n');
}

/* ------------------------------------------------------------ Vorschläge */

/** Ein Werkzeugaufruf, übersetzt in etwas, das man lesen und bestätigen kann. */
export type Vorschlag = {
  id: string;
  werkzeug: WerkzeugName;
  /** Eine Zeile, die sagt, was passieren würde. */
  text: string;
  args: Record<string, unknown>;
};

const zahl = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const UHRZEIT = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Prüft einen Werkzeugaufruf und macht einen lesbaren Vorschlag daraus.
 *
 * `null` heißt: unbrauchbar. Lieber gar nichts anbieten als etwas, das nach
 * dem Bestätigen anders aussieht als angekündigt – das Modell schickt
 * gelegentlich ein Datum als „nächsten Dienstag" statt als Zahl.
 */
export function toVorschlag(
  werkzeug: string,
  args: Record<string, unknown>,
  id: string,
): Vorschlag | null {
  const mach = (t: string): Vorschlag => ({
    id,
    werkzeug: werkzeug as WerkzeugName,
    text: t,
    args,
  });

  if (werkzeug === 'termin_anlegen') {
    const titel = text(args.titel);
    const datum = text(args.datum);
    if (!titel || !DATUM.test(datum)) return null;
    if (args.ganztags === true) return mach(`Ganztägig am ${formatDateShort(datum)}: ${titel}`);
    const von = text(args.von);
    if (!UHRZEIT.test(von)) return null;
    const dauer = zahl(args.dauerMin) ?? 60;
    if (dauer <= 0 || dauer > 24 * 60) return null;
    return mach(
      `Termin am ${formatDateShort(datum)} um ${von} (${formatDuration(dauer)}): ${titel}`,
    );
  }

  if (werkzeug === 'aufgabe_anlegen') {
    const titel = text(args.titel);
    if (!titel) return null;
    const faellig = text(args.faellig);
    if (faellig && !DATUM.test(faellig)) return null;
    return mach(`Aufgabe: ${titel}${faellig ? ` (fällig ${formatDateShort(faellig)})` : ''}`);
  }

  if (werkzeug === 'einkauf_hinzufuegen') {
    const name = text(args.name);
    if (!name) return null;
    const menge = zahl(args.menge);
    const einheit = text(args.einheit);
    const preis = zahl(args.preisEuro);
    const vorne = [menge ?? '', einheit].filter(Boolean).join(' ');
    return mach(
      `Auf die Einkaufsliste: ${[vorne, name].filter(Boolean).join(' ')}${
        preis !== null ? ` (${formatEuro(Math.round(preis * 100))})` : ''
      }`,
    );
  }

  if (werkzeug === 'ausgabe_buchen') {
    const titel = text(args.titel);
    const betrag = zahl(args.betragEuro);
    if (!titel || betrag === null || betrag <= 0) return null;
    const datum = text(args.datum);
    if (datum && !DATUM.test(datum)) return null;
    return mach(
      `Ausgabe ${formatEuro(Math.round(betrag * 100))}: ${titel}${
        datum ? ` am ${formatDateShort(datum)}` : ''
      }`,
    );
  }

  return null;
}
