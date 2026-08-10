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
const VORLESEN = 'planner:ki-vorlesen';
const WECKWORT = 'planner:ki-weckwort';

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
  melden();
}

/*
 * Wer ändert, sagt Bescheid.
 *
 * Diese Einstellungen liegen im Gerätespeicher und nicht im Zustand – React
 * bekommt von einer Änderung also nichts mit. Die Blase am Rand ist die
 * ganze Zeit da und hätte den umgelegten Schalter sonst erst beim nächsten
 * Neustart bemerkt.
 */
const hoerer = new Set<() => void>();

function melden() {
  for (const h of hoerer) h();
}

export function beiEinstellungswechsel(h: () => void): () => void {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
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

/*
 * Vorlesen ist ebenfalls Gerätesache und ausdrücklich nicht Haushaltssache:
 * Der eine sitzt im Auto, die andere im Büro. Eine abgeglichene Einstellung
 * würde dem anderen die Stimme an- oder abschalten.
 *
 * Standard ist an: Wer nichts einstellt, hat den Assistenten meist per
 * Sprache gefragt – und dann will man auch eine Antwort hören.
 */
export function ladeVorlesen(): boolean {
  return lesen(VORLESEN) !== 'aus';
}

export function speichereVorlesen(an: boolean) {
  schreiben(VORLESEN, an ? 'an' : 'aus');
}

/*
 * Das Weckwort ist standardmäßig **aus** – anders als das Vorlesen.
 *
 * Es hält das Mikrofon dauerhaft offen, kostet Akku und schickt bei Chrome
 * laufend Ton zur Auswertung an Google. Das ist eine Entscheidung, die man
 * treffen soll, und keine, in die man hineinrutscht.
 */
export function ladeWeckwort(): boolean {
  return lesen(WECKWORT) === 'an';
}

export function speichereWeckwort(an: boolean) {
  schreiben(WECKWORT, an ? 'an' : 'aus');
}

/**
 * Zeigt einen Schlüssel an, ohne ihn zu verraten: `sk-ant-…7Qf2`.
 * Genug, um zu erkennen, ob der richtige hinterlegt ist.
 */
export function maskiere(schluessel: string): string {
  if (schluessel.length <= 12) return '••••';
  return `${schluessel.slice(0, 7)}…${schluessel.slice(-4)}`;
}
