import { useSyncExternalStore } from 'react';
import { beiEinstellungswechsel, ladeWeckwort } from '../ai/zugang';
import { useWakeWord } from '../hooks/useWakeWord';

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

/**
 * Die Blase.
 *
 * Der Assistent soll dauernd zu sehen sein, ohne dauernd im Weg zu stehen –
 * deshalb halbdurchsichtig am Rand. Wer sie berührt oder antippt, bekommt
 * sie voll zu sehen; wer sie nicht braucht, sieht durch sie hindurch auf
 * den Plan darunter.
 *
 * Sie hört außerdem auf „Hey Planer", falls das eingeschaltet ist – aber
 * nur, solange der Assistent zu ist. Zwei Erkennungen gleichzeitig gibt es
 * im Browser nicht, und das Diktat im Assistenten hat Vorrang.
 */
export function AssistantBubble({ offen, onOeffnen }: Props) {
  const weckwort = useSyncExternalStore(beiEinstellungswechsel, ladeWeckwort, () => false);
  useWakeWord(weckwort && !offen, (rest) => onOeffnen(rest));

  if (offen) return null;

  return (
    <button
      className="assistant-fab"
      onClick={() => onOeffnen()}
      aria-label="Assistent"
      title="Assistent fragen (k)"
    >
      <span aria-hidden="true">💬</span>
      {/*
        Beschriftet, nicht nur bebildert: Ein Symbol allein am Rand wurde
        beim Mikrofon schon einmal für Verzierung gehalten. Am Handy tritt
        die Schrift zurück, dort zählt der Daumen.
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
