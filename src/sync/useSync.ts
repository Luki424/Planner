import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentSingleTabManager,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { SYNCED_COLLECTIONS, type AppState, type SyncedCollection } from '../domain/types';
import {
  applyRemoteCollection,
  applyRemoteSettings,
  getState,
  subscribeToStore,
} from '../storage/store';
import {
  clearStoredConfig,
  configIsBuiltIn,
  isCompleteConfig,
  readConfig,
  saveConfig,
  type FirebaseConfig,
} from './config';

export type SyncStatus =
  | 'unconfigured'
  | 'signed-out'
  | 'connecting'
  | 'no-household'
  | 'live'
  | 'error';

export type SyncApi = {
  status: SyncStatus;
  message: string | null;
  busy: boolean;
  email: string | null;
  displayName: string | null;
  householdId: string | null;
  members: number;
  configured: boolean;
  configLocked: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  createHousehold: () => Promise<void>;
  joinHousehold: (code: string) => Promise<void>;
  applyConfig: (config: FirebaseConfig) => void;
  removeConfig: () => void;
};

type Connection = { app: FirebaseApp; auth: Auth; db: Firestore };

let connection: Connection | null = null;

/** Baut die Verbindung genau einmal auf – Firebase verträgt keine Doppelinitialisierung. */
function connect(config: FirebaseConfig): Connection {
  if (connection) return connection;
  const app = initializeApp(config);
  const emulator = import.meta.env.VITE_FIREBASE_EMULATOR;

  const db = emulator
    ? initializeFirestore(app, { ignoreUndefinedProperties: true })
    : initializeFirestore(app, {
        // Offline-Puffer: unterwegs im Laden ist das Netz oft weg.
        localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
        /*
         * Ein nicht gesetztes optionales Feld ist kein Fehler, sondern der
         * Normalfall – ohne diese Zeile wirft Firestore beim Schreiben und
         * der Abgleich bliebe ganz stehen. Ein Gerät mit älterem Stand kennt
         * neue Felder eben noch nicht.
         */
        ignoreUndefinedProperties: true,
      });
  /*
   * initializeAuth statt getAuth: getAuth bringt den Popup-/Redirect-Weg für
   * fremde Anbieter mit und lädt dafür ein Skript von apis.google.com nach.
   * Hier wird nur mit E-Mail und Passwort angemeldet – die Anfrage an Google
   * wäre reine Nebenwirkung und schlägt in abgeschotteten Netzen fehl.
   */
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });

  if (emulator) {
    // Entwicklung gegen die lokalen Emulatoren statt gegen echte Projektdaten.
    connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulator, 8080);
  }

  connection = { app, auth, db };
  return connection;
}

function errorText(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'Diese E-Mail-Adresse sieht nicht richtig aus.',
    'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
    'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
    'auth/user-not-found': 'Zu dieser E-Mail gibt es noch kein Konto.',
    'auth/email-already-in-use': 'Für diese E-Mail gibt es schon ein Konto – melde dich an.',
    'auth/weak-password': 'Das Passwort braucht mindestens 6 Zeichen.',
    'auth/network-request-failed': 'Keine Verbindung zu Firebase.',
    'auth/operation-not-allowed':
      'Anmeldung per E-Mail ist im Firebase-Projekt noch nicht aktiviert.',
    'permission-denied': 'Die Sicherheitsregeln erlauben diesen Zugriff nicht.',
    'failed-precondition': 'Firestore ist im Projekt noch nicht angelegt.',
  };
  if (map[code]) return map[code];
  const message = (error as { message?: string })?.message;
  return message ? `${message}` : 'Unbekannter Fehler.';
}

/** Kurzer, gut vorlesbarer Code – wird zugleich zur Kennung des Haushalts. */
function newHouseholdCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const random = crypto.getRandomValues(new Uint8Array(10));
  for (const byte of random) code += alphabet[byte % alphabet.length];
  return code;
}

