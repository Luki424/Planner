/**
 * Dauerhafter Speicher.
 *
 * IndexedDB und localStorage sind für den Browser standardmäßig „best effort":
 * Wird der Platz auf dem Gerät knapp, darf er die Ablage einer Seite räumen –
 * ohne Rückfrage, ohne Hinweis. Für eine Seite, die man einmal besucht hat, ist
 * das richtig. Für einen Planer, in dem der Haushalt seine Termine führt, ist es
 * ein stiller Datenverlust.
 *
 * Genau das ist hier zweimal passiert: Anmeldung weg, Firebase-Verbindung weg,
 * alle gerätelokalen Einstellungen weg – ohne dass die App etwas gelöscht hätte.
 *
 * `navigator.storage.persist()` hebt die Ablage in den dauerhaften Zustand. Der
 * Browser entscheidet darüber selbst: Chrome gewährt es einer installierten App
 * meist stillschweigend, Firefox fragt nach, Safari kennt es gar nicht. Bitten
 * kostet nichts – nicht zu bitten kostet im schlechten Fall alles.
 */

export type Speicherlage = {
  /** Kennt der Browser die Frage überhaupt? */
  bekannt: boolean;
  /** Ist die Ablage dauerhaft, darf sie also nicht einfach geräumt werden? */
  dauerhaft: boolean;
};

export async function speicherlage(): Promise<Speicherlage> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return { bekannt: false, dauerhaft: false };
  }
  try {
    return { bekannt: true, dauerhaft: await navigator.storage.persisted() };
  } catch {
    return { bekannt: false, dauerhaft: false };
  }
}

/**
 * Bittet um dauerhaften Speicher.
 *
 * Antwortet mit dem Zustand *danach* – ein „nein" ist keine Störung, sondern
 * die Entscheidung des Browsers. Deshalb wird hier nichts geworfen.
 */
export async function bitteUmDauerhaft(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Wie viel liegt abgelegt, und wie viel dürfte es sein? Für die Anzeige. */
export async function speicherplatz(): Promise<{ benutzt: number; erlaubt: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage !== 'number' || typeof quota !== 'number') return null;
    return { benutzt: usage, erlaubt: quota };
  } catch {
    return null;
  }
}

/** „6,0 MB von 2,1 GB" – in Worten, die man auf einem Handy lesen kann. */
export function platzText(benutzt: number, erlaubt: number): string {
  const gr = (bytes: number) => {
    if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1).replace('.', ',')} GB`;
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB`;
    return `${Math.max(1, Math.round(bytes / 1000))} kB`;
  };
  return `${gr(benutzt)} von ${gr(erlaubt)}`;
}
