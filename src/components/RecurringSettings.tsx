import { useMemo, useState } from 'react';
import {
  CATEGORIES,
  INTERVAL_LABELS,
  dueInMonth,
  fixedTotal,
  formatMonth,
  parseAmount,
  yearlyCost,
} from '../domain/budget';
import { formatEuro } from '../domain/voice';
import type { AppState, RecurringExpense, RecurringInterval } from '../domain/types';
import {
  addRecurringExpense,
  changeRecurringAmount,
  deleteRecurringExpense,
  endRecurringExpense,
} from '../storage/store';
import { MemberDots, MemberPicker } from './MemberPicker';

type Props = {
  state: AppState;
  /** Der Monat, den die Ausgabenübersicht gerade zeigt. */
  month: string;
};

const INTERVALS: RecurringInterval[] = ['monatlich', 'vierteljaehrlich', 'jaehrlich'];

/** Frühester Beginn einer Menge von Posten. */
function minStart(rules: RecurringExpense[]): string {
  return rules.reduce((min, r) => (r.startMonth < min ? r.startMonth : min), rules[0].startMonth);
}

/**
 * Feste Kosten: Miete, Strom, Versicherungen, Abos.
 *
 * Sie werden aus ihrer Regel gerechnet und nicht als einzelne Ausgaben
 * abgelegt. So fehlt kein Monat, nur weil ihn niemand geöffnet hat.
 */
