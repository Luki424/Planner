import { addDays } from './dates';
import type { ExportEvent } from './ics';

/**
 * Aus dem Arbeitskalender in den Planer.
 *
 * Der Weg über eine `.ics`-Datei bleibt der normale (siehe `ics.ts`). Dieses
 * Stück ist für den Fall, dass der Arbeitskalender direkt gelesen werden kann
 * – dann kommen die Termine nicht als Datei, sondern als Liste von Einträgen
 * an, und daraus wird hier eine Kalenderdatei, die der Planer einlesen kann.
 *
 * **Warum der Umweg über eine Datei und nicht direkt in den Zustand?** Weil
 * der Planer seine Daten im Browser und im Haushalt führt, nicht auf einem
 * Server. Von außen kommt niemand hinein – das ist Absicht und bleibt so.
 * Was von außen geht, ist eine Datei vorzubereiten, die drinnen mit einem
 * Tipp eingelesen wird, samt Vorschau davor.
 *
 * Drei Entscheidungen, die man nicht sofort sieht:
 *
 * **Die Uhrzeit wird als Wanduhrzeit übernommen.** Outlook gibt zu jedem
 * Termin die Ortszeit *und* die Zone des Postfachs heraus („2026-10-19T09:00"
 * in „W. Europe Standard Time"). Der Planer führt Termine als Wanduhrzeit –
 * neun Uhr ist neun Uhr. Die Zone wird deshalb bewusst nicht umgerechnet:
 * Eine Umrechnung von Ortszeit in Ortszeit ist entweder nichts oder ein
 * Fehler, und beim Wechsel auf Sommerzeit wäre sie ein Fehler.
 *
 * **Ganztägiges wird je Tag ein Eintrag.** Outlook schreibt eine Bereitschaft
 * über drei Tage als *einen* Termin von Mittwoch 00:00 bis Samstag 00:00. Der
 * Planer legt ganztägige Einträge je Tag ab. Hier zerfällt der Termin
 * deshalb in drei – was der Planer beim Einlesen ohnehin täte, nur dass die
 * Kennung dann für alle drei dieselbe wäre und zwei davon als Doppel
 * durchfielen.
 *
 * **Die Kennung beschreibt den Termin, nicht den Datensatz.** Sie entsteht
 * aus Betreff und Beginn, nicht aus Outlooks interner Nummer. Der Grund:
 * Der Planer legt beim Einlesen nur *Neues* an, er ändert nichts Bestehendes.
 * Mit Outlooks Nummer behielte ein verschobener Termin seine Kennung und
 * damit stillschweigend die alte Uhrzeit – man sähe die Verschiebung nie.
 * So, wie es jetzt ist, erscheint er zur neuen Zeit; der alte Block bleibt
 * stehen und muss von Hand weg. Sichtbar falsch ist besser als unsichtbar
 * falsch.
 */

/** Was von Outlook kommt – nur die Felder, die hier gebraucht werden. */
export type OutlookEvent = {
  subject?: string | null;
  location?: string | null;
  start?: { dateTime?: string | null; timeZone?: string | null } | null;
  end?: { dateTime?: string | null; timeZone?: string | null } | null;
  isAllDay?: boolean | null;
  isCancelled?: boolean | null;
};

export type Umwandlung = {
  events: ExportEvent[];
  /** Was nicht mitkam, im Klartext – damit kein Termin stumm verschwindet. */
  uebergangen: string[];
};

type Zeitpunkt = { date: string; minutes: number };

/** „2026-10-19T09:00:00.0000000" → Tag und Minute, ohne Zonenrechnung. */
function lesePunkt(wert: string | null | undefined): Zeitpunkt | null {
  if (!wert) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(wert.trim());
  if (!m) return null;
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    minutes: Number(m[4]) * 60 + Number(m[5]),
  };
}

/** Ganze Tage von einem Datum zum anderen. */
function tageZwischen(von: string, bis: string): number {
  const [jv, mv, tv] = von.split('-').map(Number);
  const [jb, mb, tb] = bis.split('-').map(Number);
  const ms = Date.UTC(jb, mb - 1, tb) - Date.UTC(jv, mv - 1, tv);
  return Math.round(ms / 86_400_000);
}

