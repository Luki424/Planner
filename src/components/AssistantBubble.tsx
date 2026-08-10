import { useEffect, useState, useSyncExternalStore } from 'react';
import { beiEinstellungswechsel, ladeWeckwort } from '../ai/zugang';
import { useWakeWord } from '../hooks/useWakeWord';
import { inDerEckeUntenRechts, useVisualViewport } from '../hooks/useVisualViewport';

type Props = {
  /** Ist der Assistent gerade offen? Dann ruht die Blase. */
  offen: boolean;
  /**
   * Kein Schlüssel? Die Blase führt trotzdem hin – dort steht, was fehlt.
   *
   * `undefined` heißt angetippt, ein leerer Text heißt „Hey Planer" ohne
   * Frage – dann geht drüben gleich das Mikrofon an.
   */
  onOeffnen: (frage?: string) => void;
};

/** Schreibt der Benutzer gerade irgendwo? */
function istSchreibfeld(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  const typ = (el as HTMLInputElement).type;
  // Farbwähler, Häkchen und Dateiauswahl sind keine Schreibfenster.
  return !['checkbox', 'radio', 'color', 'file', 'range', 'submit', 'button'].includes(typ);
}

/**
 * Die Blase.
 *
 * Der Assistent soll dauernd zu sehen sein, ohne dauernd im Weg zu stehen.
 * Beim ersten Anlauf war das falsch gewichtet: 45 % Deckkraft, voll erst
 * beim Berühren mit der Maus. **Auf einem Handy gibt es kein Berühren mit
 * der Maus** – dort blieb sie dauerhaft blass, und genau so wurde sie
 * gemeldet. Jetzt ist sie kräftig und nur noch leicht durchscheinend;
 * durchsichtiger wird sie nirgends mehr.
 *
 * Und sie meldet sich, wo man sie braucht: Sobald irgendwo geschrieben
 * wird, tritt sie hervor und zeigt ihre Beschriftung – wer tippt, ist
 * gerade dabei, etwas einzutragen, und genau das kann sie abnehmen.
 *
 * Sie hängt am *sichtbaren* Ausschnitt, nicht am Layout: Sonst liegt sie,
 * sobald die Tastatur aufgeht, dahinter – ausgerechnet dann.
 */
export function AssistantBubble({ offen, onOeffnen }: Props) {
  const weckwort = useSyncExternalStore(beiEinstellungswechsel, ladeWeckwort, () => false);
  const [schreibt, setSchreibt] = useState(false);
  const sichtfeld = useVisualViewport(!offen);
  useWakeWord(weckwort && !offen, (rest) => onOeffnen(rest));

  useEffect(() => {
    const rein = (e: FocusEvent) => setSchreibt(istSchreibfeld(e.target as Element));
    const raus = () => setSchreibt(false);
    document.addEventListener('focusin', rein);
    document.addEventListener('focusout', raus);
    return () => {
      document.removeEventListener('focusin', rein);
      document.removeEventListener('focusout', raus);
    };
  }, []);

  if (offen) return null;

  /*
   * Der große Abstand hält die Navigationsleiste frei. Klein wird er nur,
   * wenn sie ohnehin verdeckt ist: bei aufgezogener Tastatur oder im Zoom.
   *
   * Gemessen wird die Tastatur, nicht das Schreiben. Am Schreiben
   * festgemacht rutschte die Blase auch dann nach unten, wenn gar keine
   * Tastatur aufging – am Bildschirm etwa – und lag dann auf der Leiste.
   */
  const tastaturHoch = typeof window !== 'undefined' && window.innerHeight - sichtfeld.height > 120;
  const amHandy = sichtfeld.width <= 860;
  const abstandUnten = tastaturHoch || sichtfeld.scale > 1.02 ? 12 : amHandy ? 72 : 16;

  return (
    <button
      className={`assistant-fab${schreibt ? ' schreibt' : ''}`}
      onClick={() => onOeffnen()}
      aria-label="Assistent"
      title="Assistent fragen (k)"
      style={inDerEckeUntenRechts(sichtfeld, abstandUnten, 16)}
    >
      <span aria-hidden="true">💬</span>
      {/*
        Beschriftet, nicht nur bebildert: Ein Symbol allein am Rand wurde
        beim Mikrofon schon einmal für Verzierung gehalten. Am Handy tritt
        die Schrift zurück – außer beim Schreiben, da soll sie sich melden.
      */}
      <span className="assistant-fab-label">Assistent</span>
      {weckwort && (
        <span className="assistant-fab-ear" aria-hidden="true" title="hört auf Hey Planer">
          👂
        </span>
      )}
    </button>
  );
}
