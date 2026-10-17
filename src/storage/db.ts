/**
 * Persistenz für den App-Zustand.
 *
 * Bevorzugt IndexedDB: der gesamte Zustand liegt als ein einziger Eintrag in
 * einem Object Store – für die Datenmengen eines persönlichen Planers völlig
 * ausreichend und deutlich einfacher als ein Schema mit mehreren Stores.
 *
 * IndexedDB ist aber nicht überall verfügbar: in eingebetteten Frames, im
 * privaten Modus mancher Browser oder bei restriktiven Datenschutz-Einstellungen
 * schlägt schon das Öffnen fehl. Deshalb fällt die Schicht der Reihe nach auf
 * localStorage und zuletzt auf reinen Arbeitsspeicher zurück. Der Planer läuft
 * dann weiter – nur überlebt der Stand im letzten Fall das Schließen des Tabs nicht.
 */

const DB_NAME = 'planner';
const DB_VERSION = 1;
const STORE = 'state';
const KEY = 'app';
const LOCAL_KEY = 'planner:state';
/*
 * Notspur für den Moment des Ausblendens.
 *
 * IndexedDB schreibt asynchron; wird der Tab unmittelbar danach geschlossen
 * oder weggewischt, bricht die Transaktion ab und die letzte Änderung ist weg.
 * localStorage schreibt synchron und ist damit vor dem Abbau der Seite fertig.
 * Der Spiegel wird nach jedem erfolgreichen regulären Schreibvorgang gelöscht –
 * existiert er beim Start, ist er zwangsläufig der jüngere Stand.
 */
const MIRROR_KEY = 'planner:mirror';

type Backend = 'indexeddb' | 'localstorage' | 'memory';

let backend: Backend | null = null;
let memoryValue: unknown = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Ob der letzte Schreibversuch angekommen ist – und wenn nicht, woran es lag.
 *
 * Der Anlass: „Zu wenig Speicher für vorherige Operation." Die Meldung kam
 * vom Browser, während ein Kalender eingelesen wurde. Was die App daraus
 * machte, war nichts: Der Schreibvorgang scheiterte, die Schicht fiel still
 * auf den Arbeitsspeicher zurück, und von da an war jede Eingabe nur noch
 * bis zum nächsten Neustart da – ohne dass irgendwo etwas gestanden hätte.
 *
 * Das ist genau der Fehler, den es hier schon einmal gab, nur eine Etage
 * tiefer: **Ein Speichern, das stumm scheitert, ist schlimmer als eines, das
 * stört.** Man trägt weiter ein und merkt es erst, wenn alles weg ist.
 */
export type Ablagelage = {
  /** Wohin gerade geschrieben wird; `null`, solange nichts entschieden ist. */
  art: Backend | null;
  /**
   * Die Meldung des Browsers, wenn der Stand *nirgends* dauerhaft liegt.
   * `null` heißt: der letzte Schreibvorgang ist angekommen.
   */
  gescheitert: string | null;
};

let lage: Ablagelage = { art: null, gescheitert: null };
const lauscher = new Set<() => void>();

function melde(aenderung: Partial<Ablagelage>): void {
  const neu = { ...lage, ...aenderung };
  if (neu.art === lage.art && neu.gescheitert === lage.gescheitert) return;
  lage = neu;
  for (const fn of lauscher) fn();
}

/** Für `useSyncExternalStore`. */
export function beiAblagewechsel(fn: () => void): () => void {
  lauscher.add(fn);
  return () => lauscher.delete(fn);
}

export function ablagelage(): Ablagelage {
  return lage;
}

/** Was der Browser gesagt hat, in einem Stück Text. */
function grund(fehler: unknown): string {
  if (fehler instanceof Error) return fehler.message || fehler.name;
  if (typeof fehler === 'string') return fehler;
  return 'Der Browser hat das Speichern abgelehnt, ohne einen Grund zu nennen.';
}

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB nicht verfügbar'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB blockiert'));
    });
  }
  return dbPromise;
}