/**
 * Ein kurzes, stabiles Stück Text für die Kennung.
 *
 * Umlaute werden ausgeschrieben statt weggeworfen: „Präsi" und „Prasi"
 * wären sonst dieselbe Kennung wie „Preisi", und aus zwei Terminen würde
 * beim Einlesen einer.
 */
function kurzform(text: string): string {
  const ersetzt = text
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');
  const roh = ersetzt.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (roh || 'termin').slice(0, 40).replace(/-+$/, '');
}

const KENNUNG_QUELLE = 'outlook.bvd';

function kennung(titel: string, date: string, minutes: number | null): string {
  const tag = date.replaceAll('-', '');
  const zeit =
    minutes === null
      ? ''
      : `t${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}`;
  return `${kurzform(titel)}-${tag}${zeit}@${KENNUNG_QUELLE}`;
}

/**
 * Macht aus Outlook-Einträgen Termine für eine Kalenderdatei.
 *
 * Abgesagtes bleibt draußen – ein abgesagter Termin, der im Tagesplan
 * steht, ist schlechter als keiner, weil man die Zeit freihält.
 *
 * Der Beschreibungstext bleibt bewusst draußen. Outlook schleppt dort ganze
 * E-Mail-Verläufe mit, abgeschnitten nach ein paar hundert Zeichen; als
 * Notiz an jedem Block wäre das Lärm, und der Teams-Link, der darin
 * interessant wäre, ist meist mitten in der Adresse abgeschnitten.
 */
export function ausOutlook(eintraege: OutlookEvent[]): Umwandlung {
  const events: ExportEvent[] = [];
  const uebergangen: string[] = [];
  const vergeben = new Set<string>();

  const eindeutig = (basis: string): string => {
    if (!vergeben.has(basis)) {
      vergeben.add(basis);
      return basis;
    }
    // Zwei gleich benannte Termine zur selben Minute – selten, aber es gibt
    // sie. Ohne Unterscheidung fiele der zweite beim Einlesen als Doppel weg.
    for (let i = 2; ; i += 1) {
      const kandidat = basis.replace(`@${KENNUNG_QUELLE}`, `-${i}@${KENNUNG_QUELLE}`);
      if (!vergeben.has(kandidat)) {
        vergeben.add(kandidat);
        return kandidat;
      }
    }
  };

  for (const e of eintraege) {
    const titel = (e.subject ?? '').trim();
    const ort = (e.location ?? '').trim();
    const von = lesePunkt(e.start?.dateTime);
    const bis = lesePunkt(e.end?.dateTime);

    if (e.isCancelled) {
      uebergangen.push(`abgesagt: ${titel || 'ohne Betreff'}`);
      continue;
    }
    if (!titel) {
      uebergangen.push(`ohne Betreff am ${von?.date ?? 'unbekannten Tag'}`);
      continue;
    }
    if (!von) {
      uebergangen.push(`${titel}: kein Beginn angegeben`);
      continue;
    }

    if (e.isAllDay) {
      /*
       * Das Ende ist bei ganztägigen Terminen der erste Tag *danach* – so
       * steht es im Standard und so hält es Outlook. Ohne das Minus wäre
       * jede Bereitschaft einen Tag zu lang.
       */
      const tage = bis ? Math.max(1, tageZwischen(von.date, bis.date)) : 1;
      for (let i = 0; i < tage; i += 1) {
        const tag = addDays(von.date, i);
        events.push({
          uid: eindeutig(kennung(titel, tag, null)),
          title: titel,
          date: tag,
          startMin: 0,
          durationMin: 24 * 60,
          allDay: true,
          ...(ort ? { location: ort } : {}),
        });
      }
      continue;
    }

    if (!bis) {
      uebergangen.push(`${titel} am ${von.date}: kein Ende angegeben`);
      continue;
    }
    const dauer = tageZwischen(von.date, bis.date) * 24 * 60 + bis.minutes - von.minutes;
    if (dauer <= 0) {
      uebergangen.push(`${titel} am ${von.date}: Ende liegt nicht nach dem Beginn`);
      continue;
    }

    events.push({
      uid: eindeutig(kennung(titel, von.date, von.minutes)),
      title: titel,
      date: von.date,
      startMin: von.minutes,
      durationMin: dauer,
      ...(ort ? { location: ort } : {}),
    });
  }

  events.sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1));
  return { events, uebergangen };
}
