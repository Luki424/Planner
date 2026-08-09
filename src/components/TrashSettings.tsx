import { useState } from 'react';
import { TRASH_DAYS, daysLeft, describeAge } from '../domain/trash';
import type { AppState } from '../domain/types';
import { deleteFromTrash, emptyTrash, restoreFromTrash } from '../storage/store';

/**
 * Der Papierkorb in den Einstellungen.
 *
 * Er steht bewusst nicht als eigener Reiter da: Man geht nicht in den
 * Papierkorb, man sucht ihn im Notfall. Sichtbar wird er nur, wenn etwas
 * drin liegt – eine leere Überschrift wäre nur eine Zeile mehr.
 */
export function TrashSettings({ state, today }: { state: AppState; today: string }) {
  const [alleWeg, setAlleWeg] = useState(false);

  if (state.trash.length === 0) return null;

  return (
    <div className="settings-group">
      <h3>Papierkorb ({state.trash.length})</h3>
      <p className="hint">
        Gelöschtes liegt {TRASH_DAYS} Tage hier und verschwindet dann von selbst. Zurückholen kann
        es jeder von euch beiden – der Papierkorb wird mit abgeglichen.
      </p>

      <ul className="trash-list">
        {state.trash.map((eintrag) => (
          <li key={eintrag.id} className="trash-row">
            <span className="trash-main">
              <span className="trash-label">{eintrag.label}</span>
              <span className="muted small">
                {describeAge(eintrag, today)}
                {eintrag.deletedBy && ` · ${eintrag.deletedBy}`} · noch {daysLeft(eintrag, today)}{' '}
                Tage
              </span>
            </span>
            <button className="btn tiny" onClick={() => restoreFromTrash(eintrag.id)}>
              Zurückholen
            </button>
            <button
              className="btn tiny danger ghost"
              onClick={() => deleteFromTrash(eintrag.id)}
              aria-label={`${eintrag.label} endgültig löschen`}
              title="Endgültig löschen"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {/*
        Das Leeren fragt nach. Es ist der einzige Griff hier, den der
        Papierkorb selbst nicht mehr auffangen kann.
      */}
      {alleWeg ? (
        <div className="button-row">
          <span className="hint warn">
            {state.trash.length} Einträge endgültig löschen? Das lässt sich nicht zurückholen.
          </span>
          <span className="spacer" />
          <button className="btn ghost tiny" onClick={() => setAlleWeg(false)}>
            Abbrechen
          </button>
          <button
            className="btn danger tiny"
            onClick={() => {
              emptyTrash();
              setAlleWeg(false);
            }}
          >
            Endgültig löschen
          </button>
        </div>
      ) : (
        <div className="button-row">
          <span className="spacer" />
          <button className="btn tiny danger ghost" onClick={() => setAlleWeg(true)}>
            Papierkorb leeren
          </button>
        </div>
      )}
    </div>
  );
}
