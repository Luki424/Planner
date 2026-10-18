import type { AppState } from './types';

/**
 * Wer belegt den Platz?
 *
 * Ob die Ablage voll ist und womit, konnte die App bis hierher nicht sagen
 * – und ohne diese Antwort ist „schaff Platz" ein Ratschlag ohne Adresse.
 * Beim ersten Einsatz hat genau diese Aufstellung gezeigt, dass eine
 * Speichermeldung *nicht* am Platz lag: 474 kB eigene Daten, keine Belege.
 *
 * Gezählt wird die Länge des JSON – darin liegt der Stand, und darin liegen
 * die Bilder als Data-URL. Zeichen statt Bytes ist für Base64 dasselbe, und
 * für alles andere nah genug: Es geht um die Größenordnung, nicht um die
 * dritte Stelle.
 *
 * Die unangenehme Zeile ist der Papierkorb. Ein gelöschter Beleg wandert
 * **mitsamt Bild** dorthin (siehe `deleteReceipt`). Wer Belege löscht, um
 * Platz zu schaffen, gewinnt deshalb zunächst gar nichts – das muss
 * dastehen, sonst löscht man zweimal umsonst.
 */
export type Posten = {
  name: string;
  bytes: number;
  /** Warum das so viel ist, oder was dagegen hilft. */
  hinweis?: string;
};

export type Verbrauch = {
  gesamt: number;
  /** Absteigend sortiert – der größte Posten zuerst, denn der zählt. */
  posten: Posten[];
};

const laenge = (wert: unknown): number => {
  if (wert === null || wert === undefined) return 0;
  try {
    return JSON.stringify(wert)?.length ?? 0;
  } catch {
    return 0;
  }
};

export function verbrauch(state: AppState): Verbrauch {
  const gesamt = laenge(state);
  const belege = state.receipts.reduce((summe, r) => summe + laenge(r.image), 0);
  const bild = laenge(state.settings.personalPhoto);
  const papierkorb = laenge(state.trash);

  const posten: Posten[] = [
    {
      name: `Belegbilder (${state.receipts.length})`,
      bytes: belege,
      hinweis:
        'Ein Beleg wiegt bis zu einem halben Megabyte. Einzeln gelöscht wandert er in den Papierkorb und belegt dort weiter Platz.',
    },
    {
      name: 'Papierkorb',
      bytes: papierkorb,
      hinweis:
        'Gelöschtes liegt hier vollständig weiter – bei Belegen samt Bild. Leeren gibt den Platz sofort frei.',
    },
    { name: 'Persönliches Bild', bytes: bild },
    {
      name: 'Termine, Aufgaben, Listen',
      bytes: Math.max(0, gesamt - belege - bild - papierkorb),
      hinweis: 'Text wiegt fast nichts. Hier liegt der Platz praktisch nie.',
    },
  ];

  return {
    gesamt,
    posten: posten.filter((p) => p.bytes > 0).sort((a, b) => b.bytes - a.bytes),
  };
}
