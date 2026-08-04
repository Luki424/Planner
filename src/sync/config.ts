/**
 * Firebase-Zugangsdaten.
 *
 * Diese Werte sind keine Geheimnisse: Firebase identifiziert damit nur das
 * Projekt. Der Schutz der Daten kommt ausschließlich aus den Sicherheitsregeln
 * (siehe firestore.rules) und der Anmeldung. Deshalb dürfen sie beim Bauen
 * eingebettet oder von Hand eingetragen werden.
 */

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

const STORAGE_KEY = 'planner:firebase';

const REQUIRED: Array<keyof FirebaseConfig> = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function isCompleteConfig(value: Partial<FirebaseConfig> | null): value is FirebaseConfig {
  return Boolean(value) && REQUIRED.every((key) => typeof value?.[key] === 'string' && value[key]);
}

function fromEnvironment(): FirebaseConfig | null {
  const env = import.meta.env;
  const candidate: Partial<FirebaseConfig> = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
  return isCompleteConfig(candidate) ? candidate : null;
}

function fromStorage(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirebaseConfig>;
    return isCompleteConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Beim Bauen eingebettete Werte haben Vorrang; sonst das, was eingetragen wurde. */
export function readConfig(): FirebaseConfig | null {
  return fromEnvironment() ?? fromStorage();
}

/** Wurden die Werte fest eingebaut? Dann sind sie in den Einstellungen nur lesbar. */
export function configIsBuiltIn(): boolean {
  return fromEnvironment() !== null;
}

export function saveConfig(config: FirebaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearStoredConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Liest eine eingefügte Firebase-Konfiguration aus Text – JSON oder JS-Objekt. */
export function parseConfigText(text: string): FirebaseConfig | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Meist wird der Block "const firebaseConfig = { ... };" aus der Konsole kopiert.
  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart === -1 || braceEnd <= braceStart) return null;
  const body = trimmed.slice(braceStart, braceEnd + 1);

  try {
    return normalize(JSON.parse(body) as Partial<FirebaseConfig>);
  } catch {
    // Kein striktes JSON: Schlüssel/Wert-Paare einzeln herausziehen.
    const result: Record<string, string> = {};
    const pattern = /(["']?)([A-Za-z]+)\1\s*:\s*(["'])(.*?)\3/g;
    let match = pattern.exec(body);
    while (match) {
      result[match[2]] = match[4];
      match = pattern.exec(body);
    }
    return normalize(result as Partial<FirebaseConfig>);
  }
}

function normalize(value: Partial<FirebaseConfig>): FirebaseConfig | null {
  return isCompleteConfig(value) ? value : null;
}
