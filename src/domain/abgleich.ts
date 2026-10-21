import type { IcsEvent, Zeitraum } from './ics';
import type { Block } from './types';

/**
 * Was sich im Arbeitskalender seit dem letzten Einlesen bewegt hat.
 *
 * Der Planer legt beim Einlesen nur *Neues* an. Ein verschobener Termin kam
 * deshalb zur neuen Zeit dazu, und der alte blieb stehen – wer es nicht von
 * Hand bemerkte, hatte die Besprechung zweimal im Plan, einmal davon falsch.
 * Ein abgesagter Termin blieb ganz einfach stehen.
 *
 * **Woraus sich das schließen lässt, und woraus nicht.** Dass ein Termin
 * „nicht mehr da" ist, sagt nur eine Datei, die einen Zeitraum vollständig
 * enthält. Ein Ausschnitt mit nur den neuen Einträgen sagt über alles andere
 * nichts – mit ihm hielte der Abgleich jeden Kick-Off, der nicht darin
 * steht, für entfallen. Deshalb gleicht er nur ab, wenn die Datei selbst
 * zusagt, welchen Zeitraum sie vollständig enthält (`vollstaendig`), und nur
 * innerhalb dieses Zeitraums.
 *
 * **Nur Termine aus derselben Quelle.** Die Kennung eines eingelesenen
 * Termins endet auf seine Herkunft („…@outlook.bvd"). Termine aus einem
 * anderen Kalender, die zufällig im selben Zeitraum liegen, fasst der
 * Abgleich nicht an – sie stehen in der Datei ja gar nicht zur Rede.
 *
 * Eigene Termine (ohne Kennung) sind ohnehin außen vor.
 */
export type Abgleich = {
  /** Alter Block und der neue Termin, der ihn ersetzt. */
  verschoben: Array<{ alt: Block; neu: IcsEvent }>;
  /** Blöcke, deren Termin es in der Quelle nicht mehr gibt. */
  entfallen: Block[];
};

const LEER: Abgleich = { verschoben: [], entfallen: [] };

/** „…@outlook.bvd|2026-10-26" → „outlook.bvd". */
function quelle(uid: string): string {
  const ohneTag = uid.split('|')[0];
  const at = ohneTag.lastIndexOf('@');
  return at >= 0 ? ohneTag.slice(at + 1).toLowerCase() : '';
}

const titelSchluessel = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();

const tageAbstand = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

export function abgleichen(
  bloecke: Block[],
  events: IcsEvent[],
  vollstaendig: Zeitraum | null,
): Abgleich {
  if (!vollstaendig || events.length === 0) return LEER;

  const quellen = new Set(events.map((e) => quelle(e.uid)).filter(Boolean));
  if (quellen.size === 0) return LEER;

  const inDatei = new Set(events.map((e) => e.uid));
  const bekannt = new Set(bloecke.map((b) => b.icsUid).filter(Boolean) as string[]);

  const verschwunden = bloecke.filter(
    (b) =>
      b.icsUid &&
      quellen.has(quelle(b.icsUid)) &&
      b.date >= vollstaendig.von &&
      b.date < vollstaendig.bis &&
      !inDatei.has(b.icsUid),
  );
  if (verschwunden.length === 0) return LEER;

  // Was neu hinzukommt, nach Titel – Kandidaten für das Ziel einer Verschiebung.
  const neuNachTitel = new Map<string, IcsEvent[]>();
  for (const e of events) {
    if (bekannt.has(e.uid)) continue;
    const k = titelSchluessel(e.title);
    neuNachTitel.set(k, [...(neuNachTitel.get(k) ?? []), e]);
  }

  /*
   * Paare bilden: gleicher Titel, und unter mehreren der zeitlich nächste.
   * Jeder neue Termin ersetzt höchstens einen alten – sonst würde aus einem
   * verschobenen Kick-Off das Ersatzziel für drei verschwundene.
   * Ganztägiges paart nur mit Ganztägigem: Eine Bereitschaft, die auf einen
   * anderen Tag rückt, ist eine neue Bereitschaft, keine verschobene
   * Besprechung.
   */
  const vergeben = new Set<string>();
  const verschoben: Abgleich['verschoben'] = [];
  const entfallen: Block[] = [];
  for (const alt of [...verschwunden].sort((a, b) => a.date.localeCompare(b.date))) {
    const kandidaten = (neuNachTitel.get(titelSchluessel(alt.title)) ?? []).filter(
      (e) => !vergeben.has(e.uid) && Boolean(e.allDay) === Boolean(alt.allDay),
    );
    if (kandidaten.length === 0) {
      entfallen.push(alt);
      continue;
    }
    const neu = kandidaten.reduce((best, e) =>
      tageAbstand(e.date, alt.date) < tageAbstand(best.date, alt.date) ? e : best,
    );
    vergeben.add(neu.uid);
    verschoben.push({ alt, neu });
  }
  return { verschoben, entfallen };
}
