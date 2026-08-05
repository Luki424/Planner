import { useRef, useState } from 'react';
import { describePhotoError, photoSizeKb, preparePhoto } from '../domain/image';
import { updateSettings } from '../storage/store';

type Props = {
  photo: string | null;
  caption: string;
  shared: boolean;
};

/**
 * Persönliches Foto wählen. Bewusst nichts im Programm mitgeliefert: das
 * Repository ist öffentlich, ein Familienfoto hätte darin nichts verloren.
 * Hier gewählt, bleibt es in eurer Ablage.
 */
export function PersonalPhotoSettings({ photo, caption, shared }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const choose = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const dataUrl = await preparePhoto(file);
      updateSettings({ personalPhoto: dataUrl });
      setMessage(`Übernommen (${photoSizeKb(dataUrl)} kB).`);
    } catch (error) {
      setMessage(describePhotoError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-group">
      <h3>Euer Bild</h3>

      {photo ? (
        <figure className="photo-preview">
          <img src={photo} alt="Persönliches Foto" />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      ) : (
        <p className="hint">
          Noch kein Bild gewählt. Es erscheint beim Start des Planers und hier in
          den Einstellungen.
        </p>
      )}

      <label className="field">
        <span>Beschriftung</span>
        <input
          value={caption}
          onChange={(e) => updateSettings({ personalCaption: e.target.value })}
          placeholder="z.B. Lukas &amp; Anna"
          maxLength={60}
        />
      </label>

      <div className="button-row">
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Wird verkleinert …' : photo ? 'Anderes Bild' : 'Bild wählen'}
        </button>
        {photo && (
          <button
            className="btn danger ghost"
            onClick={() => {
              updateSettings({ personalPhoto: null });
              setMessage(null);
            }}
          >
            Entfernen
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void choose(file);
            e.target.value = '';
          }}
        />
      </div>

      {message && <p className="hint">{message}</p>}

      <p className="hint">
        Das Bild wird beim Übernehmen verkleinert und liegt bei euren Daten –
        {shared
          ? ' ihr seht es also beide.'
          : ' bislang nur auf diesem Gerät. Sobald die gemeinsame Nutzung eingerichtet ist, seht ihr es beide.'}{' '}
        Im öffentlichen Programmcode taucht es nicht auf.
      </p>
    </div>
  );
}
