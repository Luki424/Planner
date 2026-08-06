import { useMemo, useRef, useState } from 'react';
import { addDays, formatDateShort, today as todayISO } from '../domain/dates';
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
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const heute = todayISO();
  const von = addDays(heute, -ZURUECK_TAGE);
  const bis = addDays(heute, VORAUS_TAGE);

  const importiert = useMemo(
    () => state.blocks.filter((b) => b.icsUid).length + state.tasks.filter((t) => t.icsUid).length,
    [state.blocks, state.tasks],
  );

  const lesen = async (file: File) => {
    setFehler(null);
    setMeldung(null);
    try {
      const text = await file.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) {
        setFehler('Das sieht nicht nach einer Kalenderdatei aus.');
        setVorschau(null);
        return;
      }
      const result = parseIcs(text, von, bis);
      setDateiname(file.name);
      setVorschau(result);
      if (result.events.length === 0 && result.skipped.length === 0) {
        setFehler('Keine Termine im gelesenen Zeitraum.');
      }
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
        <button className="btn" onClick={ausgeben}>
          Eigene Termine ausgeben
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".ics,text/calendar"
        hidden
        aria-label="Kalenderdatei"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void lesen(file);
        }}
      />

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
              Ganztägige Einträge werden Aufgaben mit Fälligkeit, keine Zeitblöcke – sonst sähe
              jeder Geburtstag aus wie ein ausgebuchter Tag.
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
          </div>

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
