import { STANDARD_MODELL, type Anbieter, type Zugang } from './client';

/**
 * Der Schlüssel für das Sprachmodell – **nur auf diesem Gerät**.
 *
 * Bewusst neben dem übrigen Zustand und nicht darin: Alles im Zustand wird
 * mit dem Haushalt abgeglichen und läge damit in der gemeinsamen Datenbank.
 * Ein API-Schlüssel gehört dorthin nicht. Der Preis dafür ist, dass ihn
 * jeder einmal auf seinem Gerät einträgt – das ist die richtige Seite des
 * Handels.
 */

const SCHLUESSEL = 'planner:ki-schluessel';
const ANBIETER = 'planner:ki-anbieter';
const MODELL = 'planner:ki-modell';

function lesen(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    // Privater Modus ohne Speicher – dann eben ohne Assistent.
    return '';
  }
}

function schreiben(key: string, wert: string) {
  try {
    if (wert) localStorage.setItem(key, wert);
    else localStorage.removeItem(key);
  } catch {
    // Ohne Speicher gilt die Eingabe nur für diese Sitzung.
  }
}

export function ladeZugang(): Zugang | null {
  const schluessel = lesen(SCHLUESSEL);
  if (!schluessel) return null;
  const anbieter = (lesen(ANBIETER) || 'anthropic') as Anbieter;
  return {
    anbieter,
    schluessel,
    modell: lesen(MODELL) || STANDARD_MODELL[anbieter],
  };
}

export function speichereZugang(zugang: Zugang | null) {
  schreiben(SCHLUESSEL, zugang?.schluessel ?? '');
  schreiben(ANBIETER, zugang?.anbieter ?? '');
  schreiben(MODELL, zugang?.modell ?? '');
}

/**
 * Zeigt einen Schlüssel an, ohne ihn zu verraten: `sk-ant-…7Qf2`.
 * Genug, um zu erkennen, ob der richtige hinterlegt ist.
 */
export function maskiere(schluessel: string): string {
  if (schluessel.length <= 12) return '••••';
  return `${schluessel.slice(0, 7)}…${schluessel.slice(-4)}`;
}
