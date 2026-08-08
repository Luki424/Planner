/**
 * Kalenderdateien lesen und schreiben (iCalendar, RFC 5545).
 *
 * Zweck: den beruflichen Kalender einmal einlesen, statt Termine zweimal zu
 * pflegen – und eigene Termine so ausgeben, dass der Handy-Kalender sie
 * übernimmt. Bewusst dateibasiert: kein Konto, keine laufende Verbindung,
 * nichts, das im Hintergrund mitliest.
 *
 * Vom Standard ist das umgesetzt, was in echten Kalenderdateien vorkommt.
 * Was darüber hinausgeht, wird nicht geraten, sondern gemeldet – ein
 * übersprungener Termin ist besser als einer am falschen Tag.
 */

import { addDays } from './dates';

export type IcsEvent = {
  /** Stabile Kennung aus der Datei; verhindert Doppel beim zweiten Import. */
  uid: string;
  title: string;
  /** YYYY-MM-DD in Ortszeit. */
  date: string;
  /** Minuten seit Mitternacht; null bei ganztägigen Einträgen. */
  startMin: number | null;
  durationMin: number;
  location: string;
  description: string;
  allDay: boolean;
};

export type IcsParseResult = {
  events: IcsEvent[];
  /** Was nicht übernommen wurde, im Klartext – erscheint in der Vorschau. */
  skipped: string[];
};

/* ------------------------------------------------------------------ Lesen */

/**
 * Hebt die Zeilenfaltung auf. Der Standard bricht lange Zeilen nach 75
 * Zeichen um und setzt sie mit einem Leerzeichen oder Tabulator fort – ohne
 * das Zusammenfügen zerfiele jeder längere Betreff.
 */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Löst die Maskierung in Textwerten auf (\\n, \\, \, und \;). */
function unescapeText(value: string): string {
  return value
    .replace(/\\[nN]/g, '\n')
    .replace(/\\([,;\\])/g, '$1')
    .trim();
}

type Prop = { name: string; params: Record<string, string>; value: string };

/** Zerlegt "DTSTART;TZID=Europe/Berlin:20260806T090000" in seine Teile. */
function parseLine(line: string): Prop | null {
  // Der Doppelpunkt in einem Parameterwert darf nicht trennen, deshalb wird
  // außerhalb von Anführungszeichen gesucht.
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ':' && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(';');
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

const pad = (n: number) => String(n).padStart(2, '0');

function toISODate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Rechnet eine Wanduhrzeit aus einer benannten Zeitzone in Ortszeit um.
 *
 * Ohne Zeitzonendatenbank im Browser geht das über einen Umweg: die naive
 * Zeit wird als UTC angenommen, in der Zielzone formatiert und aus der
 * Abweichung der tatsächliche Zeitpunkt bestimmt. Das berücksichtigt auch
 * Sommerzeit, weil `Intl` sie kennt.
 */
function zonedToLocal(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  timeZone: string,
): Date | null {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    // Unbekannte Zeitzone – der Aufrufer behandelt das als schwebende Zeit.
    return null;
  }

  const wanted = Date.UTC(y, mo - 1, d, h, mi, 0);
  // Zwei Durchgänge genügen, auch an den Umstellungstagen.
  let guess = wanted;
  for (let i = 0; i < 2; i += 1) {
    const parts = fmt.formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const asUTC = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    );
    guess += wanted - asUTC;
  }
  return new Date(guess);
}

type Moment = { date: string; startMin: number | null };

/** Deutet einen Zeitpunkt aus DTSTART/DTEND samt Parametern. */
function parseMoment(prop: Prop): Moment | null {
  const value = prop.value.trim();

  // Ganztägig: nur ein Datum, keine Uhrzeit.
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly || prop.params.VALUE === 'DATE') {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(value);
    if (!m) return null;
    return { date: toISODate(Number(m[1]), Number(m[2]), Number(m[3])), startMin: null };
  }

  const full = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
  if (!full) return null;
  const [, ys, mos, ds, hs, mis, , zulu] = full;
  const y = Number(ys);
  const mo = Number(mos);
  const d = Number(ds);
  const h = Number(hs);
  const mi = Number(mis);

  // Ortszeit ohne Zone: so übernehmen, wie sie dasteht.
  if (!zulu && !prop.params.TZID) {
    return { date: toISODate(y, mo, d), startMin: h * 60 + mi };
  }

  const instant = zulu
    ? new Date(Date.UTC(y, mo - 1, d, h, mi, 0))
    : zonedToLocal(y, mo, d, h, mi, prop.params.TZID);

  // Unbekannte Zeitzone: lieber die Wanduhrzeit als gar nichts.
  if (!instant || Number.isNaN(instant.getTime())) {
    return { date: toISODate(y, mo, d), startMin: h * 60 + mi };
  }

  return {
    date: toISODate(instant.getFullYear(), instant.getMonth() + 1, instant.getDate()),
    startMin: instant.getHours() * 60 + instant.getMinutes(),
  };
}