export function useSync(ready: boolean): SyncApi {
  // Die Konfiguration wird beim Start einmal gelesen; ein Wechsel lädt die
  // Seite neu, weil Firebase sich nicht sauber neu initialisieren lässt.
  const [config] = useState<FirebaseConfig | null>(() => readConfig());
  const [status, setStatus] = useState<SyncStatus>(() =>
    readConfig() ? 'connecting' : 'unconfigured',
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState(0);

  /** Zustand, von dem bekannt ist, dass er dem Server entspricht. */
  const baselineRef = useRef<AppState | null>(null);
  const pushingRef = useRef(false);
  /** Während eines Schreibvorgangs eingetroffene Änderung, noch nachzuholen. */
  const pendingRef = useRef(false);

  /* --------------------------------------------------------- Anmeldung */

  useEffect(() => {
    if (!config) {
      setStatus('unconfigured');
      return;
    }
    let cancelled = false;
    try {
      const { auth } = connect(config);
      const unsubscribe = onAuthStateChanged(auth, (next) => {
        if (cancelled) return;
        setUser(next);
        setStatus(next ? 'connecting' : 'signed-out');
      });
      return () => {
        cancelled = true;
        unsubscribe();
      };
    } catch (error) {
      setStatus('error');
      setMessage(errorText(error));
      return;
    }
  }, [config]);

  /* ---------------------------------------------------------- Haushalt */

  useEffect(() => {
    if (!config || !user) {
      setHouseholdId(null);
      return;
    }
    const { db } = connect(config);
    const profile = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      profile,
      (snapshot) => {
        const id = (snapshot.data()?.householdId as string | undefined) ?? null;
        setHouseholdId(id);
        setStatus(id ? 'connecting' : 'no-household');
      },
      (error) => {
        setStatus('error');
        setMessage(errorText(error));
      },
    );
    return unsubscribe;
  }, [config, user]);

  useEffect(() => {
    if (!config || !householdId) {
      setMembers(0);
      return;
    }
    const { db } = connect(config);
    const unsubscribe = onSnapshot(doc(db, 'households', householdId), (snapshot) => {
      const list = (snapshot.data()?.members as string[] | undefined) ?? [];
      setMembers(list.length);
    });
    return unsubscribe;
  }, [config, householdId]);

  /* ------------------------------------------------- Daten herunterladen */

  useEffect(() => {
    if (!ready || !config || !user || !householdId) return;
    const { db } = connect(config);
    const seen = new Set<string>();

    const unsubscribers = SYNCED_COLLECTIONS.map((name) =>
      onSnapshot(
        collection(db, 'households', householdId, name),
        (snapshot) => {
          const remote = snapshot.docs.map((entry) => entry.data() as { id: string });
          const local = getState()[name] as Array<{ id: string }>;

          // Erste Antwort und noch nichts auf dem Server: den vorhandenen
          // lokalen Stand hochladen statt ihn mit Leere zu überschreiben.
          if (!seen.has(name)) {
            seen.add(name);
            if (remote.length === 0 && local.length > 0) {
              void pushCollection(db, householdId, name, local);
              setStatus('live');
              return;
            }
          }

          applyRemoteCollection(name, remote);
          baselineRef.current = getState();
          setStatus('live');
        },
        (error) => {
          setStatus('error');
          setMessage(errorText(error));
        },
      ),
    );

    const settingsRef = doc(db, 'households', householdId, 'meta', 'settings');
    let sawSettings = false;
    unsubscribers.push(
      onSnapshot(settingsRef, (snapshot) => {
        if (!snapshot.exists()) {
          if (!sawSettings) {
            sawSettings = true;
            void setDoc(settingsRef, getState().settings);
          }
          return;
        }
        sawSettings = true;
        applyRemoteSettings(snapshot.data() as AppState['settings']);
        baselineRef.current = getState();
      }),
    );

    baselineRef.current = getState();
    return () => unsubscribers.forEach((stop) => stop());
  }, [ready, config, user, householdId]);

  /* --------------------------------------------------- Daten hochladen */

  useEffect(() => {
    if (!ready || !config || !user || !householdId) return;
    const { db } = connect(config);
    let cancelled = false;

    /*
     * Immer nur ein Schreibvorgang gleichzeitig – sonst überholen sich die
     * Aufrufe. Was währenddessen passiert, wird gemerkt und danach
     * nachgeholt: einfach zu verwerfen hieße, eine Änderung zu verlieren,
     * die auf dem Bildschirm längst steht.
     */
    const pump = () => {
      if (cancelled) return;
      if (pushingRef.current) {
        pendingRef.current = true;
        return;
      }
      const baseline = baselineRef.current;
      const current = getState();
      if (!baseline || baseline === current) return;

      pushingRef.current = true;
      baselineRef.current = current;
      void pushChanges(db, householdId, baseline, current)
        .catch((error) => {
          setStatus('error');
          setMessage(errorText(error));
        })
        .finally(() => {
          pushingRef.current = false;
          if (pendingRef.current) {
            pendingRef.current = false;
            pump();
          }
        });
    };

    const unsubscribe = subscribeToStore(pump);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ready, config, user, householdId]);

  /* ------------------------------------------------------------ Aktionen */

  const guarded = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }, []);

  const signIn = useCallback(
    (email: string, password: string) =>
      guarded(async () => {
        if (!config) throw new Error('Firebase ist noch nicht eingerichtet.');
        await signInWithEmailAndPassword(connect(config).auth, email.trim(), password);
      }),
    [config, guarded],
  );

  const signUp = useCallback(
    (email: string, password: string, name: string) =>
      guarded(async () => {
        if (!config) throw new Error('Firebase ist noch nicht eingerichtet.');
        const { auth } = connect(config);
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
      }),
    [config, guarded],
  );

  const signOutNow = useCallback(
    () =>
      guarded(async () => {
        if (!config) return;
        await firebaseSignOut(connect(config).auth);
        baselineRef.current = null;
      }),
    [config, guarded],
  );

  const createHousehold = useCallback(
    () =>
      guarded(async () => {
        if (!config || !user) throw new Error('Bitte zuerst anmelden.');
        const { db } = connect(config);
        const code = newHouseholdCode();
        await setDoc(doc(db, 'households', code), {
          members: [user.uid],
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'users', user.uid), {
          householdId: code,
          displayName: user.displayName ?? user.email ?? '',
        });
      }),
    [config, guarded, user],
  );

  const joinHousehold = useCallback(
    (code: string) =>
      guarded(async () => {
        if (!config || !user) throw new Error('Bitte zuerst anmelden.');
        const { db } = connect(config);
        const id = code.trim().toUpperCase();
        const household = await getDoc(doc(db, 'households', id));
        if (!household.exists()) throw new Error('Diesen Haushalts-Code gibt es nicht.');
        await updateDoc(doc(db, 'households', id), { members: arrayUnion(user.uid) });
        await setDoc(doc(db, 'users', user.uid), {
          householdId: id,
          displayName: user.displayName ?? user.email ?? '',
        });
      }),
    [config, guarded, user],
  );

  const applyConfig = useCallback((next: FirebaseConfig) => {
    if (!isCompleteConfig(next)) return;
    saveConfig(next);
    // Firebase lässt sich nicht sauber neu initialisieren – ein Neuladen ist
    // der ehrlichere Weg als ein halb verbundener Zustand.
    window.location.reload();
  }, []);

  const removeConfig = useCallback(() => {
    clearStoredConfig();
    window.location.reload();
  }, []);

  return useMemo(
    () => ({
      status,
      message,
      busy,
      email: user?.email ?? null,
      displayName: user?.displayName ?? user?.email?.split('@')[0] ?? null,
      householdId,
      members,
      configured: config !== null,
      configLocked: configIsBuiltIn(),
      signIn,
      signUp,
      signOut: signOutNow,
      createHousehold,
      joinHousehold,
      applyConfig,
      removeConfig,
    }),
    [
      status,
      message,
      busy,
      user,
      householdId,
      members,
      config,
      signIn,
      signUp,
      signOutNow,
      createHousehold,
      joinHousehold,
      applyConfig,
      removeConfig,
    ],
  );
}

