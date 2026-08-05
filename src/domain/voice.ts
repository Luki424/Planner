/**
 * Deutet gesprochene deutsche Sätze und macht daraus Termine, Aufgaben oder
 * Einkaufseinträge.
 *
 * Bewusst regelbasiert statt KI: die Erkennung läuft offline, ist
 * nachvollziehbar und liefert bei den paar Dutzend Formulierungen, die man
 * einer Einkaufsliste oder einem Kalender zuruft, verlässliche Ergebnisse.
 * Was nicht sicher erkannt wird, landet als schlichter Text – lieber ein
 * Eintrag ohne Uhrzeit als ein Termin am falschen Tag.
 *
 * Zur Umlaut-Falle: `\b` in JavaScript kennt nur ASCII-Wortzeichen, "ü" gilt
 * als Grenze. `\bübermorgen\b` findet deshalb nie etwas. Statt Lookbehind zu
 * verwenden (in älteren Safari-Versionen nicht vorhanden) läuft jede Suche auf
 * einer gefalteten Kopie des Textes, in der Umlaute durch einen einzelnen
 * ASCII-Buchstaben ersetzt sind. Weil die Faltung die Länge nicht verändert,
 * passen alle Trefferpositionen weiterhin auf das Original.
 */

import { addDays, weekdayIndex } from './dates';

export type ParsedAppointment = {
  kind: 'appointment';
  title: string;
  date: string;
  startMin: number;
  durationMin: number;
};

export type ParsedTask = {
  kind: 'task';
  title: string;
  date: string | null;
  estimateMin: number | null;
};

export type ShoppingDraft = {
  name: string;
  quantity: number | null;
  unit: string;
  estimatedCents: number | null;
};

export type ParsedShopping = {
  kind: 'shopping';
  items: ShoppingDraft[];
};

export type Parsed = ParsedAppointment | ParsedTask | ParsedShopping;

export type ParseMode = 'auto' | 'shopping' | 'plan';

/* ------------------------------------------------------- Text mit Faltung */

type Scan = { text: string; folded: string };

const FOLD: Record<string, string> = {
  ä: 'a',
  ö: 'o',
  ü: 'u',
  Ä: 'A',
  Ö: 'O',
  Ü: 'U',
  ß: 's',
  é: 'e',
  è: 'e',
  á: 'a',
};

/** Ersetzt Sonderzeichen durch je genau ein ASCII-Zeichen – Länge bleibt gleich. */
function fold(text: string): string {
  return text.replace(/[äöüÄÖÜßéèá]/g, (c) => FOLD[c] ?? c);
}

function scan(text: string): Scan {
  return { text, folded: fold(text) };
}

/** Schneidet einen Bereich heraus; die Positionen stammen aus der Faltung. */
function cutRange(source: Scan, start: number, end: number): Scan {
  return scan(`${source.text.slice(0, start)} ${source.text.slice(end)}`);
}

/** Schneidet den Treffer aus Original und Faltung heraus. */
function cut(source: Scan, match: RegExpExecArray): Scan {
  return cutRange(source, match.index, match.index + match[0].length);
}

/** Schneidet nur die Gruppe `group` heraus und lässt das Trennzeichen davor stehen. */
function cutGroup(source: Scan, match: RegExpExecArray, group: number): Scan {
  let start = match.index;
  for (let i = 1; i < group; i += 1) start += match[i]?.length ?? 0;
  return cutRange(source, start, start + match[group].length);
}

function normalize(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.–-]+/, '')
    .replace(/[\s,;:.!?–-]+$/, '')
    .trim();
}

function tidy(source: Scan): Scan {
  return scan(normalize(source.text));
}

/* ------------------------------------------------------------ Wörterbücher */

const NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  funf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwolf: 12,
};

const WEEKDAYS: Record<string, number> = {
  montag: 0,
  dienstag: 1,
  mittwoch: 2,
  donnerstag: 3,
  freitag: 4,
  samstag: 5,
  sonnabend: 5,
  sonntag: 6,
};

const MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  marz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