/** Deutet eine Dauer wie "PT1H30M" oder "P2D" in Minuten. */
function parseDuration(value: string): number | null {
  const m = /^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, w, d, h, mi, s] = m;
  const minutes =
    Number(w ?? 0) * 7 * 24 * 60 +
    Number(d ?? 0) * 24 * 60 +
    Number(h ?? 0) * 60 +
    Number(mi ?? 0) +
    Math.round(Number(s ?? 0) / 60);
  return minutes > 0 ? minutes : null;
}

/** Abstand zweier Tage in Tagen. */
function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

const BYDAY: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };

/** Wochentag als 0 = Montag … 6 = Sonntag. */
function weekdayOf(date: string): number {
  const d = new Date(`${date}T12:00:00`);
  return (d.getDay() + 6) % 7;
}

/**
 * Löst eine Wiederholungsregel in einzelne Tage auf – begrenzt auf das
 * betrachtete Fenster und auf eine Höchstzahl, damit eine Regel ohne Ende
 * nicht endlos Termine erzeugt.
 */
function expandRule(
  rule: string,
  start: string,
  windowStart: string,
  windowEnd: string,
  exdates: Set<string>,
  limit = 400,
): { dates: string[]; unsupported: string | null } {
  const parts: Record<string, string> = {};
  for (const piece of rule.split(';')) {
    const eq = piece.indexOf('=');
    if (eq > 0) parts[piece.slice(0, eq).toUpperCase()] = piece.slice(eq + 1);
  }

  const freq = (parts.FREQ ?? '').toUpperCase();
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) {
    return { dates: [], unsupported: `Wiederholung „${freq || rule}" wird nicht gedeutet` };
  }
  // BYMONTHDAY, BYSETPOS und Ähnliches werden bewusst nicht geraten.
  for (const key of ['BYSETPOS', 'BYMONTHDAY', 'BYYEARDAY', 'BYWEEKNO']) {
    if (parts[key]) {
      return { dates: [], unsupported: `Wiederholung mit ${key} wird nicht gedeutet` };
    }
  }
  if (freq !== 'WEEKLY' && parts.BYDAY) {
    return { dates: [], unsupported: `Wiederholung mit BYDAY und ${freq} wird nicht gedeutet` };
  }

  const interval = Math.max(1, Number(parts.INTERVAL ?? 1));
  const count = parts.COUNT ? Number(parts.COUNT) : null;
  const untilMatch = parts.UNTIL ? /^(\d{4})(\d{2})(\d{2})/.exec(parts.UNTIL) : null;
  const until = untilMatch
    ? toISODate(Number(untilMatch[1]), Number(untilMatch[2]), Number(untilMatch[3]))
    : null;

  const weekdays = parts.BYDAY
    ? parts.BYDAY.split(',')
        .map((d) => BYDAY[d.trim().slice(-2).toUpperCase()])
        .filter((d) => d !== undefined)
    : null;

  const dates: string[] = [];
  let produced = 0;

  const accept = (date: string) => {
    if (until && date > until) return false;
    if (exdates.has(date)) return true; // zählt für COUNT, wird aber nicht übernommen
    if (date >= windowStart && date <= windowEnd) dates.push(date);
    return true;
  };

  if (freq === 'DAILY') {
    for (let d = start, i = 0; i < limit; d = addDays(d, interval), i += 1) {
      if (count !== null && produced >= count) break;
      if (!accept(d)) break;
      produced += 1;
      if (d > windowEnd) break;
    }
  } else if (freq === 'WEEKLY') {
    const days = weekdays && weekdays.length > 0 ? weekdays : [weekdayOf(start)];
    // Beginn der Woche, in der der erste Termin liegt.
    let weekStart = addDays(start, -weekdayOf(start));
    for (let week = 0; week < limit; week += 1) {
      if (count !== null && produced >= count) break;
      let past = false;
      for (const day of [...days].sort((a, b) => a - b)) {
        const date = addDays(weekStart, day);
        if (date < start) continue;
        if (count !== null && produced >= count) break;
        if (!accept(date)) {
          past = true;
          break;
        }
        produced += 1;
      }
      if (past) break;
      weekStart = addDays(weekStart, 7 * interval);
      if (weekStart > windowEnd) break;
    }
  } else {
    // MONTHLY und YEARLY am selben Kalendertag.
    const day = Number(start.slice(8, 10));
    const stepMonths = freq === 'YEARLY' ? 12 * interval : interval;
    let year = Number(start.slice(0, 4));
    let month = Number(start.slice(5, 7));
    for (let i = 0; i < limit; i += 1) {
      if (count !== null && produced >= count) break;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      // Der 31. in einem kurzen Monat entfällt, statt in den nächsten zu rutschen.
      if (day <= lastDay) {
        const date = toISODate(year, month, day);
        if (date >= start) {
          if (!accept(date)) break;
          produced += 1;
        }
      }
      month += stepMonths;
      while (month > 12) {
        month -= 12;
        year += 1;
      }
      if (toISODate(year, month, 1) > windowEnd) break;
    }
  }

  return { dates, unsupported: null };
}

