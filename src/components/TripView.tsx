import { useMemo, useState } from 'react';
import { formatDateShort } from '../domain/dates';
import { workdaysInRange } from '../domain/leave';
import type { AppState, TripItemKind } from '../domain/types';
import { formatEuro } from '../domain/voice';
import {
  addTripItem,
  deleteTrip,
  deleteTripItem,
  toggleTripItem,
  updateTrip,
  updateTripItem,
} from '../storage/store';

type Props = {
  state: AppState;
  tripId: string;
  onBack: () => void;
};

const TABS: Array<[TripItemKind, string]> = [
  ['packliste', 'Packliste'],
  ['programm', 'Programm'],
  ['budget', 'Budget'],
];

/** "1,50" → Cent; leer → null; ungültig → undefined. */
function parsePrice(value: string): number | null | undefined {
  const trimmed = value.trim().replace('€', '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

export function TripView({ state, tripId, onBack }: Props) {
  const trip = state.trips.find((t) => t.id === tripId);
  const [tab, setTab] = useState<TripItemKind>('packliste');
  const [draft, setDraft] = useState('');
  const [draftPrice, setDraftPrice] = useState('');
  const [draftDate, setDraftDate] = useState('');

  const items = useMemo(
    () =>
      state.tripItems
        .filter((i) => i.tripId === tripId && i.kind === tab)
        .sort((a, b) => {
          // Programmpunkte nach Tag, alles andere nach Erfassung.
          if (tab === 'programm') return (a.date ?? '') < (b.date ?? '') ? -1 : 1;
          return a.createdAt < b.createdAt ? -1 : 1;
        }),
    [state.tripItems, tripId, tab],
  );

  const budget = useMemo(
    () => state.tripItems.filter((i) => i.tripId === tripId && i.kind === 'budget'),
    [state.tripItems, tripId],
  );
  const budgetTotal = budget.reduce((sum, i) => sum + (i.estimatedCents ?? 0), 0);
  const budgetOpen = budget
    .filter((i) => !i.done)
    .reduce((sum, i) => sum + (i.estimatedCents ?? 0), 0);

  if (!trip) {
    return (
      <section className="panel wide">
        <p className="empty">Diese Reise gibt es nicht mehr.</p>
        <div className="button-row">
          <button className="btn" onClick={onBack}>
            Zurück
          </button>
        </div>
      </section>
    );
  }

  const packed = state.tripItems.filter(
    (i) => i.tripId === tripId && i.kind === 'packliste' && i.done,
  ).length;
  const packTotal = state.tripItems.filter(
    (i) => i.tripId === tripId && i.kind === 'packliste',
  ).length;

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    const price = tab === 'budget' ? parsePrice(draftPrice) : null;
    if (price === undefined) return;
    addTripItem({
      tripId,
      kind: tab,
      title,
      estimatedCents: price,
      date: tab === 'programm' ? draftDate || trip.startDate : null,
    });
    setDraft('');
    setDraftPrice('');
  };

  return (
    <section className="panel wide trip">
      <header className="panel-head">
        <button className="btn ghost tiny" onClick={onBack}>
          ‹ Urlaub
        </button>
        <h2>{trip.title}</h2>
      </header>

      <div className="trip-head">
        <input
          className="trip-title"
          value={trip.title}
          onChange={(e) => updateTrip(tripId, { title: e.target.value })}
          aria-label="Titel der Reise"
        />
        <div className="field-row tight">
          <label className="field">
            <span>Ziel</span>
            <input
              value={trip.destination}
              onChange={(e) => updateTrip(tripId, { destination: e.target.value })}
              placeholder="Wohin geht es?"
            />
          </label>
          <label className="field">
            <span>Von</span>
            <input
              type="date"
              value={trip.startDate}
              onChange={(e) => updateTrip(tripId, { startDate: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Bis</span>
            <input
              type="date"
              value={trip.endDate}
              onChange={(e) => updateTrip(tripId, { endDate: e.target.value })}
            />
          </label>
        </div>
        <p className="hint">
          {formatDateShort(trip.startDate)}–{formatDateShort(trip.endDate)} ·{' '}
          {workdaysInRange(trip.startDate, trip.endDate, new Map())} Wochentage · Packliste{' '}
          {packed}/{packTotal} · Budget {formatEuro(budgetTotal)}
        </p>
      </div>

      <div className="segmented inline">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'budget' && budget.length > 0 && (
        <div className="shopping-total">
          <div>
            <span className="total-value">{formatEuro(budgetOpen)}</span>
            <span className="muted small"> noch offen</span>
          </div>
          <span className="muted small">gesamt geplant {formatEuro(budgetTotal)}</span>
        </div>
      )}

      <form
        className={tab === 'budget' ? 'shopping-add' : 'inline-form'}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            tab === 'packliste'
              ? 'Was muss mit?'
              : tab === 'programm'
                ? 'Was steht an?'
                : 'Wofür geht Geld drauf?'
          }
          aria-label="Neuer Eintrag"
        />
        {tab === 'budget' && (
          <input
            className="price-input"
            value={draftPrice}
            onChange={(e) => setDraftPrice(e.target.value)}
            placeholder="€"
            inputMode="decimal"
            aria-label="Geschätzte Kosten"
          />
        )}
        {tab === 'programm' && (
          <input
            type="date"
            value={draftDate || trip.startDate}
            onChange={(e) => setDraftDate(e.target.value)}
            aria-label="Tag"
          />
        )}
        <button className="btn primary" type="submit" disabled={!draft.trim()}>
          +
        </button>
      </form>

      <ul className="shopping-list">
        {items.map((item) => (
          <li key={item.id} className={`shopping-row${item.done ? ' done' : ''}`}>
            <button
              className="check"
              aria-label={item.done ? 'Wieder offen' : 'Erledigt'}
              onClick={() => toggleTripItem(item.id)}
            />
            <span className="shopping-main">
              <span className="shopping-name">
                {item.kind === 'programm' && item.date && (
                  <span className="qty">{formatDateShort(item.date)}</span>
                )}
                {item.title}
              </span>
            </span>
            {item.kind === 'budget' && (
              <input
                className="price-input inline-price"
                defaultValue={
                  item.estimatedCents === null
                    ? ''
                    : (item.estimatedCents / 100).toFixed(2).replace('.', ',')
                }
                onBlur={(e) => {
                  const value = parsePrice(e.target.value);
                  if (value !== undefined) updateTripItem(item.id, { estimatedCents: value });
                }}
                inputMode="decimal"
                aria-label="Geschätzte Kosten"
              />
            )}
            <button
              className="btn tiny danger ghost"
              onClick={() => deleteTripItem(item.id)}
              aria-label="Eintrag löschen"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="empty">
          {tab === 'packliste'
            ? 'Noch nichts auf der Packliste.'
            : tab === 'programm'
              ? 'Noch nichts geplant.'
              : 'Noch keine Kostenpunkte.'}
        </p>
      )}

      <div className="settings-group">
        <label className="field">
          <span>Notizen</span>
          <textarea
            rows={3}
            value={trip.notes}
            onChange={(e) => updateTrip(tripId, { notes: e.target.value })}
          />
        </label>
        <div className="button-row">
          <button
            className="btn danger ghost"
            onClick={() => {
              if (confirm(`Reise „${trip.title}" mit allen Einträgen löschen?`)) {
                deleteTrip(tripId);
                onBack();
              }
            }}
          >
            Reise löschen
          </button>
        </div>
      </div>
    </section>
  );
}