/** Schlüssel sind gefaltet: "stuck" statt "stück". */
const UNITS: Record<string, string> = {
  kilo: 'kg',
  kilogramm: 'kg',
  kg: 'kg',
  gramm: 'g',
  g: 'g',
  liter: 'l',
  l: 'l',
  milliliter: 'ml',
  ml: 'ml',
  packung: 'Packung',
  packungen: 'Packung',
  packchen: 'Päckchen',
  dose: 'Dose',
  dosen: 'Dose',
  flasche: 'Flasche',
  flaschen: 'Flasche',
  glas: 'Glas',
  glaser: 'Glas',
  becher: 'Becher',
  stuck: 'Stk',
  beutel: 'Beutel',
  tute: 'Tüte',
  bund: 'Bund',
  kasten: 'Kasten',
  schachtel: 'Schachtel',
  scheiben: 'Scheiben',
  rolle: 'Rolle',
  rollen: 'Rolle',
};

const LEADING_NOISE =
  /^(?:und|noch|dann|auch|bitte|ausserdem|ich brauche|wir brauchen|brauche ich|brauchen wir|besorgen|besorge|kaufen|kaufe|holen|hole|nicht vergessen|auf|fur|die|das|den|einkaufen|um|am|ab)\b[\s,:;-]*/i;

const SHOPPING_TRIGGER =
  /(^|[^A-Za-z0-9])(einkaufsliste|einkaufslisten|einkaufen|einkauf|besorgen|supermarkt|kaufen|brauchen wir|brauche ich)(?![A-Za-z0-9])/i;

/** Ausdrückliche Nennung der Liste – gewinnt auch aus der Planeransicht heraus. */
const SHOPPING_LIST_WORD = /(^|[^A-Za-z0-9])(einkaufsliste|einkaufslisten)(?![A-Za-z0-9])/i;

const APPOINTMENT_WORD = /(^|[^A-Za-z0-9])(termin|termine|meeting|besprechung|treffen|verabredung)(?![A-Za-z0-9])/i;

/* ------------------------------------------------------------------ Helfer */

