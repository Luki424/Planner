import { useRef, useState } from 'react';
import { describePhotoError, photoSizeKb, prepareReceipt } from '../domain/image';

type Props = {
  /** Der aufgenommene Beleg als Data-URL, oder null. */
  value: string | null;
  onChange: (image: string | null) => void;
};

/**
 * Beleg fotografieren oder aus der Galerie wählen.
 *
 * `capture="environment"` öffnet am Handy die Rückkamera statt des
 * Dateibrowsers – ein Bon wird abfotografiert, nicht herausgesucht. Am
 * Rechner bleibt es ein gewöhnlicher Dateidialog, dort ist das Attribut
 * wirkungslos.
 *
 * Was auf dem Bild steht, wird nicht ausgewertet: Der Betrag wird von Hand
 * eingetragen. Zeichenerkennung im Browser ist bei Kassenbons unzuverlässig,
 * und ein Dienst im Netz käme nicht in Frage – dafür müsste ein Schlüssel in
 * eine öffentlich einsehbare Seite, wo ihn jeder benutzen könnte.
 */
export function ReceiptPicker({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [gross, setGross] = useState(false);

  const waehlen = async (file: File) => {
    setFehler(null);
    setLaeuft(true);
    try {
      onChange(await prepareReceipt(file));
    } catch (err) {
      setFehler(describePhotoError(err));
    } finally {
      setLaeuft(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="receipt-picker">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Beleg fotografieren"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void waehlen(file);
        }}
      />

      {value ? (
        <div className="receipt-have">
          {/*
            Das Vorschaubild ist bewusst klein und der Bon darin nicht lesbar –
            es zeigt nur, dass etwas da ist. Zum Lesen wird es groß geöffnet.
          */}
          <button
            type="button"
            className="receipt-thumb"
            onClick={() => setGross(true)}
            title="Beleg groß ansehen"
          >
            <img src={value} alt="Fotografierter Beleg" />
          </button>
          <div className="receipt-actions">
            <span className="muted small">Beleg dabei · {photoSizeKb(value)} kB</span>
            <div className="button-row">
              <button
                type="button"
                className="btn tiny ghost"
                onClick={() => fileRef.current?.click()}
              >
                Neu aufnehmen
              </button>
              <button
                type="button"
                className="btn tiny danger ghost"
                onClick={() => {
                  onChange(null);
                  setFehler(null);
                }}
              >
                Entfernen
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          onClick={() => fileRef.current?.click()}
          disabled={laeuft}
        >
          <span aria-hidden="true">📷</span> {laeuft ? 'Einen Moment …' : 'Beleg fotografieren'}
        </button>
      )}

      {fehler && <p className="hint warn">{fehler}</p>}

      {gross && value && (
        /*
         * Ein einfacher Vollbild-Deckel statt des Dialogs: Der Beleg wird oft
         * aus einem Formular heraus geöffnet, und ein Dialog im Dialog wäre
         * beim Schließen nicht mehr eindeutig.
         */
        <div
          className="receipt-full"
          role="dialog"
          aria-label="Beleg"
          onClick={() => setGross(false)}
        >
          <img src={value} alt="Fotografierter Beleg" />
          <button type="button" className="btn" onClick={() => setGross(false)}>
            Schließen
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Zeigt einen abgelegten Beleg an – ohne die Möglichkeit, ihn zu ersetzen.
 * Für die Ausgabenliste, wo es ums Nachschauen geht, nicht ums Erfassen.
 */
export function ReceiptView({ image, onDelete }: { image: string; onDelete?: () => void }) {
  const [gross, setGross] = useState(false);

  return (
    <>
      <button
        type="button"
        className="receipt-thumb small"
        onClick={() => setGross(true)}
        title="Beleg groß ansehen"
      >
        <img src={image} alt="Fotografierter Beleg" />
      </button>

      {gross && (
        <div
          className="receipt-full"
          role="dialog"
          aria-label="Beleg"
          onClick={() => setGross(false)}
        >
          <img src={image} alt="Fotografierter Beleg" />
          <div className="button-row">
            {onDelete && (
              <button
                type="button"
                className="btn danger ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  setGross(false);
                }}
              >
                Beleg löschen
              </button>
            )}
            <button type="button" className="btn" onClick={() => setGross(false)}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
