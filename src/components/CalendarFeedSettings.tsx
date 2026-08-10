import { useState } from 'react';
import { ABGLEICH_TAGE, naechsterLauf, normalisiereUrl, standText } from '../domain/abo';
import { formatDateShort } from '../domain/dates';
import type { AppState } from '../domain/types';
import { gleicheKalenderAb } from '../storage/kalenderabruf';
import { updateSettings } from '../storage/store';
import { MemberPicker } from './MemberPicker';

/**
 * Den Arbeitskalender abonnieren.
 *
 * Ein Versuch mit ehrlichem Ausgang, kein Versprechen: Ob ein Browser eine
 * fremde Adresse lesen darf, entscheidet deren Anbieter, nicht der Planer –
 * und Outlook erlaubt es meistens nicht. Deshalb steht das *vor* dem
 * Eingabefeld und nicht als Fußnote danach, und deshalb bleibt der Weg über
 * die Datei daneben stehen.
 */
export function CalendarFeedSettings({ state }: { state: AppState }) {
  const abo = state.settings.calendarFeed ?? null;
  const [eingabe, setEingabe] = useState('');
  const [contextId, setContextId] = useState(state.contexts[0]?.id ?? '');
  const [privateContextId, setPrivateContextId] = useState(
    () =>
      state.contexts.find((c) => /privat/i.test(c.name))?.id ??
      state.contexts[1]?.id ??
      state.contexts[0]?.id ??
      '',
  );
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const einrichten = () => {
    const url = normalisiereUrl(eingabe);
    if (!url) {
      setMeldung('Das sieht nicht nach einer Kalenderadresse aus.');
      return;
    }
    setMeldung(null);
    updateSettings({
      calendarFeed: {
        url,
        contextId,
        privateContextId,
        memberIds,
        lastRun: null,
        lastError: null,
        lastCount: 0,
      },
    });
    setEingabe('');
  };

  const jetzt = async () => {
    if (!abo) return;
    setLaeuft(true);
    setMeldung(null);
    const ergebnis = await gleicheKalenderAb(abo);
    setLaeuft(false);
    setMeldung(
      'fehler' in ergebnis
        ? ergebnis.fehler
        : ergebnis.neu === 0
          ? 'Abgeglichen – nichts Neues dabei.'
          : `Abgeglichen – ${ergebnis.neu} übernommen.`,
    );
  };

  return (
    <div className="settings-group">
      <h3>Kalender abonnieren</h3>

      {/*
        Die Einschränkung gehört vor das Feld. Wer eine Adresse einträgt und
        erst eine Woche später merkt, dass nie etwas kam, hat sich in der
        Zwischenzeit darauf verlassen.
      */}
      <p className="hint">
        Outlook und andere Kalender lassen sich als Adresse veröffentlichen. Der Planer versucht
        dann einmal die Woche, sie selbst zu holen – <strong>solange er offen ist</strong>.
      </p>
      <p className="hint">
        <strong>Ob das klappt, entscheidet dein Kalenderanbieter.</strong> Ein Browser darf eine
        fremde Adresse nur lesen, wenn deren Server es ausdrücklich erlaubt; Outlook tut das
        meistens nicht. Klappt es nicht, steht hier, woran es lag – und der Weg über die Datei
        darunter funktioniert weiterhin.
      </p>

      {abo ? (
        <>
          <p className="hint">
            <code className="feed-url">{abo.url}</code>
          </p>
          <p className={abo.lastError ? 'hint warn' : 'hint'}>
            {standText(abo)}
            {abo.lastRun && !abo.lastError && (
              <>
                {' '}
                Nächster Abgleich ab {formatDateShort(naechsterLauf(abo.lastRun) ?? abo.lastRun)}.
              </>
            )}
          </p>
          {meldung && <p className="hint">{meldung}</p>}
          <div className="button-row">
            <button
              className="btn tiny danger ghost"
              onClick={() => updateSettings({ calendarFeed: null })}
            >
              Abo entfernen
            </button>
            <span className="spacer" />
            <button className="btn primary" onClick={() => void jetzt()} disabled={laeuft}>
              {laeuft ? 'Wird geholt …' : 'Jetzt abgleichen'}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>Adresse des Kalenders</span>
            <input
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics"
              aria-label="Kalenderadresse"
              autoComplete="off"
            />
          </label>

          <div className="field-row tight">
            <label className="field">
              <span>Bereich</span>
              <select value={contextId} onChange={(e) => setContextId(e.target.value)}>
                {state.contexts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Privates nach</span>
              <select
                value={privateContextId}
                onChange={(e) => setPrivateContextId(e.target.value)}
                aria-label="Bereich für Privates"
              >
                <option value="">nicht trennen</option>
                {state.contexts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {state.members.length > 0 && (
            <MemberPicker members={state.members} value={memberIds} onChange={setMemberIds} />
          )}

          {meldung && <p className="hint warn">{meldung}</p>}

          <div className="button-row">
            <span className="muted small">Abgleich alle {ABGLEICH_TAGE} Tage</span>
            <span className="spacer" />
            <button className="btn primary" onClick={einrichten} disabled={!eingabe.trim()}>
              Abo einrichten
            </button>
          </div>
        </>
      )}
    </div>
  );
}