/* ------------------------------------------------------------- Schreiben */

async function pushCollection(
  db: Firestore,
  householdId: string,
  name: SyncedCollection,
  entities: Array<{ id: string }>,
) {
  const batch = writeBatch(db);
  for (const entity of entities) {
    batch.set(doc(db, 'households', householdId, name, entity.id), entity);
  }
  await batch.commit();
}

/** Vergleicht zwei Zustände und schreibt nur, was sich geändert hat. */
async function pushChanges(
  db: Firestore,
  householdId: string,
  baseline: AppState,
  current: AppState,
) {
  const tasks: Array<Promise<unknown>> = [];

  for (const name of SYNCED_COLLECTIONS) {
    const before = baseline[name] as Array<{ id: string }>;
    const after = current[name] as Array<{ id: string }>;
    if (before === after) continue;

    const beforeById = new Map(before.map((entity) => [entity.id, entity]));
    const afterIds = new Set(after.map((entity) => entity.id));

    for (const entity of after) {
      // Objektgleichheit genügt: der Store ersetzt geänderte Einträge.
      if (beforeById.get(entity.id) === entity) continue;
      tasks.push(setDoc(doc(db, 'households', householdId, name, entity.id), entity));
    }
    for (const entity of before) {
      if (!afterIds.has(entity.id)) {
        tasks.push(deleteDoc(doc(db, 'households', householdId, name, entity.id)));
      }
    }
  }

  if (baseline.settings !== current.settings) {
    tasks.push(setDoc(doc(db, 'households', householdId, 'meta', 'settings'), current.settings));
  }

  await Promise.all(tasks);
}
