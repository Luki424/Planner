import { useState } from 'react';
import { VORLAUF_STUFEN, vorlaufName, type Vorlauf } from '../domain/reminders';
import { ladeVorlauf, speichereVorlauf } from '../storage/geraet';

/**
 * Erinnerungen einrichten.
 *
 * Die Grenze steht hier, nicht im Kleingedruckten: Es gibt keinen Server,
 * der etwas schicken könnte. Wer glaubt, der Planer wecke ihn zum Zahnarzt,
 * merkt den Irrtum genau einmal – beim verpassten Termin. Deshalb steht
 * über der Einstellung, was sie kann und was nicht.
 */
export function ReminderSettings() {
  const [vorlauf, setVorlauf] = useState<Vorlauf>(ladeVorlauf);
  const [erlaubnis, setErlaubnis] = useState<string>(() =>
    typeof Notification === 'undefined' ? 'nicht-verfuegbar' : Notification.permission,
  );

  const setzen = async (v: Vorlauf) => {
    setVorlauf(v);
    speichereVorlauf(v);
    /*
     * Um die Erlaubnis wird beim Einschalten gebeten und nur dann: Ein
     * Browser fragt ausschließlich auf einen Fingertipp hin, und ungefragt
     * beim Laden zu fragen ist die Art von Zudringlichkeit, die man
     * wegklickt, ohne zu lesen.
     */
    if (v > 0 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        setErlaubnis(await Notification.requestPermission());
      } catch {
        // Abgelehnt oder nicht möglich – der Streifen in der App bleibt.
      }
    }
  };

  return (
    <div className="settings-group">
      <h3>Erinnerungen</h3>

      <p className="hint">
        <strong>Nur solange der Planer offen ist.</strong> Es gibt keinen Server, der etwas schicken
        könnte – bei geschlossener App kommt nichts, und das lässt sich mit einer Internetseite auch
        nicht ändern. Liegt der Planer im Hintergrund und ist die Benachrichtigung erlaubt, kommt
        sie als Systemmeldung.
      </p>

      <label className="field">
        <span>Vor einem Termin erinnern</span>
        <select
          value={vorlauf}
          onChange={(e) => void setzen(Number(e.target.value) as Vorlauf)}
          aria-label="Vorlauf für Erinnerungen"
        >
          {VORLAUF_STUFEN.map((s) => (
            <option key={s} value={s}>
              {vorlaufName(s)}
            </option>
          ))}
        </select>
      </label>

      <p className="hint">
        Gilt nur auf diesem Gerät – ihr stellt es also jeder für euch ein. Ganztägige Einträge
        bleiben außen vor; für Geburtstage und Jahrestage gibt es die eigene Vorwarnung.
      </p>

      {vorlauf > 0 && erlaubnis === 'denied' && (
        <p className="hint warn">
          Benachrichtigungen sind für diese Seite abgelehnt. Der Streifen in der App erscheint
          trotzdem – im Hintergrund siehst du dann aber nichts. Ändern lässt sich das nur in den
          Einstellungen des Browsers.
        </p>
      )}
    </div>
  );
}