function localStorageAvailable(): boolean {
  try {
    const probe = '__planner_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Ermittelt einmalig, welcher Speicher tatsächlich benutzbar ist. */
async function resolveBackend(): Promise<Backend> {
  if (backend) return backend;
  try {
    await openDB();
    backend = 'indexeddb';
  } catch {
    dbPromise = null;
    backend = localStorageAvailable() ? 'localstorage' : 'memory';
  }
  melde({ art: backend });
  return backend;
}

/** Welche Ablage wird gerade verwendet? Für den Hinweis in den Einstellungen. */
export function storageBackend(): Backend | null {
  return backend;
}

/** Synchroner Spiegel für den Moment des Ausblendens. */
export function saveStateSync(state: unknown): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(state));
  } catch {
    // Kein Speicherplatz oder gesperrt – dann bleibt es beim regulären Weg.
  }
}

function readMirror<T>(): T | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function clearMirror(): void {
  try {
    localStorage.removeItem(MIRROR_KEY);
  } catch {
    // Nicht schlimm: beim nächsten Start gewinnt ohnehin der jüngere Stand.
  }
}

export async function loadState<T>(): Promise<T | null> {
  const kind = await resolveBackend();

  // Ein vorhandener Spiegel stammt aus einem abgebrochenen Schreibvorgang und
  // ist damit neuer als alles, was regulär abgelegt wurde.
  const mirror = readMirror<T>();
  if (mirror) return mirror;

  if (kind === 'indexeddb') {
    try {
      const db = await openDB();
      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(KEY);
        request.onsuccess = () => resolve((request.result as T) ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Lesefehler soll den Start nicht verhindern – lieber leer beginnen.
      return null;
    }
  }

  if (kind === 'localstorage') {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  return (memoryValue as T) ?? null;
}

export async function saveState(state: unknown): Promise<void> {
  const kind = await resolveBackend();
  let letzterGrund: string | null = null;

  if (kind === 'indexeddb') {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(state, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        // Bei knappem Platz bricht die Transaktion ab, ohne `onerror` zu
        // melden. Ohne diesen Zweig bliebe das Versprechen offen und der
        // Fehlschlag unbemerkt – der schlechteste aller Fälle.
        tx.onabort = () => reject(tx.error);
      });
      clearMirror();
      melde({ art: 'indexeddb', gescheitert: null });
      return;
    } catch (fehler) {
      /*
       * Bewusst *kein* dauerhafter Wechsel auf localStorage.
       *
       * Vorher stufte ein fehlgeschlagener Schreibvorgang die Ablage für den
       * Rest der Sitzung herab – erst auf localStorage, dann auf den
       * Arbeitsspeicher. Beim häufigsten Grund ist das genau falsch: Ist der
       * Platz knapp, hilft localStorage nicht, denn es fasst ein Vielfaches
       * weniger als IndexedDB. Die Herabstufung machte aus einem
       * vorübergehenden Engpass einen endgültigen Verlust, und zwar stumm.
       *
       * Deshalb bleibt IndexedDB die Ablage. Wird Platz frei, kommt der
       * nächste Schreibvorgang von selbst wieder an und die Warnung
       * verschwindet ohne Neuladen.
       */
      letzterGrund = grund(fehler);
    }
  }

  if (backend === 'localstorage') {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      clearMirror();
      melde({ art: 'localstorage', gescheitert: null });
      return;
    } catch (fehler) {
      letzterGrund = grund(fehler);
    }
  }

  /*
   * Jetzt liegt der Stand nur noch im Arbeitsspeicher. Das ist keine Ablage,
   * sondern die Zeit bis zum nächsten Neuladen – und genau das muss gesagt
   * werden.
   */
  memoryValue = state;
  if (kind === 'memory' && letzterGrund === null) {
    // Dieser Browser erlaubt von Anfang an keinen dauerhaften Speicher.
    // Dafür steht ein eigener Hinweis in den Einstellungen; eine zweite
    // Warnung über dasselbe wäre nur Lärm.
    melde({ art: 'memory', gescheitert: null });
    return;
  }
  melde({ art: backend, gescheitert: letzterGrund ?? 'Der Browser hat das Speichern abgelehnt.' });
}
