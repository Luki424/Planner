import { useMemo, useRef, useState } from 'react';
import { addDays, formatDateShort, today as todayISO } from '../domain/dates';
import { summarizeClassification } from '../domain/classify';
import { buildIcs, parseIcs, type IcsParseResult } from '../domain/ics';
import type { AppState } from '../domain/types';
import { importCalendar, removeImportedCalendar } from '../storage/store';
import { MemberPicker } from './MemberPicker';

type Props = { state: AppState };

/** Wie weit zurück und wie weit voraus eingelesen wird. */
const ZURUECK_TAGE = 30;
const VORAUS_TAGE = 365;

/**
 * Kalender einlesen und ausgeben.
 *
 * Bewusst über Dateien statt über eine Abo-Adresse: kein Konto, keine
 * laufende Verbindung, nichts, das im Hintergrund mitliest. Der berufliche
 * Kalender lässt sich als .ics ausgeben, hier einlesen und später erneut
 * einlesen – Doppel erkennt der Planer selbst.
 */
export function CalendarSettings({ state }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [vorschau, setVorschau] = useState<IcsParseResult | null>(null);
  const [dateiname, setDateiname] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [contextId, setContextId] = useState(state.contexts[0]?.id ?? '');
  /*
   * Wohin das Private geht. Vorbelegt mit einem Bereich, der „privat" heißt,
   * sonst mit dem zweiten – bei den Startbereichen „Beruflich" und „Privat"
   * stimmt das ohne Zutun.
   */
  const [privateContextId, setPrivateContextId] = useState(
    () =>
      state.contexts.find((c) => /privat/i.test(c.name))?.id ??
      state.contexts[1]?.id ??
      state.contexts[0]?.id ??
      '',
  );
  const [trennen, setTrennen] = useState(true);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  /*
   * Der Weg ohne Datei. Die Dateiauswahl am Handy ist der unzuverlässige Teil
   * der Kette: Android reicht eine Datei aus einer anderen App manchmal gar
   * nicht durch und meldet sich dabei nur mit einer grauen Blase („Zu wenig
   * Speicher für vorherige Operation") – der Planer erfährt davon nichts.
   * Kopierter Text geht an alledem vorbei.
   */
  const [einfuegen, setEinfuegen] = useState(false);
  const [eingefuegt, setEingefuegt] = useState('');

  const heute = todayISO();
  const von = addDays(heute, -ZURUECK_TAGE);
  const bis = addDays(heute, VORAUS_TAGE);

  const einschaetzung = useMemo(() => summarizeClassification(vorschau?.events ?? []), [vorschau]);

  const importiert = useMemo(
    () => state.blocks.filter((b) => b.icsUid).length + state.tasks.filter((t) => t.icsUid).length,
    [state.blocks, state.tasks],
  );

  /** Liest Kalendertext – gleich, ob er aus einer Datei kommt oder eingefügt wurde. */
  const lesenText = (text: string, name: string): boolean => {
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      setFehler(
        name === 'Eingefügter Text'
          ? 'Das sieht nicht nach Kalendertext aus – er beginnt mit BEGIN:VCALENDAR.'
          : 'Das sieht nicht nach einer Kalenderdatei aus.',
      );
      setVorschau(null);
      return false;
    }
    const result = parseIcs(text, von, bis);
    setDateiname(name);
    setVorschau(result);
    if (result.events.length === 0 && result.skipped.length === 0) {
      setFehler('Keine Termine im gelesenen Zeitraum.');
    }
    return true;
  };

  const lesen = async (file: File) => {
    setFehler(null);
    setMeldung(null);
    try {
      lesenText(await file.text(), file.name);
    } catch {
      setFehler('Die Datei ließ sich nicht lesen.');
      setVorschau(null);
    }
  };

  const uebernehmen = () => {
    if (!vorschau) return;
    const { added, skipped } = importCalendar({
      events: vorschau.events,
      contextId,
      privateContextId: trennen && privateContextId !== contextId ? privateContextId : null,
      memberIds,
    });
    setVorschau(null);
    setMeldung(
      skipped > 0
        ? `${added} übernommen, ${skipped} waren schon da.`
        : `${added} Termine übernommen.`,
    );
    if (fileRef.current) fileRef.current.value = '';
  };

  const ausgeben = () => {
    const bloecke = state.blocks.filter((b) => b.date >= von && b.date <= bis);
    if (bloecke.length === 0) {
      setMeldung('Im Zeitraum steht nichts im Plan.');
      return;
    }
    const text = buildIcs(
      bloecke.map((block) => {
        const task = block.taskId ? state.tasks.find((t) => t.id === block.taskId) : undefined;
        return {
          uid: `${block.id}@tagesplaner`,
          title: task ? task.title : block.title,
          date: block.date,
          startMin: block.startMin,
          durationMin: block.durationMin,
          allDay: block.allDay,
          description: task?.notes || undefined,
        };
      }),
    );
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tagesplaner-${heute}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setMeldung(`${bloecke.length} Termine ausgegeben.`);
  };

  const mitUhrzeit = vorschau?.events.filter((e) => !e.allDay).length ?? 0;
  const ganztags = vorschau?.events.filter((e) => e.allDay).length ?? 0;

  return (
    <div className="settings-group">
      <h3>Kalender</h3>

      <p className="hint">
        Termine aus einem anderen Kalender einlesen, statt sie zweimal zu pflegen. Alle gängigen
        Kalender geben eine .ics-Datei aus. Gelesen wird das kommende Jahr, dazu die letzten{' '}
        {ZURUECK_TAGE} Tage – ein Arbeitskalender reicht sonst Jahre zurück.
      </p>

      <div className="button-row">
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Kalenderdatei wählen
        </button>
        <button
          className="btn"
          aria-expanded={einfuegen}
          onClick={() => {
            setEinfuegen((offen) => !offen);
            setFehler(null);
          }}
        >
          Text einfügen
        </button>
        <button className="btn" onClick={ausgeben}>
          Eigene Termine ausgeben
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        /*
          Bewusst weit gefasst. Am Handy filtert die Auswahl nach Dateityp,
          und eine .ics, die eine andere App gespeichert hat, trägt oft nur
          „application/octet-stream" – mit dem engen Filter ist sie dann
          ausgegraut. Ob es wirklich ein Kalender ist, prüft `lesenText` am
          Inhalt.
        */
        accept=".ics,text/calendar,text/plain,application/octet-stream"
        hidden
        aria-label="Kalenderdatei"
        onChange={(e) => {
          const file = e.target.files?.[0];
          /*
           * Sofort leeren, nicht erst nach dem Übernehmen. Sonst meldet der
           * Browser beim zweiten Wählen derselben Datei keine Änderung – und
           * nach einem Fehlschlag passiert beim erneuten Versuch einfach
           * nichts.
           */
          e.target.value = '';
          if (file) void lesen(file);
        }}
      />

      {einfuegen && (
        <div className="ics-einfuegen">
          <label className="field">
            <span>Kalendertext</span>
            <textarea
              rows={5}
              value={eingefuegt}
              onChange={(e) => setEingefuegt(e.target.value)}
              placeholder="BEGIN:VCALENDAR …"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </label>
          <div className="button-row">
            <span className="spacer" />
            <button
              className="btn primary"
              disabled={!eingefuegt.trim()}
              onClick={() => {
                setFehler(null);
                setMeldung(null);
                if (lesenText(eingefuegt, 'Eingefügter Text')) {
                  setEingefuegt('');
                  setEinfuegen(false);
                }
              }}
            >
              Lesen
            </button>
          </div>
        </div>
      )}

      {fehler && <p className="hint warn">{fehler}</p>}
      {meldung && <p className="hint">{meldung}</p>}

      {vorschau && (
        <div className="ics-preview">
          <p className="hint">
            <strong>{dateiname}</strong>: {vorschau.events.length}{' '}
            {vorschau.events.length === 1 ? 'Termin' : 'Termine'}
            {mitUhrzeit > 0 &&
              ganztags > 0 &&
              ` (${mitUhrzeit} mit Uhrzeit, ${ganztags} ganztägig)`}
          </p>

          {ganztags > 0 && (
            <p className="hint">
              Ganztägige Einträge landen im Streifen über der Zeitachse, nicht auf ihr. Mehrtägige
              bekommen für jeden Tag einen eigenen Eintrag.
            </p>
          )}

          <ul className="ics-list">
            {vorschau.events.slice(0, 8).map((event) => (
              <li key={event.uid}>
                <span className="muted small">{formatDateShort(event.date)}</span>{' '}
                {event.allDay
                  ? 'ganztägig'
                  : `${String(Math.floor((event.startMin ?? 0) / 60)).padStart(2, '0')}:${String(
                      (event.startMin ?? 0) % 60,
                    ).padStart(2, '0')}`}{' '}
                · {event.title}
              </li>
            ))}
            {vorschau.events.length > 8 && (
              <li className="muted small">… und {vorschau.events.length - 8} weitere</li>
            )}
          </ul>

          {vorschau.skipped.length > 0 && (
            <details className="ics-skipped">
              <summary className="hint warn">
                {vorschau.skipped.length} nicht übernommen – ansehen
              </summary>
              <ul className="ics-list">
                {vorschau.skipped.slice(0, 12).map((grund, i) => (
                  <li key={i} className="small">
                    {grund}
                  </li>
                ))}
              </ul>
            </details>
          )}

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
            {trennen && state.contexts.length > 1 && (
              <label className="field">
                <span>Privates nach</span>
                <select
                  value={privateContextId}
                  onChange={(e) => setPrivateContextId(e.target.value)}
                >
                  {state.contexts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {state.contexts.length > 1 && (
            <>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={trennen}
                  onChange={(e) => setTrennen(e.target.checked)}
                />
                <span>Privates automatisch heraussortieren</span>
              </label>
              {/*
                Die Zahlen stehen vor dem Übernehmen da, nicht danach. Eine
                Einschätzung, die man erst am Ergebnis überprüfen kann, ist
                keine Hilfe.
              */}
              <p className="hint">
                {trennen ? (
                  <>
                    Erkannt: <strong>{einschaetzung.privat}</strong> privat,{' '}
                    <strong>{einschaetzung.beruflich + einschaetzung.unklar}</strong> übriges.
                    Erkannt wird an Wörtern wie Zahnarzt, Geburtstag oder Standesamt. Was nicht
                    eindeutig ist, folgt der Auswahl links – lieber nichts sagen als falsch raten.
                  </>
                ) : (
                  <>Alle {vorschau.events.length} Termine gehen in den gewählten Bereich.</>
                )}
              </p>
            </>
          )}

          <MemberPicker
            members={state.members}
            value={memberIds}
            onChange={setMemberIds}
            label="Wessen Kalender"
            emptyHint="Ohne Angabe gelten die Termine für alle."
          />

          <div className="button-row">
            <button
              className="btn ghost"
              onClick={() => {
                setVorschau(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              Verwerfen
            </button>
            <span className="spacer" />
            <button
              className="btn primary"
              onClick={uebernehmen}
              disabled={vorschau.events.length === 0}
            >
              Übernehmen
            </button>
          </div>
        </div>
      )}

      {importiert > 0 && !vorschau && (
        <div className="button-row">
          <span className="muted small">{importiert} Einträge stammen aus einem Kalender.</span>
          <span className="spacer" />
          <button
            className="btn tiny danger ghost"
            onClick={() => {
              const weg = removeImportedCalendar();
              setMeldung(`${weg} eingelesene Einträge entfernt.`);
            }}
          >
            Eingelesene entfernen
          </button>
        </div>
      )}
    </div>
  );
}
