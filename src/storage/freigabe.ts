/**
 * Die Standortfreigabe – **nur auf diesem Gerät**.
 *
 * Sie liegt bewusst nicht im abgeglichenen Zustand. Läge sie dort, könnte
 * einer sie für den anderen einschalten, und aus einer Verabredung würde
 * eine Überwachung. Der Preis ist, dass jeder sie auf seinem Gerät selbst
 * setzt – das ist die richtige Seite des Handels.
 *
 * Standardmäßig aus. Eine Ortung, in die man hineinrutscht, ist keine
 * Einwilligung.
 */

const TEILEN = 'planner:standort-teilen';

const hoerer = new Set<() => void>();

function melden() {
  for (const h of hoerer) h();
}

export function beiFreigabewechsel(h: () => void): () => void {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

export function ladeFreigabe(): boolean {
  try {
    return localStorage.getItem(TEILEN) === 'an';
  } catch {
    return false;
  }
}

export function speichereFreigabe(an: boolean) {
  try {
    localStorage.setItem(TEILEN, an ? 'an' : 'aus');
  } catch {
    // Ohne Speicher gilt die Wahl für diese Sitzung.
  }
  melden();
}

const ICH = 'planner:ich-bin';

/**
 * Welche Person im Haushalt dieses Gerät ist.
 *
 * Geraten wird das nicht. Der Anmeldename und der Name in der
 * Personenliste müssen nicht übereinstimmen, und beim Standort wäre ein
 * Fehlgriff besonders unangenehm: Man meldete den eigenen Ort unter dem
 * Namen des anderen und merkte es nicht.
 */
export function ladeIchBin(): string | null {
  try {
    return localStorage.getItem(ICH) || null;
  } catch {
    return null;
  }
}

export function speichereIchBin(memberId: string | null) {
  try {
    if (memberId) localStorage.setItem(ICH, memberId);
    else localStorage.removeItem(ICH);
  } catch {
    // Ohne Speicher gilt die Wahl für diese Sitzung.
  }
  melden();
}
