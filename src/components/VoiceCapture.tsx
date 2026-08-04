import { useCallback, useState } from 'react';
import { describeParsed, parseUtterance, type Parsed, type ParseMode } from '../domain/voice';
import { useSpeech } from '../hooks/useSpeech';

type Props = {
  mode: ParseMode;
  today: string;
  /** Wird mit dem bestätigten Ergebnis aufgerufen. */
  onAccept: (parsed: Parsed) => void;
  label: string;
};

/**
 * Mikrofon-Knopf mit Bestätigungsschritt: Gesprochenes wird gedeutet und
 * erst nach Sichtkontrolle übernommen. Spracherkennung verhört sich zu oft,
 * als dass ein Termin ungeprüft im Kalender landen sollte.
 */
export function VoiceCapture({ mode, today, onAccept, label }: Props) {
  const [draft, setDraft] = useState<{ parsed: Parsed; heard: string } | null>(null);
  const [unparsed, setUnparsed] = useState<string | null>(null);

  const handleResult = useCallback(
    (text: string) => {
      const parsed = parseUtterance(text, today, mode);
      if (parsed) {
        setUnparsed(null);
        setDraft({ parsed, heard: text });
      } else {
        setDraft(null);
        setUnparsed(text);
      }
    },
    [mode, today],
  );

  const speech = useSpeech(handleResult);

  if (!speech.supported) {
    return (
      <button
        className="btn mic"
        disabled
        title="Dieser Browser bietet keine Spracherkennung. Chrome oder Safari können das."
      >
        🎤
      </button>
    );
  }

  const listening = speech.status === 'listening';

  return (
    <>
      <button
        className={`btn mic${listening ? ' listening' : ''}`}
        onClick={() => (listening ? speech.stop() : speech.start())}
        aria-label={listening ? 'Aufnahme beenden' : label}
        title={label}
      >
        {listening ? '■' : '🎤'}
      </button>

      {(listening || speech.interim || draft || unparsed || speech.message) && (
        <div className="voice-panel" role="status">
          {listening && (
            <p className="voice-live">
              <span className="pulse" aria-hidden /> {speech.interim || 'Sprich einfach los …'}
            </p>
          )}

          {speech.message && <p className="hint warn">{speech.message}</p>}

          {unparsed && (
            <div className="voice-result">
              <p className="hint warn">Daraus konnte ich nichts erkennen:</p>
              <p className="voice-heard">„{unparsed}"</p>
              <div className="button-row">
                <button className="btn ghost" onClick={() => setUnparsed(null)}>
                  Verwerfen
                </button>
                <button className="btn" onClick={() => speech.start()}>
                  Nochmal
                </button>
              </div>
            </div>
          )}

          {draft && (
            <div className="voice-result">
              <p className="voice-heard">„{draft.heard}"</p>
              <p className="voice-parsed">{describeParsed(draft.parsed)}</p>
              <div className="button-row">
                <button className="btn ghost" onClick={() => setDraft(null)}>
                  Verwerfen
                </button>
                <button className="btn" onClick={() => speech.start()}>
                  Nochmal
                </button>
                <span className="spacer" />
                <button
                  className="btn primary"
                  onClick={() => {
                    onAccept(draft.parsed);
                    setDraft(null);
                  }}
                >
                  Übernehmen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
