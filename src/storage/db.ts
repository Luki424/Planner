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

  if (kind === 'indexeddb') {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(state, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      clearMirror();
      return;
    } catch {
      // Ab hier auf localStorage weiterschreiben statt Daten zu verlieren.
      backend = localStorageAvailable() ? 'localstorage' : 'memory';
    }
  }

  if (backend === 'localstorage') {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      clearMirror();
      return;
    } catch {
      backend = 'memory';
    }
  }

  memoryValue = state;
}