function toNumber(token: string): number | null {
  const word = NUMBER_WORDS[fold(token).toLowerCase()];
  if (word !== undefined) return word;
  const numeric = Number(token.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
}

function titleCase(text: string): string {
  const trimmed = normalize(text);
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

/**
 * Entfernt Floskeln am Anfang, solange welche übrig sind.
 * "ich brauche noch Zucker" verliert erst "ich brauche", dann "noch".
 */
function stripLeadingNoise(text: string): string {
  let current = normalize(text);
  for (let i = 0; i < 6; i += 1) {
    const match = LEADING_NOISE.exec(fold(current));
    if (!match || match[0].length === 0) break;
    const next = normalize(current.slice(match[0].length));
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

/**
 * "um 3" meint im Alltag den Nachmittag. Stunden von 1 bis 7 wandern deshalb
 * in den Nachmittag, 8 bis 12 bleiben am Vormittag.
 */
function assumeDaytime(hour: number): number {
  return hour >= 1 && hour <= 7 ? hour + 12 : hour;
}

/* ------------------------------------------------------------------ Uhrzeit */

function extractTime(source: Scan): { startMin: number | null; rest: Scan } {
  const patterns: Array<{
    re: RegExp;
    read: (m: RegExpExecArray) => number | null;
  }> = [
    {
      // "um 15:30", "15.30 Uhr"
      re: /(?:um\s+)?\b(\d{1,2})[:.](\d{2})\s*(?:uhr)?\b/i,
      read: (m) => {
        const h = Number(m[1]);
        const min = Number(m[2]);
        return h <= 23 && min <= 59 ? h * 60 + min : null;
      },
    },
    {
      // "um 15 Uhr 30", "um 9 Uhr", "neun Uhr"
      re: /(?:um\s+)?\b([A-Za-z]+|\d{1,2})\s*uhr(?:\s+(\d{1,2}))?\b/i,
      read: (m) => {
        const h = toNumber(m[1]);
        const min = m[2] ? Number(m[2]) : 0;
        if (h === null || h > 23 || min > 59) return null;
        return assumeDaytime(h) * 60 + min;
      },
    },
    {
      // "halb drei" = 14:30
      re: /(?:um\s+)?\bhalb\s+([A-Za-z]+|\d{1,2})\b/i,
      read: (m) => {
        const h = toNumber(m[1]);
        if (h === null) return null;
        return (assumeDaytime(h === 1 ? 13 : h) - 1) * 60 + 30;
      },
    },
    {
      re: /(?:um\s+)?\bviertel\s+nach\s+([A-Za-z]+|\d{1,2})\b/i,
      read: (m) => {
        const h = toNumber(m[1]);
        return h === null ? null : assumeDaytime(h) * 60 + 15;
      },
    },
    {
      re: /(?:um\s+)?\b(?:dreiviertel|viertel\s+vor)\s+([A-Za-z]+|\d{1,2})\b/i,
      read: (m) => {
        const h = toNumber(m[1]);
        return h === null ? null : (assumeDaytime(h) - 1) * 60 + 45;
      },
    },
  ];

  for (const { re, read } of patterns) {
    const match = re.exec(source.folded);
    if (!match) continue;
    const value = read(match);
    if (value === null) continue;
    return { startMin: value, rest: tidy(cut(source, match)) };
  }
  return { startMin: null, rest: source };
}

/* -------------------------------------------------------------------- Datum */

function extractDate(source: Scan, todayISO: string): { date: string | null; rest: Scan } {
  const relative: Array<[RegExp, number]> = [
    [/(^|[^A-Za-z0-9])(ubermorgen)(?![A-Za-z0-9])/i, 2],
    [/(^|[^A-Za-z0-9])(morgen)(?![A-Za-z0-9])/i, 1],
    [/(^|[^A-Za-z0-9])(heute)(?![A-Za-z0-9])/i, 0],
  ];
  for (const [re, offset] of relative) {
    const match = re.exec(source.folded);
    if (match) {
      // Nur das Wort entfernen, das Trennzeichen davor bleibt stehen.
      return { date: addDays(todayISO, offset), rest: tidy(cutGroup(source, match, 2)) };
    }
  }

  // "am 12.3." / "12.03.2026"
  const numeric = /(?:am\s+)?\b(\d{1,2})\.\s*(\d{1,2})\.(\d{4})?/.exec(source.folded);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = numeric[3] ? Number(numeric[3]) : Number(todayISO.slice(0, 4));
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const resolved = !numeric[3] && iso < todayISO ? `${year + 1}${iso.slice(4)}` : iso;
      return { date: resolved, rest: tidy(cut(source, numeric)) };
    }
  }

  // "am 12. September"
  const withMonth = new RegExp(
    `(?:am\\s+)?\\b(\\d{1,2})\\.?\\s+(${Object.keys(MONTHS).join('|')})(?![A-Za-z])`,
    'i',
  ).exec(source.folded);
  if (withMonth) {
    const day = Number(withMonth[1]);
    const month = MONTHS[withMonth[2].toLowerCase()];
    const year = Number(todayISO.slice(0, 4));
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const resolved = iso < todayISO ? `${year + 1}${iso.slice(4)}` : iso;
    return { date: resolved, rest: tidy(cut(source, withMonth)) };
  }

  // "am Freitag" / "nächsten Freitag"
  const weekday = new RegExp(
    `(?:(?:am|nachsten|kommenden)\\s+)?\\b(${Object.keys(WEEKDAYS).join('|')})(?![A-Za-z])`,
    'i',
  ).exec(source.folded);
  if (weekday) {
    const target = WEEKDAYS[weekday[1].toLowerCase()];
    let delta = (target - weekdayIndex(todayISO) + 7) % 7;
    // "am Freitag" meint nie den heutigen Tag – gemeint ist der nächste.
    if (delta === 0) delta = 7;
    return { date: addDays(todayISO, delta), rest: tidy(cut(source, weekday)) };
  }

  return { date: null, rest: source };
}

/* -------------------------------------------------------------------- Dauer */

function extractDuration(source: Scan): { durationMin: number | null; rest: Scan } {
  const hours = /(?:fur\s+)?\b(\d+(?:[.,]\d+)?|[A-Za-z]+)\s*(?:stunden|stunde|std|h)(?![A-Za-z])/i.exec(
    source.folded,
  );
  if (hours) {
    const value = toNumber(hours[1]);
    if (value !== null) {
      return { durationMin: Math.round(value * 60), rest: tidy(cut(source, hours)) };
    }
  }
  const minutes = /(?:fur\s+)?\b(\d+|[A-Za-z]+)\s*(?:minuten|minute|min)(?![A-Za-z])/i.exec(source.folded);
  if (minutes) {
    const value = toNumber(minutes[1]);
    if (value !== null) {
      return { durationMin: Math.round(value), rest: tidy(cut(source, minutes)) };
    }
  }
  return { durationMin: null, rest: source };
}

/* -------------------------------------------------------------------- Preis */

function extractPrice(source: Scan): { cents: number | null; rest: Scan } {
  // "2 Euro 50"
  const euroCents = /(?:fur|kostet|je|kosten)?\s*\b(\d+)\s*(?:euro|eur|€)\s+(\d{1,2})(?![\d])/i.exec(
    source.folded,
  );
  if (euroCents) {
    const cents = Number(euroCents[1]) * 100 + Number(euroCents[2].padEnd(2, '0'));
    return { cents, rest: tidy(cut(source, euroCents)) };
  }

  // "für 1,50" / "2,99 Euro" – ohne Währungswort ist ein Preiswort nötig,
  // sonst wäre "1,5 Liter Milch" plötzlich ein Preis.
  const decimal = /(fur|kostet|je|kosten)?\s*\b(\d+)[,.](\d{1,2})\s*(euro|eur|€)?(?![\d\w])/i.exec(
    source.folded,
  );
  if (decimal && (decimal[1] || decimal[4])) {
    const cents = Number(decimal[2]) * 100 + Number(decimal[3].padEnd(2, '0'));
    return { cents, rest: tidy(cut(source, decimal)) };
  }

  // "4 Euro", "für 4", auch ausgeschrieben: "drei Euro"
  const whole = /(fur|kostet|je|kosten)?\s*\b(\d+|[A-Za-z]+)\s*(euro|eur|€)(?![A-Za-z])/i.exec(
    source.folded,
  );
  if (whole && (whole[1] || whole[3])) {
    const value = toNumber(whole[2]);
    if (value !== null) return { cents: Math.round(value * 100), rest: tidy(cut(source, whole)) };
  }

  return { cents: null, rest: source };
}

/* -------------------------------------------------------------- Einkaufsliste */

function parseShoppingItem(raw: string): ShoppingDraft | null {
  let current = scan(stripLeadingNoise(raw));
  if (!current.text) return null;

  const price = extractPrice(current);
  current = price.rest;

  let quantity: number | null = null;
  let unit = '';

  // Führende Menge, optional mit Einheit: "2 Liter", "drei", "500 g"
  const leading = /^(\d+(?:[.,]\d+)?|[A-Za-z]+)\s+(.+)$/i.exec(current.folded);
  if (leading) {
    const value = toNumber(leading[1]);
    if (value !== null) {
      quantity = value;
      current = scan(current.text.slice(current.text.length - leading[2].length));
      const unitMatch = /^([A-Za-z]+)(?:\s+(.+))?$/i.exec(current.folded);
      if (unitMatch && UNITS[unitMatch[1].toLowerCase()] && unitMatch[2]) {
        unit = UNITS[unitMatch[1].toLowerCase()];
        current = scan(current.text.slice(current.text.length - unitMatch[2].length));
      }
    }
  }

  // "500g Mehl" – Einheit klebt an der Zahl
  if (quantity === null) {
    const glued = /^(\d+(?:[.,]\d+)?)\s*([A-Za-z]+)\s+(.+)$/i.exec(current.folded);
    if (glued && UNITS[glued[2].toLowerCase()]) {
      quantity = toNumber(glued[1]);
      unit = UNITS[glued[2].toLowerCase()];
      current = scan(current.text.slice(current.text.length - glued[3].length));
    }
  }

  const name = titleCase(stripLeadingNoise(current.text).replace(/^(?:x|mal)\s+/i, ''));
  if (!name) return null;

  return { name, quantity, unit, estimatedCents: price.cents };
}

/** Zeichen, das ein Dezimalkomma während des Trennens vertritt. */
const DECIMAL_GUARD = '';

function splitShoppingItems(text: string): string[] {
  // "Milch für 1,50 und Brot" darf nicht am Komma von 1,50 zerfallen.
  const guarded = text.replace(/(\d),(\d)/g, `$1${DECIMAL_GUARD}$2`);
  return guarded
    .split(/\s*(?:,|;|\bund\b|\bsowie\b|\bplus\b)\s*/i)
    .map((part) => part.split(DECIMAL_GUARD).join(',').trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ Einstieg */

/**
 * Deutet einen gesprochenen Satz.
 * `mode` gibt vor, was erwartet wird; ein eindeutiger Gegenhinweis im Satz
 * gewinnt trotzdem – "Termin ..." im Einkaufsmodus landet im Kalender.
 */
export function parseUtterance(input: string, todayISO: string, mode: ParseMode = 'auto'): Parsed | null {
  const source = tidy(scan(input));
  if (!source.text) return null;

  const hasShoppingCue = SHOPPING_TRIGGER.test(source.folded);
  const hasAppointmentCue = APPOINTMENT_WORD.test(source.folded);
  const namesTheList = SHOPPING_LIST_WORD.test(source.folded);

  // Aus dem Planer heraus muss die Liste ausdrücklich benannt werden, sonst
  // würde "um 17 Uhr einkaufen gehen" als Einkauf statt als Termin landen.
  // Im freien Modus reicht ein Einkaufswort, solange keine Uhrzeit fällt.
  const wantsShopping =
    mode === 'shopping'
      ? !hasAppointmentCue
      : mode === 'plan'
        ? namesTheList
        : namesTheList || (hasShoppingCue && extractTime(source).startMin === null);

  if (wantsShopping) {
    let stripped = source;
    for (let i = 0; i < 4; i += 1) {
      const match = SHOPPING_TRIGGER.exec(stripped.folded);
      if (!match) break;
      stripped = cutGroup(stripped, match, 2);
    }
    const items = splitShoppingItems(normalize(stripped.text))
      .map(parseShoppingItem)
      .filter((item): item is ShoppingDraft => item !== null);
    return items.length ? { kind: 'shopping', items } : null;
  }

  const date = extractDate(source, todayISO);
  const time = extractTime(date.rest);
  const duration = extractDuration(time.rest);

  let title = stripLeadingNoise(duration.rest.text);
  // Das Signalwort ("Termin") nur streichen, wenn danach noch etwas übrig
  // bleibt – bei "Meeting" um 14 Uhr ist es selbst der Titel.
  const titleScan = scan(title);
  const signal = APPOINTMENT_WORD.exec(titleScan.folded);
  if (signal) {
    const withoutSignal = normalize(cutGroup(titleScan, signal, 2).text);
    if (withoutSignal) title = withoutSignal;
  }
  title = titleCase(stripLeadingNoise(title));

  if (!title) return null;

  if (time.startMin !== null) {
    return {
      kind: 'appointment',
      title,
      date: date.date ?? todayISO,
      startMin: time.startMin,
      durationMin: duration.durationMin ?? 60,
    };
  }

  return {
    kind: 'task',
    title,
    date: date.date,
    estimateMin: duration.durationMin,
  };
}

export function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/** Kurzfassung des Ergebnisses für die Bestätigung vor dem Übernehmen. */
export function describeParsed(parsed: Parsed): string {
  switch (parsed.kind) {
    case 'shopping':
      return parsed.items
        .map((item) => {
          const menge = item.quantity ? `${item.quantity}${item.unit ? ` ${item.unit}` : '×'} ` : '';
          const preis = item.estimatedCents !== null ? ` · ${formatEuro(item.estimatedCents)}` : '';
          return `${menge}${item.name}${preis}`;
        })
        .join(' · ');
    case 'appointment': {
      const h = String(Math.floor(parsed.startMin / 60)).padStart(2, '0');
      const m = String(parsed.startMin % 60).padStart(2, '0');
      return `${parsed.title} · ${parsed.date} um ${h}:${m}`;
    }
    case 'task':
      return parsed.date ? `${parsed.title} · bis ${parsed.date}` : parsed.title;
  }
}
