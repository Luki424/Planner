import { useEffect, useRef, type ReactNode } from 'react';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Der Rahmen für alle Dialoge – und der Ort zweier Fehler, die zusammen
 * das Erfassen unmöglich machten.
 *
 * Gemeldet wurde: „Ich kann keine Aufgabe erstellen, weil das
 * Texteingabefenster immer nach sehr kurzer Zeit nach dem Anklicken wieder
 * verschwindet." Gemessen im Browser, zwei Geräte im selben Haushalt:
 *
 *     +148 ms  Fokus in das Titelfeld   (Tastatur geht auf)
 *     +331 ms  Fokus weg aus dem Titelfeld
 *     +332 ms  Fokus auf ✕ Schließen    (Tastatur geht zu)
 *
 * Zwei Ursachen, beide hier:
 *
 * **1. Der Fokus wurde bei jedem Neuzeichnen neu gesetzt.** Der Effekt hing
 * an `onClose`, und das ist oben ein `onClose={() => setDialog(null)}` –
 * bei jedem Neuzeichnen der App eine andere Funktion. Also lief der Effekt
 * wieder, und mit ihm das `focus()`. Neu gezeichnet wird die App laufend:
 * Es genügt, dass Svenja auf ihrem Gerät etwas einträgt. Der Abgleich
 * bringt die Änderung herein, die App zeichnet neu – und dem, der gerade
 * tippt, wird das Feld unter dem Finger weggezogen.
 *
 * **2. Gefasst wurde ohnehin das Falsche.** Gesucht wurde das erste
 * `input, textarea, select, button` im Dialog. In der Reihenfolge des
 * Dokuments ist das nicht das Titelfeld, sondern das ✕ in der Kopfzeile.
 * Auf dem Handy heißt „Fokus auf einem Knopf": Tastatur zu.
 *
 * Deshalb jetzt: einmal beim Öffnen, und in das erste *Feld* – am Handy
 * gar nicht in ein Feld, sondern auf den Dialog selbst. Eine Tastatur, die
 * ungefragt aufgeht, verdeckt die halbe Maske.
 */
export function Modal({ title, onClose, children, footer }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  /*
   * Der Schließer als Ref. So hängt kein Effekt mehr an seiner Identität –
   * genau daran hing der Fehler oben.
   */
  const schliessen = useRef(onClose);
  schliessen.current = onClose;
  /*
   * Der Hintergrund schließt nur, wenn Drücken *und* Loslassen auf ihm
   * liegen. Vorher genügte ein `mousedown`, und das ist am Handy kein
   * echtes Ereignis, sondern eines, das der Browser nach dem Loslassen
   * nachreicht – auf die Stelle, die dann dort liegt. Geht dazwischen die
   * Tastatur auf, verschiebt sich alles, und der Tipp aufs Feld landet
   * daneben: Dialog zu, Eingetipptes weg. `pointer*` kommt zur richtigen
   * Zeit auf dem richtigen Ziel an.
   */
  const beginntAufDemGrund = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // Ohne Maus kein selbsttätiges Aufziehen der Tastatur: Der Fokus geht
    // auf den Dialog. Damit ist er trotzdem im Dialog – für Escape und für
    // eine Vorlesehilfe zählt genau das.
    const mitMaus = window.matchMedia?.('(pointer: fine)').matches ?? true;
    const erstesFeld = panel.querySelector<HTMLElement>(
      '.modal-body input, .modal-body textarea, .modal-body select',
    );
    if (mitMaus && erstesFeld) erstesFeld.focus();
    else panel.focus();
  }, []);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        beginntAufDemGrund.current = e.target === e.currentTarget;
      }}
      onPointerUp={(e) => {
        if (beginntAufDemGrund.current && e.target === e.currentTarget) onClose();
        beginntAufDemGrund.current = false;
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}