/**
 * Liest eine Kalenderdatei.
 *
 * `windowStart`/`windowEnd` grenzen ein, welcher Zeitraum übernommen wird –
 * ein Arbeitskalender reicht sonst Jahre zurück.
 */
export function parseIcs(text: string, windowStart: string, windowEnd: string): IcsParseResult {
  const lines = unfold(text);
  const events: IcsEvent[] = [];
  const skipped: string[] = [];

  let current: Record<string, Prop> | null = null;
  let exdates: Set<string> = new Set();
  let inEvent = false;
  let depth = 0;

  /*
   * Erst sammeln, dann auswerten.
   *
   * Outlook und Exchange schreiben eine Serie als ein Ereignis mit RRULE und
   * zusätzlich jeden geänderten Einzeltermin als eigenes Ereignis – mit
   * derselben UID und einer RECURRENCE-ID, die sagt, welchen Termin der
   * Serie er ersetzt. Wer das nicht kennt, zählt beide: den aus der Serie
   * gerechneten und den ausgeschriebenen. Um beim Auflösen der Serie zu
   * wissen, welche Tage schon ersetzt sind, müssen die Ausnahmen vorher
   * bekannt sein – deshalb zwei Durchgänge.
   */
  const gesammelt: Array<{ props: Record<string, Prop>; exdates: Set<string> }> = [];

  const finish = () => {
    const props = current;
    current = null;
    const gemerkt = exdates;
    exdates = new Set();
    if (props) gesammelt.push({ props, exdates: gemerkt });
  };

  const auswerten = (props: Record<string, Prop>, gemerkt: Set<string>, ersetzt: Set<string>) => {

    const dtstart = props.DTSTART;
    if (!dtstart) {
      skipped.push('Termin ohne Beginn');
      return;
    }
    const start = parseMoment(dtstart);
    if (!start) {
      skipped.push(`Beginn nicht lesbar: ${dtstart.value}`);
      return;
    }

    const title = unescapeText(props.SUMMARY?.value ?? '') || 'Termin';
    const allDay = start.startMin === null;

    // Dauer: aus DTEND oder DURATION, sonst eine Stunde.
    let durationMin = 60;
    if (props.DTEND) {
      const end = parseMoment(props.DTEND);
      if (end) {
        if (allDay || end.startMin === null) {
          // Ganztägig: DTEND ist der erste Tag danach.
          durationMin = Math.max(1, daysBetween(start.date, end.date)) * 24 * 60;
        } else {
          const tage = daysBetween(start.date, end.date);
          durationMin = tage * 24 * 60 + (end.startMin - (start.startMin ?? 0));
        }
      }
    } else if (props.DURATION) {
      durationMin = parseDuration(props.DURATION.value) ?? 60;
    }
    if (durationMin <= 0) durationMin = 60;

    const basis: Omit<IcsEvent, 'date' | 'uid'> = {
      title,
      startMin: start.startMin,
      durationMin,
      location: unescapeText(props.LOCATION?.value ?? ''),
      description: unescapeText(props.DESCRIPTION?.value ?? ''),
      allDay,
    };
    const uid = props.UID?.value.trim() || `${title}|${start.date}|${start.startMin ?? 'ganztags'}`;

    if (props.RRULE) {
      const { dates, unsupported } = expandRule(
        props.RRULE.value,
        start.date,
        windowStart,
        windowEnd,
        gemerkt,
      );
      if (unsupported) {
        skipped.push(`${title}: ${unsupported}`);
        return;
      }
      for (const date of dates) {
        // Für diesen Tag steht ein eigener, geänderter Termin in der Datei.
        if (ersetzt.has(`${uid}|${date}`)) continue;
        events.push({ ...basis, uid: `${uid}|${date}`, date });
      }
      return;
    }

    if (start.date < windowStart || start.date > windowEnd) return;
    /*
     * Ein ersetzter Einzeltermin bekommt die Kennung des Tages, den er
     * ersetzt. So erkennt ein zweiter Import ihn wieder – und er kollidiert
     * nicht mit der Serie, aus der er stammt.
     */
    const wiederkehrend = props['RECURRENCE-ID'];
    const ersatzTag = wiederkehrend ? parseMoment(wiederkehrend)?.date : null;
    events.push({ ...basis, uid: ersatzTag ? `${uid}|${ersatzTag}` : uid, date: start.date });
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      depth = 0;
      current = {};
      exdates = new Set();
      continue;
    }
    if (!inEvent) continue;
    if (upper.startsWith('END:VEVENT')) {
      inEvent = false;
      finish();
      continue;
    }
    // Alarme und andere eingebettete Bestandteile überspringen.
    if (upper.startsWith('BEGIN:')) {
      depth += 1;
      continue;
    }
    if (upper.startsWith('END:')) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) continue;

    const prop = parseLine(line);
    if (!prop || !current) continue;
    if (prop.name === 'EXDATE') {
      for (const piece of prop.value.split(',')) {
        const m = /^(\d{4})(\d{2})(\d{2})/.exec(piece.trim());
        if (m) exdates.add(toISODate(Number(m[1]), Number(m[2]), Number(m[3])));
      }
      continue;
    }
    // Bei mehrfach vorkommenden Feldern zählt das erste.
    if (!current[prop.name]) current[prop.name] = prop;
  }

  // Welche Termine einer Serie sind durch einen eigenen Eintrag ersetzt?
  const ersetzt = new Set<string>();
  for (const { props } of gesammelt) {
    const wiederkehrend = props['RECURRENCE-ID'];
    if (!wiederkehrend) continue;
    const tag = parseMoment(wiederkehrend)?.date;
    const uid = props.UID?.value.trim();
    if (tag && uid) ersetzt.add(`${uid}|${tag}`);
  }

  for (const { props, exdates: gemerkt } of gesammelt) auswerten(props, gemerkt, ersetzt);

  events.sort((a, b) =>
    a.date === b.date ? (a.startMin ?? 0) - (b.startMin ?? 0) : a.date < b.date ? -1 : 1,
  );
  return { events, skipped };
}

