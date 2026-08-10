import type { ID } from './types';

/**
 * „Wo bist du gerade?"
 *
 * Gedacht für zwei Menschen, die zusammenleben und das voneinander wissen
 * wollen. Drei Regeln tragen das Ganze, und sie sind hier notiert, weil sie
 * sich sonst beim nächsten Umbau verlieren:
 *
 * 1. **Jeder schaltet nur für sich ein.** Die Freigabe liegt auf dem Gerät,
 *    nicht im Haushalt – niemand kann sie für den anderen setzen. Eine
 *    Standortfreigabe, die einer für den anderen aktivieren kann, bildet
 *    kein Vertrauensverhältnis ab, sondern eine Überwachung.
 * 2. **Wer teilt, sieht das.** Solange gesendet wird, steht es sichtbar da.
 *    Ein Mitlesen, das man vergisst, ist keins mehr.
 * 3. **Kein Verlauf.** Gespeichert wird genau der letzte Stand je Person.
 *    Eine Spur der letzten Wochen wäre etwas anderes als „wo bist du
 *    gerade", und sie wäre nicht mehr wegzubekommen.
 *
 * Und eine Grenze, die überall dabeisteht: Ein Browser kann das nicht im
 * Hintergrund. Gesendet wird nur, solange der Planer offen ist.
 */

export type Standort = {
  id: ID;
  /** Wessen Standort – die id der Person im Haushalt. */
  memberId: ID;
  lat: number;
  lon: number;
  /** Genauigkeit in Metern, wie das Gerät sie angibt. */
  accuracyM: number;
  /** Zeitpunkt der Messung, ISO. */
  at: string;
  /** Von Hand gesetzt („Ich bin hier") statt laufend gemeldet. */
  manual: boolean;
};

/** Alter in Minuten. Negativ wird zu 0 – eine Uhr, die vorgeht, ist kein Grund zu rechnen. */
export function alterMin(at: string, jetzt: Date = new Date()): number {
  const dann = new Date(at).getTime();
  if (!Number.isFinite(dann)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((jetzt.getTime() - dann) / 60000));
}

/**
 * Wie alt der Stand ist – in Worten.
 *
 * Das Alter ist bei dieser Funktion die wichtigste Angabe, wichtiger als der
 * Ort selbst: Ein Punkt auf der Karte ohne Zeitangabe wird für „jetzt"
 * gehalten. Genau daran scheitern solche Anzeigen im Ernstfall.
 */
export function alterText(min: number): string {
  if (!Number.isFinite(min)) return 'Zeit unbekannt';
  if (min < 1) return 'gerade eben';
  if (min === 1) return 'vor einer Minute';
  if (min < 60) return `vor ${min} Minuten`;
  const std = Math.round(min / 60);
  if (std === 1) return 'vor einer Stunde';
  if (std < 24) return `vor ${std} Stunden`;
  const tage = Math.round(std / 24);
  return tage === 1 ? 'vor einem Tag' : `vor ${tage} Tagen`;
}

/** Frisch genug, um „gerade" zu heißen. */
export const FRISCH_MIN = 15;

export function istFrisch(min: number): boolean {
  return min <= FRISCH_MIN;
}

/**
 * Ein Link, der die Karten-App öffnet.
 *
 * Mit sechs Nachkommastellen – das sind rund elf Zentimeter und damit
 * genauer, als ein Handy je misst. Mehr Stellen wären erfundene Genauigkeit.
 */
export function kartenLink(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

/** Die Genauigkeit in Worten – „auf 30 m genau". */
export function genauigkeitText(accuracyM: number): string {
  if (!Number.isFinite(accuracyM) || accuracyM <= 0) return '';
  if (accuracyM < 1000) return `auf ${Math.round(accuracyM)} m genau`;
  return `auf ${(accuracyM / 1000).toFixed(1)} km genau`;
}

const ERDRADIUS_M = 6_371_000;

/** Abstand zweier Punkte in Metern (Haversine). */
export function abstandM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const bogen = (grad: number) => (grad * Math.PI) / 180;
  const dLat = bogen(b.lat - a.lat);
  const dLon = bogen(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(bogen(a.lat)) * Math.cos(bogen(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * ERDRADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ab dieser Bewegung lohnt ein neuer Eintrag. */
export const BEWEGUNG_M = 120;
/** Und spätestens nach dieser Zeit wieder, auch ohne Bewegung. */
export const AUFFRISCHUNG_MIN = 10;

/**
 * Lohnt sich ein neuer Eintrag?
 *
 * Jede Meldung ist ein Schreibvorgang, der beim anderen ankommt. Ohne diese
 * Bremse stünde bei jedem GPS-Zucken ein neuer Stand in der Datenbank –
 * Datenverkehr und Akku für nichts.
 */
export function lohntEintrag(
  alt: Standort | null,
  neu: { lat: number; lon: number },
  jetzt: Date = new Date(),
): boolean {
  if (!alt) return true;
  if (alterMin(alt.at, jetzt) >= AUFFRISCHUNG_MIN) return true;
  return abstandM(alt, neu) >= BEWEGUNG_M;
}

/**
 * Warum die Ortung nicht ging – in einem Satz, mit dem man etwas anfangen kann.
 *
 * Die Codes der Schnittstelle heißen 1, 2 und 3. Wer sie sieht, weiß nichts;
 * am wichtigsten ist der erste Fall, weil er sich beheben lässt.
 */
export function ortungsFehler(code: number): string {
  if (code === 1) {
    return 'Der Zugriff auf den Standort ist abgelehnt. Das lässt sich nur in den Einstellungen des Browsers ändern.';
  }
  if (code === 2) return 'Der Standort ließ sich nicht bestimmen. Drinnen klappt es oft nicht.';
  if (code === 3) return 'Die Ortung hat zu lange gedauert.';
  return 'Die Ortung hat nicht geklappt.';
}
