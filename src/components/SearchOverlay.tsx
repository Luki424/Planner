import { useEffect, useMemo, useRef, useState } from 'react';
import { ART_ICONS, ART_LABELS, search, type Treffer, type Ziel } from '../domain/search';
import type { AppState } from '../domain/types';

type Props = {
  state: AppState;
  today: string;
  onClose: () => void;
  onOpen: (ziel: Ziel) => void;
};

/**
 * Suche über alles, als Deckel über der Ansicht.
 *
 * Kein eigener Reiter: Suchen ist kein Ort, an dem man sich aufhält, sondern
 * ein Weg irgendwo hin. Der Deckel geht auf, man tippt, man landet – und die
 * Ansicht darunter ist noch die, aus der man kam.
 */
export function SearchOverlay({ state, today, onClose, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [gewaehlt, setGewaehlt] = useState(0);
  const eingabeRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);

  const treffer = useMemo(() => search(state, query, today), [state, query, today]);

  // Beim Öffnen gleich tippen können – sonst kostet die Suche einen Extratipp.
  useEffect(() => {
    eingabeRef.current?.focus();
  }, []);

  // Bei neuer Eingabe wieder oben anfangen.
  useEffect(() => {
    setGewaehlt(0);
  }, [query]);

  /*
   * Die gewählte Zeile muss sichtbar bleiben, wenn man mit den Pfeiltasten
   * durchgeht – sonst blättert man blind.
   */
  useEffect(() => {
    listeRef.current?.querySelectorAll('li')[gewaehlt]?.scrollIntoView({ block: 'nearest' });
  }, [gewaehlt]);

  const oeffnen = (t: Treffer) => {
    onOpen(t.ziel);
    onClose();
  };

  const taste = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setGewaehlt((i) => Math.min(treffer.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setGewaehlt((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && treffer[gewaehlt]) {
      e.preventDefault();
      oeffnen(treffer[gewaehlt]);
    }
  };

  return (
    <div className="search-backdrop" onClick={onClose} role="presentation">
      <div
        className="search-panel"
        role="dialog"
        aria-label="Suche"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={taste}
      >
        <div className="search-head">
          <span aria-hidden="true">🔍</span>
          <input
            ref={eingabeRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Termin, Aufgabe, Einkauf, Ausgabe …"
            aria-label="Suche"
            autoComplete="off"
          />
          <button className="btn ghost tiny" onClick={onClose}>
            Schließen
          </button>
        </div>

        {query.trim().length > 0 && query.trim().length < 2 && (
          <p className="hint">Noch ein Buchstabe – bei einem einzigen träfe alles zu.</p>
        )}

        {query.trim().length >= 2 && treffer.length === 0 && (
          <p className="empty">Nichts gefunden. Gesucht wird in Titeln und Notizen.</p>
        )}

        {treffer.length > 0 && (
          <>
            <p className="hint">
              {treffer.length} {treffer.length === 1 ? 'Treffer' : 'Treffer'} · ↑↓ zum Blättern,
              Enter zum Öffnen
            </p>
            <ul className="search-results" ref={listeRef}>
              {treffer.map((t, i) => (
                <li key={`${t.art}-${t.id}`}>
                  <button
                    className={`search-hit${i === gewaehlt ? ' on' : ''}`}
                    onClick={() => oeffnen(t)}
                    onMouseEnter={() => setGewaehlt(i)}
                  >
                    <span className="search-kind" title={ART_LABELS[t.art]}>
                      <span aria-hidden="true">{ART_ICONS[t.art]}</span>
                      <span className="muted small">{ART_LABELS[t.art]}</span>
                    </span>
                    <span className="search-text">
                      <span className="search-title">{t.titel}</span>
                      {t.beschreibung && <span className="muted small">{t.beschreibung}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