export function RecurringSettings({ state, month }: Props) {
  const [erfassen, setErfassen] = useState(false);
  const [aendern, setAendern] = useState<string | null>(null);
  const [neuerBetrag, setNeuerBetrag] = useState('');
  const [entwurf, setEntwurf] = useState({
    title: '',
    betrag: '',
    category: 'Wohnen' as string,
    interval: 'monatlich' as RecurringInterval,
    memberIds: [] as string[],
  });

  /*
   * Gezeigt wird, was im betrachteten Monat gilt. Ein Posten, der erst später
   * beginnt – etwa die Miete nach einer Erhöhung –, gehört nicht in den
   * August; sonst stünde die Miete zweimal in der Liste und zählte in der
   * Jahressumme doppelt.
   */
  const gueltig = useMemo(
    () =>
      state.recurringExpenses
        .filter((r) => r.startMonth <= month && (!r.endMonth || r.endMonth >= month))
        .sort((a, b) => b.cents - a.cents),
    [state.recurringExpenses, month],
  );
  const kuenftig = useMemo(
    () => state.recurringExpenses.filter((r) => r.startMonth > month),
    [state.recurringExpenses, month],
  );
  const beendet = useMemo(
    () => state.recurringExpenses.filter((r) => r.endMonth && r.endMonth < month),
    [state.recurringExpenses, month],
  );

  const summe = fixedTotal(state.recurringExpenses, month);
  const proJahr = gueltig.reduce((sum, r) => sum + yearlyCost(r), 0);

  const speichern = () => {
    const cents = parseAmount(entwurf.betrag);
    if (cents === null) return;
    addRecurringExpense({
      title: entwurf.title,
      cents,
      category: entwurf.category,
      interval: entwurf.interval,
      memberIds: entwurf.memberIds,
      startMonth: month,
    });
    setEntwurf({ ...entwurf, title: '', betrag: '' });
    setErfassen(false);
  };

  return (
    <div className="settings-group">
      <h3>Feste Kosten</h3>

      {gueltig.length === 0 ? (
        <p className="empty">
          Miete, Strom, Versicherungen, Abos – einmal eingetragen, zählen sie in jedem Monat mit.
          Ohne sie zeigt die Übersicht nur die Einkäufe.
        </p>
      ) : (
        <>
          <p className="hint">
            {formatEuro(summe)} in {formatMonth(month)} · {formatEuro(proJahr)} im Jahr, wenn alles
            so bleibt
          </p>
          <ul className="shopping-list">
            {gueltig.map((regel) => (
              <li key={regel.id} className="shopping-row">
                <span className="shopping-main">
                  <span className="shopping-name">
                    <strong>{regel.title}</strong>
                    <MemberDots memberIds={regel.memberIds} members={state.members} withInitials />
                  </span>
                  <span className="muted small">
                    {INTERVAL_LABELS[regel.interval]} · {regel.category}
                    {!dueInMonth(regel, month) && ' · in diesem Monat nicht fällig'}
                    {regel.endMonth && ` · endet ${formatMonth(regel.endMonth)}`}
                  </span>
                </span>
                <span className="shopping-price">{formatEuro(regel.cents)}</span>
                <button
                  className="btn tiny ghost"
                  onClick={() => {
                    setAendern(aendern === regel.id ? null : regel.id);
                    setNeuerBetrag((regel.cents / 100).toFixed(2).replace('.', ','));
                  }}
                  title="Neuer Betrag ab diesem Monat – der alte bleibt für die Vergangenheit stehen"
                >
                  Betrag ändern
                </button>
                <button
                  className="btn tiny danger ghost"
                  onClick={() => deleteRecurringExpense(regel.id)}
                  aria-label={`${regel.title} entfernen`}
                  title="Ganz entfernen – auch aus vergangenen Monaten"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {aendern && (
        <ChangeAmount
          rule={state.recurringExpenses.find((r) => r.id === aendern)!}
          month={month}
          value={neuerBetrag}
          onValue={setNeuerBetrag}
          onClose={() => setAendern(null)}
        />
      )}

      <div className="button-row">
        <button className="btn" onClick={() => setErfassen(!erfassen)}>
          {erfassen ? 'Abbrechen' : '+ Fester Posten'}
        </button>
        {kuenftig.length > 0 && (
          <span className="muted small">
            {kuenftig.length} beginnt später – ab {formatMonth(minStart(kuenftig))} sichtbar.
          </span>
        )}
        {beendet.length > 0 && (
          <span className="muted small">
            {beendet.length} beendet – sie zählen weiterhin in ihren alten Monaten.
          </span>
        )}
      </div>

      {erfassen && (
        <form
          className="absence-form"
          onSubmit={(e) => {
            e.preventDefault();
            speichern();
          }}
        >
          <p className="hint">
            Gilt ab {formatMonth(month)}. Für einen früheren Beginn erst den Monat oben
            zurückblättern.
          </p>
          <div className="field-row tight">
            <label className="field">
              <span>Wofür</span>
              <input
                value={entwurf.title}
                onChange={(e) => setEntwurf({ ...entwurf, title: e.target.value })}
                placeholder="z.B. Miete"
                aria-label="Bezeichnung"
              />
            </label>
            <label className="field narrow">
              <span>Betrag</span>
              <input
                className="price-input"
                value={entwurf.betrag}
                onChange={(e) => setEntwurf({ ...entwurf, betrag: e.target.value })}
                placeholder="0,00"
                inputMode="decimal"
                aria-label="Fester Betrag"
              />
            </label>
          </div>
          <div className="field-row tight">
            <label className="field">
              <span>Rhythmus</span>
              <select
                value={entwurf.interval}
                onChange={(e) =>
                  setEntwurf({ ...entwurf, interval: e.target.value as RecurringInterval })
                }
                aria-label="Rhythmus"
              >
                {INTERVALS.map((i) => (
                  <option key={i} value={i}>
                    {INTERVAL_LABELS[i]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Kategorie</span>
              <select
                value={entwurf.category}
                onChange={(e) => setEntwurf({ ...entwurf, category: e.target.value })}
                aria-label="Kategorie"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <MemberPicker
            members={state.members}
            value={entwurf.memberIds}
            onChange={(memberIds) => setEntwurf({ ...entwurf, memberIds })}
            label="Wer trägt es"
            emptyHint="Ohne Angabe zählt der Posten als gemeinsam getragen."
          />
          {entwurf.betrag.trim() !== '' && parseAmount(entwurf.betrag) === null && (
            <p className="hint warn">Betrag bitte als Zahl, z.B. 950,00.</p>
          )}
          <div className="button-row">
            <span className="spacer" />
            <button
              className="btn primary"
              type="submit"
              disabled={parseAmount(entwurf.betrag) === null}
            >
              Eintragen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Betrag ändern.
 *
 * Der alte Posten wird beendet und ein neuer beginnt – eine Mieterhöhung ab
 * Juli soll den Juni nicht rückwirkend teurer machen.
 */
function ChangeAmount({
  rule,
  month,
  value,
  onValue,
  onClose,
}: {
  rule: RecurringExpense;
  month: string;
  value: string;
  onValue: (v: string) => void;
  onClose: () => void;
}) {
  const cents = parseAmount(value);
  const diff = cents === null ? null : cents - rule.cents;

  return (
    <form
      className="absence-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (cents === null) return;
        changeRecurringAmount(rule.id, cents, month);
        onClose();
      }}
    >
      <p className="hint">
        Neuer Betrag für <strong>{rule.title}</strong> ab {formatMonth(month)}. Frühere Monate
        behalten {formatEuro(rule.cents)} – sie waren ja so.
      </p>
      <div className="field-row tight">
        <label className="field narrow">
          <span>Neuer Betrag</span>
          <input
            className="price-input"
            value={value}
            onChange={(e) => onValue(e.target.value)}
            inputMode="decimal"
            aria-label="Neuer Betrag"
          />
        </label>
      </div>
      {diff !== null && diff !== 0 && (
        <p className="hint">
          {diff > 0 ? 'Mehr' : 'Weniger'} als bisher: {formatEuro(Math.abs(diff))} je Fälligkeit.
        </p>
      )}
      <div className="button-row">
        <button className="btn ghost" type="button" onClick={onClose}>
          Abbrechen
        </button>
        <span className="spacer" />
        <button
          className="btn tiny danger ghost"
          type="button"
          onClick={() => {
            endRecurringExpense(rule.id, month);
            onClose();
          }}
          title="Ab dem Folgemonat nicht mehr zählen"
        >
          Gekündigt
        </button>
        <button className="btn primary" type="submit" disabled={cents === null}>
          Ab {formatMonth(month)} übernehmen
        </button>
      </div>
    </form>
  );
}
