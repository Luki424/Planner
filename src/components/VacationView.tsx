import { useMemo, useState } from 'react';
import { formatDateShort, today as todayISO } from '../domain/dates';
import { holidayMap, type Bundesland } from '../domain/holidays';
import { ABSENCE_LABELS, balanceFor, workdaysInRange } from '../domain/leave';
import type { AppState, Absence, AbsenceKind } from '../domain/types';
import { addAbsence, addMember, deleteAbsence, setLeaveYear } from '../storage/store';
import { YearStrip } from './YearStrip';

type Props = {
  state: AppState;
  today: string;
  onOpenTrip: (tripId: string) => void;
  onNewTrip: (absence: Absence) => void;
};

const KINDS: AbsenceKind[] = ['urlaub', 'gleitzeit', 'krank', 'sonstiges'];

export function VacationView({ state, today, onOpenTrip, onNewTrip }: Props) {
  const [year, setYear] = useState(() => Number(todayISO().slice(0, 4)));
  const [draft, setDraft] = useState<{
    memberId: string;
    kind: AbsenceKind;
    startDate: string;
    endDate: string;
    note: string;
  } | null>(null);

  const { members, absences, leaveYears, trips } = state;
  const holidays = useMemo(
    () => holidayMap([year - 1, year, year + 1], state.settings.bundesland as Bundesland),
    [year, state.settings.bundesland],
  );

  const balances = useMemo(
    () => members.map((m) => balanceFor(m, year, absences, leaveYears, holidays, today)),
    [members, year, absences, leaveYears, holidays, today],
  );

  const yearAbsences = useMemo(
    () =>
      absences
        .filter((a) => a.startDate.slice(0, 4) <= String(year) && a.endDate.slice(0, 4) >= String(year))
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    [absences, year],
  );

  if (members.length === 0) {
    return (
      <section className="panel wide">
        <header className="panel-head">
          <h2>Urlaub</h2>
        </header>
        <p className="empty">
          Für den Urlaubsplaner fehlen noch die Personen. Lege sie an – für jede wird der
          Jahresanspruch getrennt geführt.
        </p>
        <div className="button-row">
          <button
            className="btn primary"
            onClick={() => {
              addMember('Lukas', '#2e6f63', 30);
              addMember('Svenja', '#a3741f', 30);
            }}
          >
            Lukas und Svenja anlegen
          </button>
          <button className="btn" onClick={() => addMember('Person', '#2e6f63', 30)}>
            Einzelne Person
          </button>
        </div>
      </section>
    );
  }

  const startDraft = (date?: string) =>
    setDraft({
      memberId: members[0].id,
      kind: 'urlaub',
      startDate: date ?? today,
      endDate: date ?? today,
      note: '',
    });

  return (
    <section className="panel wide vacation">
      <header className="panel-head">
        <h2>Urlaub</h2>
        <div className="date-nav">
          <button className="icon-btn" onClick={() => setYear(year - 1)} aria-label="Vorjahr">
            ‹
          </button>
          <strong>{year}</strong>
          <button className="icon-btn" onClick={() => setYear(year + 1)} aria-label="Folgejahr">
            ›
          </button>
        </div>
      </header>

      <div className="balances">
        {balances.map((balance) => {
          const member = members.find((m) => m.id === balance.memberId)!;
          return (
            <div
              className="balance"
              key={balance.memberId}
              style={{ '--accent': member.color } as React.CSSProperties}
            >
              <div className="balance-head">
                <span className="dot" />
                <strong>{member.name}</strong>
              </div>
              <div className={`balance-value${balance.remaining < 0 ? ' over' : ''}`}>
                {balance.remaining}
                <span className="balance-unit">
                  {Math.abs(balance.remaining) === 1 ? 'Tag' : 'Tage'} übrig
                </span>
              </div>
              <div className="balance-detail muted small">
                {balance.entitlement} Anspruch
                {balance.carryOver > 0 && ` + ${balance.carryOver} Übertrag`} · {balance.taken}{' '}
                genommen · {balance.planned} geplant
              </div>
              <div className="field-row tight">
                <label className="field">
                  <span>Anspruch</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={balance.entitlement}
                    onChange={(e) =>
                      setLeaveYear(member.id, year, { entitlementDays: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  <span>Übertrag</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={balance.carryOver}
                    onChange={(e) =>
                      setLeaveYear(member.id, year, { carryOverDays: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <YearStrip
        year={year}
        members={members}
        absences={absences}
        holidays={holidays}
        today={today}
        onPickDay={(date) => startDraft(date)}
      />

      <div className="button-row">
        <button className="btn primary" onClick={() => startDraft()}>
          + Abwesenheit
        </button>
        <span className="muted small hide-narrow">
          Oder im Jahresband auf einen Tag tippen.
        </span>
      </div>

      {draft && (
        <form
          className="absence-form"
          onSubmit={(e) => {
            e.preventDefault();
            addAbsence(draft);
            setDraft(null);
          }}
        >
          <div className="field-row tight">
            <label className="field">
              <span>Wer</span>
              <select
                value={draft.memberId}
                onChange={(e) => setDraft({ ...draft, memberId: e.target.value })}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Art</span>
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as AbsenceKind })}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ABSENCE_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="field-row tight">
            <label className="field">
              <span>Von</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Bis</span>
              <input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </label>
          </div>
          <p className="hint">
            {draft.kind === 'urlaub'
              ? `${workdaysInRange(draft.startDate, draft.endDate, holidays)} Urlaubstage – Wochenenden und Feiertage zählen nicht mit.`
              : 'Verbraucht keinen Urlaubsanspruch.'}
          </p>
          <div className="button-row">
            <button className="btn ghost" type="button" onClick={() => setDraft(null)}>
              Abbrechen
            </button>
            <span className="spacer" />
            <button className="btn primary" type="submit">
              Eintragen
            </button>
          </div>
        </form>
      )}

      <div className="settings-group">
        <h3>Abwesenheiten {year}</h3>
        <ul className="absence-list">
          {yearAbsences.map((absence) => {
            const member = members.find((m) => m.id === absence.memberId);
            const trip = trips.find((t) => t.id === absence.tripId);
            const days = workdaysInRange(absence.startDate, absence.endDate, holidays);
            return (
              <li
                key={absence.id}
                className="absence-row"
                style={{ '--accent': member?.color } as React.CSSProperties}
              >
                <div className="absence-main">
                  <strong>
                    {formatDateShort(absence.startDate)}–{formatDateShort(absence.endDate)}
                  </strong>
                  <span className="task-meta">
                    <span className="dot" />
                    {member?.name} · {ABSENCE_LABELS[absence.kind]}
                    {absence.kind === 'urlaub' && ` · ${days} ${days === 1 ? 'Tag' : 'Tage'}`}
                  </span>
                </div>
                {trip ? (
                  <button className="btn tiny" onClick={() => onOpenTrip(trip.id)}>
                    {trip.title}
                  </button>
                ) : (
                  absence.kind === 'urlaub' && (
                    <button className="btn tiny ghost" onClick={() => onNewTrip(absence)}>
                      Reise anlegen
                    </button>
                  )
                )}
                <button
                  className="btn tiny danger ghost"
                  onClick={() => deleteAbsence(absence.id)}
                  aria-label="Abwesenheit löschen"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
        {yearAbsences.length === 0 && (
          <p className="empty">Für {year} ist noch nichts eingetragen.</p>
        )}
      </div>
    </section>
  );
}
