import { useState } from 'react';
import { ANBIETER_LINK, ANBIETER_NAME, STANDARD_MODELL, type Anbieter } from '../ai/client';
import {
  ladeVorlesen,
  ladeWeckwort,
  ladeZugang,
  maskiere,
  speichereVorlesen,
  speichereWeckwort,
  speichereZugang,
} from '../ai/zugang';

/**
 * Zugang zum Assistenten einrichten.
 *
 * Der Schlüssel bleibt auf diesem Gerät. Das ist keine Bequemlichkeitsfrage:
 * Alles, was im Zustand liegt, wird mit dem Haushalt abgeglichen und stünde
 * damit in der gemeinsamen Datenbank. Ein API-Schlüssel gehört dorthin
 * nicht – der Preis ist, dass ihn jeder einmal selbst einträgt.
 */
export function AssistantSettings() {
  const [zugang, setZugang] = useState(ladeZugang);
  const [anbieter, setAnbieter] = useState<Anbieter>(zugang?.anbieter ?? 'anthropic');
  const [modell, setModell] = useState(zugang?.modell ?? STANDARD_MODELL.anthropic);
  const [eingabe, setEingabe] = useState('');
  const [vorlesen, setVorlesen] = useState(ladeVorlesen);
  const [weckwort, setWeckwort] = useState(ladeWeckwort);

  const speichern = () => {
    const schluessel = eingabe.trim();
    if (!schluessel) return;
    const neu = { anbieter, schluessel, modell: modell.trim() || STANDARD_MODELL[anbieter] };
    speichereZugang(neu);
    setZugang(neu);
    setEingabe('');
  };

  return (
    <div className="settings-group">
      <h3>Assistent</h3>

      <p className="hint">
        Der Assistent beantwortet Fragen zu eurem Plan und trägt auf Wunsch etwas ein – geändert
        wird erst nach deiner Bestätigung. Dafür braucht er einen eigenen Zugang zu einem
        Sprachmodell.
      </p>

      {/*
        Beides gehört vor die Eingabe, nicht dahinter: Wer einen Schlüssel
        einträgt, soll vorher wissen, was er kostet und was hinausgeht.
      */}
      <p className="hint">
        <strong>Der Schlüssel bleibt auf diesem Gerät.</strong> Er wird nicht mit dem Haushalt
        abgeglichen – ihr tragt ihn also je einmal ein. Die Kosten laufen über dein Konto beim
        Anbieter.
      </p>
      <p className="hint">
        <strong>Was hinausgeht:</strong> die Termine der nächsten zwei Wochen, offene Aufgaben, die
        Einkaufsliste und die Ausgabensummen des Monats – jeweils nur beim Fragen. Keine Belege,
        keine Notizen, keine Fotos.
      </p>

      {/*
        Vorlesen steht bei den Einstellungen *und* im Assistenten selbst. Die
        Lage entscheidet – im Auto ja, im Wartezimmer nicht –, und dafür geht
        niemand ins Menü. Hier steht es, damit man es überhaupt findet.
      */}
      <label className="check-field">
        <input
          type="checkbox"
          checked={vorlesen}
          onChange={(e) => {
            setVorlesen(e.target.checked);
            speichereVorlesen(e.target.checked);
          }}
        />
        <span>
          Antworten vorlesen
          <span className="muted small"> – gilt nur auf diesem Gerät, wie der Schlüssel</span>
        </span>
      </label>

      <label className="check-field">
        <input
          type="checkbox"
          checked={weckwort}
          onChange={(e) => {
            setWeckwort(e.target.checked);
            speichereWeckwort(e.target.checked);
          }}
        />
        <span>
          Auf „Hey Planer" hören
          <span className="muted small"> – dann öffnet ein Zuruf den Assistenten</span>
        </span>
      </label>

      {/*
        Steht direkt darunter und nicht im Kleingedruckten: Dauerhaftes
        Zuhören ist eine Entscheidung, keine Bequemlichkeit. Wer sie trifft,
        soll wissen, was sie kostet.
      */}
      {weckwort && (
        <p className="hint warn">
          Dabei bleibt das Mikrofon offen, solange der Planer offen und sichtbar ist – das kostet
          Akku, und Chrome schickt den Ton zur Auswertung an Google. Im Hintergrund oder bei
          geschlossener App hört nichts zu; das kann eine Internetseite nicht.
        </p>
      )}

      {zugang ? (
        <div className="button-row">
          <span className="muted small">
            {ANBIETER_NAME[zugang.anbieter]} · {maskiere(zugang.schluessel)} · {zugang.modell}
          </span>
          <span className="spacer" />
          <button
            className="btn tiny danger ghost"
            onClick={() => {
              speichereZugang(null);
              setZugang(null);
            }}
          >
            Schlüssel entfernen
          </button>
        </div>
      ) : (
        <>
          <div className="field-row tight">
            <label className="field">
              <span>Anbieter</span>
              <select
                value={anbieter}
                onChange={(e) => {
                  const a = e.target.value as Anbieter;
                  setAnbieter(a);
                  setModell(STANDARD_MODELL[a]);
                }}
              >
                {(['anthropic', 'openai'] as Anbieter[]).map((a) => (
                  <option key={a} value={a}>
                    {ANBIETER_NAME[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Modell</span>
              <input
                value={modell}
                onChange={(e) => setModell(e.target.value)}
                aria-label="Modell"
              />
            </label>
          </div>

          <label className="field">
            <span>Schlüssel</span>
            <input
              type="password"
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              placeholder={anbieter === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
              aria-label="API-Schlüssel"
              autoComplete="off"
            />
          </label>

          <div className="button-row">
            <a
              className="btn ghost tiny"
              href={ANBIETER_LINK[anbieter]}
              target="_blank"
              rel="noreferrer"
            >
              Schlüssel anlegen ↗
            </a>
            <span className="spacer" />
            <button className="btn primary" onClick={speichern} disabled={!eingabe.trim()}>
              Speichern
            </button>
          </div>
        </>
      )}
    </div>
  );
}
