import { useState } from 'react';
import { parseConfigText } from '../sync/config';
import type { SyncApi } from '../sync/useSync';

/**
 * Einrichtung und Verwaltung der geteilten Ablage.
 * Führt in der Reihenfolge durch, in der die Schritte nötig sind:
 * Projekt verbinden → anmelden → Haushalt anlegen oder beitreten.
 */
export function SyncSettings({ sync }: { sync: SyncApi }) {
  return (
    <div className="settings-group">
      <h3>Gemeinsam nutzen</h3>

      {!sync.configured && <ConfigForm sync={sync} />}
      {sync.configured && sync.status === 'signed-out' && <AuthForm sync={sync} />}
      {sync.configured && sync.status === 'no-household' && <HouseholdForm sync={sync} />}
      {sync.configured && (sync.status === 'live' || sync.status === 'connecting') && (
        <ConnectedPanel sync={sync} />
      )}
      {sync.status === 'error' && (
        <>
          <p className="hint warn">{sync.message}</p>
          <div className="button-row">
            <button className="btn ghost" onClick={() => sync.signOut()}>
              Abmelden
            </button>
            {!sync.configLocked && (
              <button className="btn danger ghost" onClick={sync.removeConfig}>
                Verbindung zurücksetzen
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ConfigForm({ sync }: { sync: SyncApi }) {
  const [text, setText] = useState('');
  const parsed = parseConfigText(text);
  const touched = text.trim().length > 0;

  return (
    <>
      <p className="hint">
        Für die gemeinsame Nutzung braucht es ein kostenloses Firebase-Projekt. Die Schritte stehen
        in der Datei <code>FIREBASE.md</code> im Projekt. Am Ende kopierst du dort den Block
        <code>firebaseConfig</code> und fügst ihn hier ein.
      </p>
      <label className="field">
        <span>Firebase-Konfiguration einfügen</span>
        <textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            'const firebaseConfig = {\n  apiKey: "…",\n  authDomain: "…",\n  projectId: "…",\n  appId: "…"\n};'
          }
        />
      </label>
      {touched && !parsed && (
        <p className="hint warn">
          Darin fehlen Angaben. Gebraucht werden apiKey, authDomain, projectId und appId.
        </p>
      )}
      {parsed && <p className="hint">Erkannt: Projekt {parsed.projectId}</p>}
      <div className="button-row">
        <button
          className="btn primary"
          disabled={!parsed}
          onClick={() => parsed && sync.applyConfig(parsed)}
        >
          Verbinden
        </button>
      </div>
    </>
  );
}

function AuthForm({ sync }: { sync: SyncApi }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const valid = email.includes('@') && password.length >= 6 && (mode === 'in' || name.trim());

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        if (mode === 'in') void sync.signIn(email, password);
        else void sync.signUp(email, password, name);
      }}
    >
      <div className="segmented inline">
        <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>
          Anmelden
        </button>
        <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>
          Konto anlegen
        </button>
      </div>

      {mode === 'up' && (
        <label className="field">
          <span>Anzeigename</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wie du auf der Einkaufsliste erscheinst"
          />
        </label>
      )}
      <label className="field">
        <span>E-Mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
      </label>
      <label className="field">
        <span>Passwort</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        />
      </label>
      {sync.message && <p className="hint warn">{sync.message}</p>}
      <div className="button-row">
        <button className="btn primary" type="submit" disabled={!valid || sync.busy}>
          {sync.busy ? '…' : mode === 'in' ? 'Anmelden' : 'Konto anlegen'}
        </button>
        {!sync.configLocked && (
          <>
            <span className="spacer" />
            <button className="btn danger ghost tiny" type="button" onClick={sync.removeConfig}>
              Anderes Projekt
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function HouseholdForm({ sync }: { sync: SyncApi }) {
  const [code, setCode] = useState('');

  return (
    <>
      <p className="hint">
        Angemeldet als {sync.email}. Jetzt fehlt noch der gemeinsame Haushalt: Eine Person legt ihn
        an und gibt den Code weiter, die andere tritt damit bei.
      </p>
      <div className="button-row">
        <button
          className="btn primary"
          onClick={() => void sync.createHousehold()}
          disabled={sync.busy}
        >
          Haushalt anlegen
        </button>
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          void sync.joinHousehold(code);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="oder Code eingeben"
          aria-label="Haushalts-Code"
        />
        <button className="btn" type="submit" disabled={!code.trim() || sync.busy}>
          Beitreten
        </button>
      </form>
      {sync.message && <p className="hint warn">{sync.message}</p>}
      <div className="button-row">
        <button className="btn ghost tiny" onClick={() => void sync.signOut()}>
          Abmelden
        </button>
      </div>
    </>
  );
}

function ConnectedPanel({ sync }: { sync: SyncApi }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <>
      <p className="hint">
        Angemeldet als <b>{sync.email}</b>
        {sync.householdId && (
          <>
            {' '}
            · Haushalt mit {sync.members} {sync.members === 1 ? 'Person' : 'Personen'}
          </>
        )}
        . Änderungen erscheinen auf allen angemeldeten Geräten.
      </p>

      {sync.householdId && (
        <div className="code-row">
          <span className="muted small">Haushalts-Code zum Einladen:</span>
          {revealed ? (
            <code className="household-code">{sync.householdId}</code>
          ) : (
            <button className="btn tiny" onClick={() => setRevealed(true)}>
              Anzeigen
            </button>
          )}
          {revealed && (
            <button
              className="btn tiny ghost"
              onClick={() => void navigator.clipboard?.writeText(sync.householdId ?? '')}
            >
              Kopieren
            </button>
          )}
        </div>
      )}
      <p className="hint">
        Wer diesen Code kennt, kann dem Haushalt beitreten und alles sehen – gib ihn nur direkt
        weiter.
      </p>

      {sync.message && <p className="hint warn">{sync.message}</p>}
      <div className="button-row">
        <button className="btn ghost" onClick={() => void sync.signOut()}>
          Abmelden
        </button>
      </div>
    </>
  );
}