/* ---------------------------------------------------------------- Schreiben */

/** Maskiert Text so, wie es der Standard verlangt. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Bricht eine Zeile nach 75 Oktetten um, wie es der Standard vorsieht. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    out.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) out.push(` ${rest}`);
  return out.join('\r\n');
}

function stampLocal(date: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${date.replace(/-/g, '')}T${pad(h)}${pad(m)}00`;
}

export type ExportEvent = {
  uid: string;
  title: string;
  date: string;
  startMin: number;
  durationMin: number;
  /** Ganztägig: geht als reines Datum hinaus, ohne Uhrzeit und ohne Zeitzone. */
  allDay?: boolean;
  description?: string;
};

/**
 * Baut eine Kalenderdatei.
 *
 * Die Zeiten werden als Ortszeit ohne Zonenangabe geschrieben. Das ist die
 * ehrliche Darstellung: der Planer führt Termine als Wanduhrzeit, nicht als
 * Zeitpunkt auf der Weltkugel. Ein Kalender, der die Datei einliest, legt sie
 * damit auf dieselbe Uhrzeit, in der sie hier stehen.
 */
export function buildIcs(events: ExportEvent[], now = new Date()): string {
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tagesplaner//DE',
    'CALSCALE:GREGORIAN',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT', fold(`UID:${event.uid}`), `DTSTAMP:${stamp}`);

    if (event.allDay) {
      // DTEND ist bei Datumsangaben der erste Tag *danach* – RFC 5545, 3.6.1.
      lines.push(
        `DTSTART;VALUE=DATE:${event.date.replaceAll('-', '')}`,
        `DTEND;VALUE=DATE:${addDays(event.date, 1).replaceAll('-', '')}`,
      );
    } else {
      const endMin = event.startMin + event.durationMin;
      const endDate = addDays(event.date, Math.floor(endMin / (24 * 60)));
      lines.push(
        `DTSTART:${stampLocal(event.date, event.startMin)}`,
        `DTEND:${stampLocal(endDate, endMin % (24 * 60))}`,
      );
    }

    lines.push(fold(`SUMMARY:${escapeText(event.title)}`));
    if (event.description) lines.push(fold(`DESCRIPTION:${escapeText(event.description)}`));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
