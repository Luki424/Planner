import { STANDARD_VORLAUF, VORLAUF_STUFEN, type Vorlauf } from '../domain/reminders';

/**
 * Einstellungen, die dem Gerät gehören und nicht dem Haushalt.
 *
 * Der Vorlauf für Erinnerungen gehört hierher, nicht in den abgeglichenen
 * Zustand: Der eine will eine Viertelstunde vorher Bescheid wissen, die
 * andere gar nicht – und niemand soll dem anderen die Erinnerungen
 * umstellen, indem er seine eigenen einrichtet.
 *
 * Dasselbe gilt für die Liste dessen, woran schon erinnert wurde. Sie
 * gehört ohnehin nur hierher: Auf dem anderen Gerät ist der Termin ja noch
 * nicht gemeldet worden.
 */

const VORLAUF = 'planner:erinnern-vorlauf';
const GEMELDET = 'planner:erinnert-am';

const hoerer = new Set<() => void>();

function melden() {
  for (const h of hoerer) h();
}

export function beiGeraetewechsel(h: () => void): () => void {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

export function ladeVorlauf(): Vorlauf {
  try {
    const roh = Number(localStorage.getItem(VORLAUF));
    const treffer = VORLAUF_STUFEN.find((s) => s === roh);
    return treffer ?? STANDARD_VORLAUF;
  } catch {
    return STANDARD_VORLAUF;
  }
}

export function speichereVorlauf(v: Vorlauf) {
  try {
    localStorage.setItem(VORLAUF, String(v));
  } catch {
    // Ohne Speicher gilt die Wahl für diese Sitzung.
  }
  melden();
}

/**
 * Woran heute schon erinnert wurde.
 *
 * Mit dem Tag gespeichert, damit die Liste nicht ewig wächst und morgen
 * derselbe Serientermin wieder gemeldet wird. Ohne diesen Merkzettel käme
 * die Erinnerung nach jedem Neuladen erneut – und Neuladen passiert am
 * Handy dauernd.
 */
export function ladeGemeldet(heute: string): Set<string> {
  try {
    const roh = localStorage.getItem(GEMELDET);
    if (!roh) return new Set();
    const daten = JSON.parse(roh) as { tag?: string; ids?: string[] };
    if (daten.tag !== heute) return new Set();
    return new Set(daten.ids ?? []);
  } catch {
    return new Set();
  }
}

export function speichereGemeldet(heute: string, ids: ReadonlySet<string>) {
  try {
    localStorage.setItem(GEMELDET, JSON.stringify({ tag: heute, ids: [...ids] }));
  } catch {
    // Dann wird eben nach dem Neuladen noch einmal erinnert – kein Schaden.
  }
}
