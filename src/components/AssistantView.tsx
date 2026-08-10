import { useCallback, useEffect, useRef, useState } from 'react';
import { contextSummary, systemPrompt, toVorschlag, type Vorschlag } from '../domain/assistant';
import { parseAmount } from '../domain/budget';
import { vorleseText } from '../domain/vorlesen';
import type { AppState } from '../domain/types';
import { frage, type Nachricht } from '../ai/client';
import { ladeVorlesen, ladeZugang, speichereVorlesen } from '../ai/zugang';
import { useSpeech } from '../hooks/useSpeech';
import { useSpeak } from '../hooks/useSpeak';
import { addExpense, addFixedBlock, addShoppingItem, addTask } from '../storage/store';

type Props = {
  state: AppState;
  today: string;
  displayName: string | null;
  /** Frage, die beim Öffnen sofort hinausgeht – kommt vom Weckwort. */
  startFrage?: string;
  onClose: () => void;
};

type Zeile =
  | { art: 'ich'; text: string }
  | { art: 'assistent'; text: string; vorschlaege: Vorschlag[] }
  | { art: 'fehler'; text: string };

/** Minuten aus „HH:MM". */
function minuten(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/*
 * Das Gespräch liegt neben dem Bauteil, nicht darin.
 *
 * Der Deckel geht schon beim Tippen daneben zu – und ein Gespräch, das
 * dabei verschwindet, samt eines Vorschlags, den man gerade übernehmen
 * wollte, wäre ärgerlich. Bewusst hier und nicht im Zustand: Ein Gespräch
 * gehört diesem Gerät und dieser Sitzung, nicht dem Haushalt.
 */
let gespraech: Zeile[] = [];
let uebernommen = new Set<string>();

/**
 * Der Assistent.
 *
 * Er darf lesen und vorschlagen – geändert wird erst nach einem Fingertipp.
 * Ein Missverständnis ist damit eine Rückfrage und kein falscher Termin.
 *
 * Wie die Suche kein eigener Reiter, sondern ein Deckel über der Ansicht:
 * Man hält sich hier nicht auf, man fragt etwas und macht weiter.
 */
export function AssistantView({ state, today, displayName, startFrage, onClose }: Props) {
  const [zeilen, setZeilen] = useState<Zeile[]>(gespraech);
  const [eingabe, setEingabe] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [erledigt, setErledigt] = useState<Set<string>>(uebernommen);
  const [vorlesen, setVorlesen] = useState(ladeVorlesen);
  const eingabeRef = useRef<HTMLTextAreaElement>(null);
  const endeRef = useRef<HTMLDivElement>(null);
  const zugang = ladeZugang();
  const stimme = useSpeak();

  /*
   * Der Griff ins Jetzt. `senden` wird aus der Spracherkennung heraus
   * aufgerufen, und die hält den Stand von damals fest – ohne diese Ablagen
   * schriebe ein Diktat auf einen alten Verlauf.
   */
  const zeilenRef = useRef(zeilen);
  const laeuftRef = useRef(laeuft);
  zeilenRef.current = zeilen;
  laeuftRef.current = laeuft;

  useEffect(() => {
    gespraech = zeilen;
    uebernommen = erledigt;
  }, [zeilen, erledigt]);

  useEffect(() => {
    eingabeRef.current?.focus();
  }, []);

  /*
   * Escape hängt am Dokument, nicht am Kasten: Ohne Schlüssel gibt es kein
   * Eingabefeld, nichts darin hat den Fokus – und ein Deckel, den man nicht
   * mehr zubekommt, ist schlimmer als gar keiner.
   */
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, [onClose]);

  useEffect(() => {
    endeRef.current?.scrollIntoView({ block: 'end' });
  }, [zeilen, laeuft]);

  const senden = async (gesprochen?: string) => {
    const frageText = (gesprochen ?? eingabe).trim();
    if (!frageText || laeuftRef.current || !zugang) return;
    setEingabe('');
    // Eine neue Frage bricht die alte Antwort ab – niemand redet gern dazwischen.
    stimme.abbrechen();
    const neu: Zeile[] = [...zeilenRef.current, { art: 'ich', text: frageText }];
    setZeilen(neu);
    setLaeuft(true);
    try {
      /*
       * Der Ausschnitt des Planers geht als erste Nachricht mit, nicht im
       * Systemtext: So steht er im Verlauf sichtbar an einer Stelle und
       * lässt sich beim Nachlesen wiederfinden.
       */
      const verlauf: Nachricht[] = [
        { rolle: 'user', text: `Unser Stand:\n\n${contextSummary(state, today)}` },
        ...neu
          .filter((z) => z.art !== 'fehler')
          .map((z) => ({
            rolle: (z.art === 'ich' ? 'user' : 'assistant') as 'user' | 'assistant',
            text: z.text,
          })),
      ];
      const antwort = await frage(zugang, systemPrompt(state, today), verlauf);
      const vorschlaege = antwort.rufe
        .map((r, i) => toVorschlag(r.name, r.args, r.id || `v${Date.now()}-${i}`))
        .filter((v): v is Vorschlag => v !== null);
      const text = antwort.text || (vorschlaege.length > 0 ? 'Soll ich das so eintragen?' : '…');
      setZeilen((alt) => [...alt, { art: 'assistent', text, vorschlaege }]);
      if (vorlesen) stimme.sprechen(vorleseText(text, vorschlaege));
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Das hat nicht geklappt.';
      setZeilen((alt) => [...alt, { art: 'fehler', text }]);
      // Auch der Fehler wird vorgelesen: Wer nicht hinsieht, wartete sonst umsonst.
      if (vorlesen) stimme.sprechen(text);
    } finally {
      setLaeuft(false);
    }
  };

  /*
   * Diktiert wird nicht ins Feld, sondern gefragt.
   *
   * Der Sinn der Sprachsteuerung ist, die Hände frei zu haben – ein Diktat,
   * das man anschließend antippen muss, wäre nur ein umständliches
   * Eingabefeld. Der Fingertipp bleibt dort, wo er hingehört: beim
   * *Eintragen*. Fragen ändert nichts.
   */
  const sendenRef = useRef(senden);
  sendenRef.current = senden;
  const gehoert = useCallback((text: string) => void sendenRef.current(text), []);
  const spracheingabe = useSpeech(gehoert);

  const hoert = spracheingabe.status === 'listening';

  /*
   * „Hey Planer, was steht Donnerstag an" – der Satz ist schon gesagt, er
   * soll nicht wiederholt werden müssen. Kam nur der Weckruf ohne Frage,
   * geht stattdessen gleich das Mikrofon an: Wer per Sprache öffnet, will
   * per Sprache weitermachen.
   */
  const gestartetRef = useRef(false);
  const startenRef = useRef(spracheingabe.start);
  startenRef.current = spracheingabe.start;
  useEffect(() => {
    if (gestartetRef.current || !zugang) return;
    gestartetRef.current = true;
    if (startFrage) void sendenRef.current(startFrage);
    else if (startFrage === '') startenRef.current();
    // Nur beim ersten Erscheinen – danach steuert der Benutzer.
  }, [startFrage, zugang]);

  const mikroAn = () => {
    // Erst verstummen: Sonst hört die Erkennung die eigene Stimme mit.
    stimme.abbrechen();
    spracheingabe.start();
  };

  /** Führt einen bestätigten Vorschlag aus. */
  const uebernehmen = (v: Vorschlag) => {
    const a = v.args;
    const bereichId =
      state.contexts.find((c) => c.name.toLowerCase() === String(a.bereich ?? '').toLowerCase())
        ?.id ??
      state.contexts[0]?.id ??
      '';

    if (v.werkzeug === 'termin_anlegen') {
      const ganztags = a.ganztags === true;
      addFixedBlock({
        date: String(a.datum),
        startMin: ganztags ? 0 : minuten(String(a.von)),
        durationMin: ganztags ? 0 : Number(a.dauerMin ?? 60),
        title: String(a.titel),
        contextId: bereichId,
        allDay: ganztags,
      });
    } else if (v.werkzeug === 'aufgabe_anlegen') {
      addTask({
        title: String(a.titel),
        contextId: bereichId,
        dueDate: a.faellig ? String(a.faellig) : null,
        estimateMin: Number(a.dauerMin ?? 30),
      });
    } else if (v.werkzeug === 'einkauf_hinzufuegen') {
      addShoppingItem({
        name: String(a.name),
        quantity: typeof a.menge === 'number' ? a.menge : null,
        unit: String(a.einheit ?? ''),
        estimatedCents: typeof a.preisEuro === 'number' ? Math.round(a.preisEuro * 100) : null,
        createdBy: displayName,
      });
    } else if (v.werkzeug === 'ausgabe_buchen') {
      addExpense({
        date: a.datum ? String(a.datum) : today,
        title: String(a.titel),
        // `toVorschlag` hat den Betrag schon geprüft – hier steht sicher eine Zahl.
        cents: parseAmount(String(a.betragEuro)) ?? 0,
        category: String(a.kategorie ?? 'Sonstiges'),
      });
    }
    setErledigt((alt) => new Set(alt).add(v.id));
  };

  return (
    <div className="search-backdrop" onClick={onClose} role="presentation">
      <div
        className="search-panel assistant"
        role="dialog"
        aria-label="Assistent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-head">
          <span aria-hidden="true">💬</span>
          <strong>Assistent</strong>
          <span className="spacer" />
          {/*
            Der Schalter steht hier und nicht nur in den Einstellungen: Ob
            vorgelesen werden soll, entscheidet sich in der Lage – im Auto
            ja, im Wartezimmer nicht. Dafür geht niemand ins Menü.
          */}
          {stimme.supported && (
            <button
              className={`btn ghost tiny${vorlesen ? ' an' : ''}`}
              onClick={() => {
                const neu = !vorlesen;
                setVorlesen(neu);
                speichereVorlesen(neu);
                if (!neu) stimme.abbrechen();
              }}
              aria-pressed={vorlesen}
              aria-label={vorlesen ? 'Vorlesen ausschalten' : 'Vorlesen einschalten'}
              title={vorlesen ? 'Antworten werden vorgelesen' : 'Antworten werden nicht vorgelesen'}
            >
              {vorlesen ? '🔊' : '🔇'}
            </button>
          )}
          {zeilen.length > 0 && (
            <button
              className="btn ghost tiny"
              onClick={() => {
                setZeilen([]);
                setErledigt(new Set());
              }}
            >
              Neu
            </button>
          )}
          <button className="btn ghost tiny" onClick={onClose}>
            Schließen
          </button>
        </div>

        {!zugang ? (
          /*
           * Ohne Schlüssel kein Assistent – und das gehört gesagt, samt Weg
           * dorthin. Ein leeres Eingabefeld, das nichts tut, wäre schlimmer.
           */
          <p className="empty">
            Für den Assistenten fehlt noch ein Schlüssel. Unter <strong>Mehr → Assistent</strong>{' '}
            trägst du einen ein – er bleibt auf diesem Gerät und wird nicht mit dem Haushalt
            abgeglichen.
          </p>
        ) : (
          <>
            <div className="chat">
              {zeilen.length === 0 && (
                <p className="hint">
                  Frag etwas zu eurem Plan – „was steht Donnerstag an", „wie viel haben wir diesen
                  Monat für Lebensmittel ausgegeben" – oder lass etwas eintragen: „Zahnarzt am
                  Dienstag um zehn". Eintragen passiert erst nach deiner Bestätigung.
                </p>
              )}

              {zeilen.map((z, i) => (
                <div key={i} className={`chat-row ${z.art}`}>
                  <div className={`chat-bubble ${z.art}`}>
                    {z.text}
                    {/*
                      Nachlesen kann man mit den Augen, nachhören nicht: Wer
                      das Vorlesen verpasst hat – oder wem der Browser die
                      Stimme beim ersten Mal verweigert –, tippt hier.
                    */}
                    {z.art === 'assistent' && stimme.supported && (
                      <button
                        className="chat-speak"
                        onClick={() => stimme.sprechen(vorleseText(z.text, z.vorschlaege))}
                        aria-label="Antwort vorlesen"
                        title="Vorlesen"
                      >
                        🔊
                      </button>
                    )}
                    {z.art === 'assistent' && z.vorschlaege.length > 0 && (
                      <div className="chat-proposals">
                        {z.vorschlaege.map((v) => (
                          <div key={v.id} className="chat-proposal">
                            <span className="chat-proposal-text">{v.text}</span>
                            {erledigt.has(v.id) ? (
                              <span className="muted small">eingetragen ✓</span>
                            ) : (
                              <button className="btn tiny primary" onClick={() => uebernehmen(v)}>
                                Übernehmen
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {laeuft && (
                <div className="chat-row assistent">
                  <div className="chat-bubble assistent denkt">
                    <span className="pulse" aria-hidden />
                    <span>denkt nach …</span>
                  </div>
                </div>
              )}
              <div ref={endeRef} />
            </div>

            {/*
              Das Gehörte steht in Lesegröße über der Eingabe, nicht als
              Fußnote am Rand. Dieselbe Lehre wie beim Diktat im Tagesplan:
              Wenn man nicht sieht, ob etwas angekommen ist, spricht man
              lauter statt weiter.
            */}
            {(hoert || spracheingabe.interim || spracheingabe.message) && (
              <div className="chat-live">
                {hoert && <span className="pulse" aria-hidden />}
                <span className="chat-live-text">
                  {spracheingabe.interim || spracheingabe.message || (hoert ? 'Ich höre zu …' : '')}
                </span>
              </div>
            )}

            <form
              className="chat-add"
              onSubmit={(e) => {
                e.preventDefault();
                void senden();
              }}
            >
              <textarea
                ref={eingabeRef}
                value={eingabe}
                onChange={(e) => setEingabe(e.target.value)}
                onKeyDown={(e) => {
                  // Enter schickt, Umschalt+Enter macht eine neue Zeile.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void senden();
                  }
                }}
                placeholder="Was möchtest du wissen oder eintragen?"
                aria-label="Frage an den Assistenten"
                rows={2}
              />
              {spracheingabe.supported && (
                <button
                  className={`btn mic${hoert ? ' listening' : ''}`}
                  type="button"
                  onClick={() => (hoert ? spracheingabe.stop() : mikroAn())}
                  aria-label={hoert ? 'Aufnahme beenden' : 'Frage diktieren'}
                  title="Frage diktieren"
                  disabled={laeuft}
                >
                  <span aria-hidden="true">{hoert ? '■' : '🎤'}</span>
                </button>
              )}
              <button className="btn primary" type="submit" disabled={!eingabe.trim() || laeuft}>
                Fragen
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
