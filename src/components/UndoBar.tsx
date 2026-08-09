import { useEffect, useState } from 'react';
import { restoreFromTrash, useLastDeletion } from '../storage/store';
import type { AppState } from '../domain/types';

/** So lange steht der Streifen. Lang genug zum Lesen, kurz genug zum Ignorieren. */
const SICHTBAR_MS = 9000;

/**
 * „Gelöscht – Rückgängig", direkt nach dem Löschen.
 *
 * Der Papierkorb allein reicht nicht: Wer danebentippt, merkt es in der
 * Sekunde danach und soll es in derselben Sekunde beheben können, ohne erst
 * zu wissen, dass es einen Papierkorb gibt und wo er steht.
 *
 * Der Streifen erscheint nur auf dem Gerät, auf dem gelöscht wurde. Beim
 * anderen wäre er eine Meldung über etwas, das dort niemand getan hat.
 */
export function UndoBar({ state }: { state: AppState }) {
  const letzte = useLastDeletion();
  const [jetzt, setJetzt] = useState(() => Date.now());

  /*
   * Eine Uhr statt eines Timeouts: Ein Timeout müsste bei jedem neuen
   * Löschen zurückgesetzt werden, und beim Wiederherstellen abgeräumt. Die
   * Uhr läuft einfach, und der Streifen rechnet selbst aus, ob er noch dran
   * ist.
   */
  useEffect(() => {
    if (!letzte) return;
    const timer = setInterval(() => setJetzt(Date.now()), 500);
    setJetzt(Date.now());
    return () => clearInterval(timer);
  }, [letzte]);

  if (!letzte) return null;
  if (jetzt - letzte.at > SICHTBAR_MS) return null;

  const eintrag = state.trash.find((e) => e.id === letzte.id);
  // Schon zurückgeholt oder endgültig weg – dann gibt es nichts anzubieten.
  if (!eintrag) return null;

  return (
    <div className="undo-bar" role="status">
      <span className="undo-text">{eintrag.label} gelöscht</span>
      <button className="btn tiny" onClick={() => restoreFromTrash(eintrag.id)}>
        Rückgängig
      </button>
    </div>
  );
}
