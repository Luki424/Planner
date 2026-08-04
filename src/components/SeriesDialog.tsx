import { useState } from 'react';
import { WEEKDAY_SHORT, formatTime, parseTime, today, weekdayIndex } from '../domain/dates';
import type { Context, RecurrencePattern, Series } from '../domain/types';
import { addSeries, deleteSeries, updateSeries } from '../storage/store';
import { Modal } from './Modal';

type Props = {
  series: Series | null;
  contexts: Context[];
  defaultContextId: string;
  onClose: () => void;
};

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

export function SeriesDialog({ series, contexts, defaultContextId, onClose }: Props) {
  const start = series?.startDate ?? today();
  const [title, setTitle] = useState(series?.title ?? '');
  const [notes, setNotes] = useState(series?.notes ?? '');
  const [contextId, setContextId] = useState(series?.contextId ?? defaultContextId);
  const [estimateMin, setEstimateMin] = useState(series?.estimateMin ?? 30);
  const [type, setType] = useState<RecurrencePattern['type']>(series?.pattern.type ?? 'weekly');
  const [interval, setInterval] = useState(
    series?.pattern.type === 'daily' || series?.pattern.type === 'weekly' ? series.pattern.interval : 1,
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    series?.pattern.type === 'weekly' ? series.pattern.weekdays : [weekdayIndex(start)],
  );
  const [monthDay, setMonthDay] = useState(
    series?.pattern.type === 'monthly' ? series.pattern.day : Number(start.slice(8, 10)),
  );
  const [startDate, setStartDate] = useState(start);
  const [endDate, setEndDate] = useState(series?.endDate ?? '');
  const [autoSchedule, setAutoSchedule] = useState(series?.autoScheduleMin !== null && series !== null);
  const [autoTime, setAutoTime] = useState(formatTime(series?.autoScheduleMin ?? 9 * 60));

  const autoValue = parseTime(autoTime);
  const patternValid = type !== 'weekly' || weekdays.length > 0;
  const valid = title.trim().length > 0 && patternValid && (!autoSchedule || autoValue !== null);

  const buildPattern = (): RecurrencePattern => {
    if (type === 'daily') return { type: 'daily', interval: Math.max(1, interval) };
    if (type === 'monthly') return { type: 'monthly', day: Math.min(31, Math.max(1, monthDay)) };
    return { type: 'weekly', interval: Math.max(1, interval), weekdays: [...weekdays].sort((a, b) => a - b) };
  };

  const save = () => {
    if (!valid) return;
    const payload = {
      title: title.trim(),
      notes,
      contextId,
      estimateMin,
      pattern: buildPattern(),
      startDate,
      endDate: endDate || null,
      autoScheduleMin: autoSchedule ? autoValue : null,
    };
    if (series) updateSeries(series.id, payload);
    else addSeries(payload);
    onClose();
  };

  const toggleWeekday = (day: number) =>
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  return (
    <Modal
      title={series ? 'Serie bearbeiten' : 'Wiederkehrende Aufgabe'}
      onClose={onClose}
      footer={
        <>
          {series && (
            <button
              className="btn danger ghost"
              onClick={() => {
                deleteSeries(series.id);
                onClose();
              }}
            >
              Löschen
            </button>
          )}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={save} disabled={!valid}>
            Speichern
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field">
          <span>Titel</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Mails durchgehen"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Bereich</span>
            <select value={contextId} onChange={(e) => setContextId(e.target.value)}>
              {contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Dauer</span>
            <select value={estimateMin} onChange={(e) => setEstimateMin(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} h`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Rhythmus</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as RecurrencePattern['type'])}
            >
              <option value="daily">täglich</option>
              <option value="weekly">wöchentlich</option>
              <option value="monthly">monatlich</option>
            </select>
          </label>
        </div>

        {type !== 'monthly' && (
          <label className="field">
            <span>Alle … {type === 'daily' ? 'Tage' : 'Wochen'}</span>
            <input
              type="number"
              min={1}
              max={12}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
            />
          </label>
        )}

        {type === 'weekly' && (
          <div className="field">
            <span>An welchen Tagen</span>
            <div className="weekday-picker">
              {WEEKDAY_SHORT.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className={`chip${weekdays.includes(day) ? ' on' : ''}`}
                  onClick={() => toggleWeekday(day)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!patternValid && <p className="hint warn">Mindestens einen Wochentag wählen.</p>}
          </div>
        )}

        {type === 'monthly' && (
          <label className="field">
            <span>Am … des Monats</span>
            <input
              type="number"
              min={1}
              max={31}
              value={monthDay}
              onChange={(e) => setMonthDay(Number(e.target.value))}
            />
            <small className="hint">
              In kürzeren Monaten rutscht der Termin auf den letzten Tag.
            </small>
          </label>
        )}

        <div className="field-row">
          <label className="field">
            <span>Ab</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Bis (optional)</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>

        <label className="check-field">
          <input
            type="checkbox"
            checked={autoSchedule}
            onChange={(e) => setAutoSchedule(e.target.checked)}
          />
          <span>Direkt fest einplanen um</span>
          <input
            className="time-input"
            value={autoTime}
            onChange={(e) => setAutoTime(e.target.value)}
            disabled={!autoSchedule}
            placeholder="09:00"
          />
        </label>
        <p className="hint">
          Ohne feste Uhrzeit landet die Aufgabe im Pool und du planst sie selbst ein.
        </p>

        <label className="field">
          <span>Notizen</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
