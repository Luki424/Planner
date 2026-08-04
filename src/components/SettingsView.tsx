import { useRef, useState } from 'react';
import { formatTime, parseTime } from '../domain/dates';
import type { AppState } from '../domain/types';
import {
  addContext,
  deleteContext,
  replaceState,
  resetState,
  updateContext,
  updateSettings,
} from '../storage/store';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export function SettingsView({ state }: { state: AppState }) {
  const [newContext, setNewContext] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppState;
      if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.contexts)) {
        throw new Error('Unerwartetes Format');
      }
      replaceState(parsed);
      setMessage('Daten importiert.');
    } catch (error) {
      setMessage(`Import fehlgeschlagen: ${(error as Error).message}`);
    }
  };

  const setTime = (key: 'dayStartMin' | 'dayEndMin', value: string) => {
    const min = parseTime(value);
    if (min !== null) updateSettings({ [key]: min });
  };

  return (
    <section className="panel wide">
      <header className="panel-head">
        <h2>Einstellungen</h2>
      </header>

      <div className="settings-group">
        <h3>Bereiche</h3>
        <ul className="context-list">
          {state.contexts.map((context) => (
            <li key={context.id} className="context-row">
              <input
                type="color"
                value={context.color}
                onChange={(e) => updateContext(context.id, { color: e.target.value })}
                aria-label={`Farbe für ${context.name}`}
              />
              <input
                value={context.name}
                onChange={(e) => updateContext(context.id, { name: e.target.value })}
                aria-label="Name des Bereichs"
              />
              <button
                className="btn tiny danger ghost"
                disabled={state.contexts.length <= 1}
                title={
                  state.contexts.length <= 1
                    ? 'Mindestens ein Bereich muss bleiben'
                    : 'Bereich löschen, Inhalte wandern in den ersten verbleibenden Bereich'
                }
                onClick={() => deleteContext(context.id)}
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newContext.trim()) return;
            addContext(newContext, PALETTE[state.contexts.length % PALETTE.length]);
            setNewContext('');
          }}
        >
          <input
            value={newContext}
            onChange={(e) => setNewContext(e.target.value)}
            placeholder="Neuer Bereich, z.B. Familie"
          />
          <button className="btn" type="submit" disabled={!newContext.trim()}>
            Hinzufügen
          </button>
        </form>
      </div>

      <div className="settings-group">
        <h3>Tag</h3>
        <div className="field-row">
          <label className="field">
            <span>Tag beginnt</span>
            <input
              defaultValue={formatTime(state.settings.dayStartMin)}
              onBlur={(e) => setTime('dayStartMin', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Tag endet</span>
            <input
              defaultValue={formatTime(state.settings.dayEndMin)}
              onBlur={(e) => setTime('dayEndMin', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Raster</span>
            <select
              value={state.settings.slotMin}
              onChange={(e) => updateSettings({ slotMin: Number(e.target.value) })}
            >
              {[5, 10, 15, 30].map((s) => (
                <option key={s} value={s}>
                  {s} min
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Kapazität pro Tag</span>
            <select
              value={state.settings.capacityMin}
              onChange={(e) => updateSettings({ capacityMin: Number(e.target.value) })}
            >
              {[240, 300, 360, 420, 480, 540, 600].map((m) => (
                <option key={m} value={m}>
                  {m / 60} h
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="hint">
          Die Kapazität ist die Referenz für die Auslastungsanzeige – also die Zeit, die du
          realistisch für geplante Aufgaben hast, nicht die Länge deines Tages.
        </p>
      </div>

      <div className="settings-group">
        <h3>Daten</h3>
        <p className="hint">
          Alles liegt lokal in diesem Browser (IndexedDB). Nichts wird hochgeladen. Für ein Backup
          oder den Wechsel auf ein anderes Gerät nutze Export und Import.
        </p>
        <div className="button-row">
          <button className="btn" onClick={exportJson}>
            Exportieren
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importieren
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = '';
            }}
          />
          <span className="spacer" />
          <button
            className="btn danger ghost"
            onClick={() => {
              if (confirm('Wirklich alle Daten löschen? Das lässt sich nicht rückgängig machen.')) {
                resetState();
                setMessage('Alle Daten gelöscht.');
              }
            }}
          >
            Alles zurücksetzen
          </button>
        </div>
        {message && <p className="hint">{message}</p>}
      </div>
    </section>
  );
}
