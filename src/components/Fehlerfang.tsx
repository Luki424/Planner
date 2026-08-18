import { Component, useEffect, useState, type ReactNode } from 'react';

/**
 * Damit ein Fehler nicht stumm bleibt.
 *
 * Der Anlass: „Ich kann keinen Termin erfassen." Antippen, und nichts
 * passiert – kein Hinweis, keine Meldung, nichts. Nachgesehen hatte die App
 * an keiner Stelle einen Fehlerfang: Wirft etwas in einem Klick-Handler eine
 * Ausnahme, schreibt der Browser sie in die Konsole und die Oberfläche tut so,
 * als wäre nichts gewesen. Auf einem Handy sieht niemand eine Konsole.
 *
 * Ein Fehler, den man nicht sieht, ist schlimmer als einer, der stört: Man
 * sucht ihn bei sich, versucht es dreimal und hält am Ende das Programm für
 * kaputt, ohne je zu erfahren, woran es lag.
 *
 * Zwei Wege führen hier zusammen:
 *
 * - **Beim Zeichnen** fängt die Grenze unten den Fehler ab und zeigt eine
 *   lesbare Seite statt eines weißen Bildschirms.
 * - **Beim Bedienen** – also in einem Klick-Handler oder einem Versprechen,
 *   das niemand einlöst – greift der Streifen darüber.
 *
 * Beide zeigen denselben Text zum Mitnehmen: Ohne die Meldung kann man einen
 * Fehler nicht melden.
 */

type Fehlerlage = { text: string; wo: string } | null;

function beschreibe(fehler: unknown): string {
  if (fehler instanceof Error) return `${fehler.name}: ${fehler.message}`;
  if (typeof fehler === 'string') return fehler;
  try {
    return JSON.stringify(fehler);
  } catch {
    return String(fehler);
  }
}

/**
 * Der Streifen für Fehler, die beim Bedienen auftreten.
 *
 * Bewusst nicht von selbst verschwindend: Was hier steht, ist der einzige
 * Anhaltspunkt, und ein Hinweis, der nach drei Sekunden weg ist, hilft
 * niemandem, der gerade das Handy aus der Tasche holt.
 */
export function Fehlerstreifen() {
  const [lage, setLage] = useState<Fehlerlage>(null);
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    const beiFehler = (e: ErrorEvent) => {
      setLage({ text: beschreibe(e.error ?? e.message), wo: herkunft(e.filename, e.lineno) });
    };
    const beiVersprechen = (e: PromiseRejectionEvent) => {
      setLage({ text: beschreibe(e.reason), wo: 'in einem Hintergrundvorgang' });
    };
    window.addEventListener('error', beiFehler);
    window.addEventListener('unhandledrejection', beiVersprechen);
    return () => {
      window.removeEventListener('error', beiFehler);
      window.removeEventListener('unhandledrejection', beiVersprechen);
    };
  }, []);

  if (!lage) return null;

  return (
    <div className="fehler-streifen" role="alert">
      <div className="fehler-text">
        <strong>Da ist etwas schiefgegangen.</strong> Was du zuletzt getan hast, hat vermutlich
        nicht funktioniert. Die Meldung lautet: <code>{lage.text}</code> {lage.wo}
      </div>
      <div className="button-row">
        <button
          className="btn tiny"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(`${lage.text} ${lage.wo}`)
              .then(() => setKopiert(true))
              .catch(() => setKopiert(false));
          }}
        >
          {kopiert ? 'Kopiert' : 'Meldung kopieren'}
        </button>
        <span className="spacer" />
        <button className="btn tiny ghost" onClick={() => setLage(null)}>
          Schließen
        </button>
      </div>
    </div>
  );
}

/** „in Zeile 412 von main.js" – oder gar nichts, wenn der Browser nichts sagt. */
function herkunft(datei?: string, zeile?: number): string {
  if (!datei) return '';
  const kurz = datei.split('/').pop() ?? datei;
  return zeile ? `(${kurz}, Zeile ${zeile})` : `(${kurz})`;
}

/**
 * Die Grenze für Fehler beim Zeichnen.
 *
 * React baut bei einem Fehler im Zeichnen den ganzen Baum ab – ohne diese
 * Grenze bleibt ein weißer Bildschirm zurück, und der sagt weniger als jede
 * Fehlermeldung. Muss eine Klasse sein, dafür gibt es keinen Haken.
 */
export class Fehlergrenze extends Component<{ children: ReactNode }, { text: string | null }> {
  state = { text: null as string | null };

  static getDerivedStateFromError(fehler: unknown) {
    return { text: beschreibe(fehler) };
  }

  componentDidCatch(fehler: unknown) {
    // Die Konsole bekommt den vollen Fehler weiterhin – für den Fall, dass
    // jemand mit einem Rechner danebensitzt.
    console.error('Fehler beim Zeichnen:', fehler);
  }

  render() {
    if (this.state.text === null) return this.props.children;
    return (
      <div className="fehler-seite">
        <h1>Der Planer ist stehengeblieben</h1>
        <p>
          Beim Aufbauen der Ansicht ist ein Fehler aufgetreten. Deine Daten sind davon nicht
          betroffen – sie liegen unverändert im Browser und im Haushalt.
        </p>
        <p className="fehler-text">
          <code>{this.state.text}</code>
        </p>
        <div className="button-row">
          <button className="btn primary" onClick={() => window.location.reload()}>
            Neu laden
          </button>
          <button
            className="btn"
            onClick={() => void navigator.clipboard?.writeText(this.state.text ?? '')}
          >
            Meldung kopieren
          </button>
        </div>
      </div>
    );
  }
}
