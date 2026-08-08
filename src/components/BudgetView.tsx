import { useMemo, useState } from 'react';
import {
  CATEGORIES,
  estimateDeviation,
  formatMonth,
  memberLabel,
  monthKey,
  monthlyTotals,
  parseAmount,
  recentMonths,
  shiftMonth,
  summarizeMonth,
} from '../domain/budget';
import { formatDateShort, today as todayISO } from '../domain/dates';
import { knownMembers } from '../domain/people';
import { formatEuro } from '../domain/voice';
import type { AppState, Expense } from '../domain/types';
import { addExpense, addReceipt, deleteExpense, deleteReceipt } from '../storage/store';
import { ReceiptPicker, ReceiptView } from './ReceiptPicker';
import { MemberDots, MemberPicker } from './MemberPicker';
import { RecurringSettings } from './RecurringSettings';

type Props = {
  state: AppState;
  /** Wer gerade angemeldet ist – steht später am nachgetragenen Beleg. */
  displayName?: string | null;
};

/**
 * Haushaltskasse.
 *
 * Nicht als Buchhaltung gedacht, sondern als Antwort auf zwei Fragen: wohin
 * geht das Geld, und stimmen die Schätzungen auf der Einkaufsliste?
 */
export function BudgetView({ state, displayName = null }: Props) {
  const heute = todayISO();
  const [monat, setMonat] = useState(() => monthKey(heute));
  const [erfassen, setErfassen] = useState(false);
  const [entwurf, setEntwurf] = useState({
    date: heute,
    title: '',
    betrag: '',
    category: 'Lebensmittel' as string,
    memberIds: [] as string[],
  });

  const uebersicht = useMemo(
    () => summarizeMonth(state.expenses, monat, state.recurringExpenses),
    [state.expenses, state.recurringExpenses, monat],
  );
  const abweichung = estimateDeviation(uebersicht);
  const monate = useMemo(() => recentMonths(monthKey(heute), 6), [heute]);
  const verlauf = useMemo(
    () => monthlyTotals(state.expenses, monate, state.recurringExpenses),
    [state.expenses, state.recurringExpenses, monate],
  );
  const hoechster = Math.max(1, ...verlauf.map((v) => v.cents));

  const imMonat = useMemo(
    () =>
      state.expenses
        .filter((e) => monthKey(e.date) === monat)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [state.expenses, monat],
  );

  const speichern = () => {
    const cents = parseAmount(entwurf.betrag);
    if (cents === null) return;
    addExpense({
      date: entwurf.date,
      title: entwurf.title,
      cents,
      category: entwurf.category,
      memberIds: entwurf.memberIds,
    });
    setEntwurf({ ...entwurf, title: '', betrag: '' });
    setErfassen(false);
  };

  return (
    <div className="budget">
      <header className="panel-head slim">
        <h3>Ausgaben</h3>
        <div className="date-nav">
          <button
            className="icon-btn"
            onClick={() => setMonat(shiftMonth(monat, -1))}
            aria-label="Vormonat"
          >
            ‹
          </button>
          <strong>{formatMonth(monat)}</strong>
          <button
            className="icon-btn"
            onClick={() => setMonat(shiftMonth(monat, 1))}
            aria-label="Folgemonat"
          >
            ›
          </button>
        </div>
      </header>

      <div className="shopping-total">
        <div>
          <span className="total-value">{formatEuro(uebersicht.total)}</span>
          <span className="muted small">
            {' '}
            in {uebersicht.count} {uebersicht.count === 1 ? 'Ausgabe' : 'Ausgaben'}
          </span>
        </div>
        {uebersicht.fixed > 0 && (
          <span className="muted small">
            davon fest {formatEuro(uebersicht.fixed)} · beeinflussbar{' '}
            {formatEuro(uebersicht.variable)}
          </span>
        )}
        {abweichung && (
          <span className={`muted small${Math.abs(abweichung.percent) >= 15 ? ' warn-text' : ''}`}>
            {abweichung.cents === 0
              ? 'Schätzungen trafen genau'
              : `${abweichung.cents > 0 ? 'teurer' : 'günstiger'} als geschätzt: ${formatEuro(
                  Math.abs(abweichung.cents),
                )} (${Math.abs(abweichung.percent)} %)`}
          </span>
        )}
      </div>

      {uebersicht.count === 0 ? (
        <p className="empty">
          Für {formatMonth(monat)} ist nichts erfasst. Auf der Einkaufsliste bucht{' '}
          <em>Als Ausgabe buchen</em> den Wagen mit einem Griff hierher – feste Kosten wie Miete
          trägst du unten einmal ein und sie zählen von da an in jedem Monat.
        </p>
      ) : (
        <>
          <div className="settings-group">
            <h3>Wofür</h3>
            <ul className="budget-bars">
              {uebersicht.byCategory.map((eintrag) => (
                <li key={eintrag.category} className="budget-bar">
                  <span className="budget-bar-name">{eintrag.category}</span>
                  <div className="load-bar">
                    <div
                      className="load-fill"
                      style={{ width: `${Math.round((eintrag.cents / uebersicht.total) * 100)}%` }}
                    />
                  </div>
                  <span className="budget-bar-value">{formatEuro(eintrag.cents)}</span>
                </li>
              ))}
            </ul>
          </div>

          {state.members.length > 0 && uebersicht.byMember.length > 0 && (
            <div className="settings-group">
              <h3>Wer</h3>
              <ul className="budget-bars">
                {uebersicht.byMember.map((eintrag) => (
                  <li key={eintrag.memberId ?? 'gemeinsam'} className="budget-bar">
                    <span className="budget-bar-name">
                      {memberLabel(eintrag.memberId, state.members)}
                    </span>
                    <div className="load-bar">
                      <div
                        className="load-fill"
                        style={{
                          width: `${Math.round((eintrag.cents / uebersicht.total) * 100)}%`,
                          background:
                            state.members.find((m) => m.id === eintrag.memberId)?.color ??
                            undefined,
                        }}
                      />
                    </div>
                    <span className="budget-bar-value">{formatEuro(eintrag.cents)}</span>
                  </li>
                ))}
              </ul>
              <p className="hint">
                Eine gemeinsam getragene Ausgabe wird geteilt – die Anteile ergeben zusammen den
                Betrag.
              </p>
            </div>
          )}
        </>
      )}

      <div className="settings-group">
        <h3>Verlauf</h3>
        <ul className="budget-bars">
          {verlauf.map((eintrag) => (
            <li
              key={eintrag.month}
              className={`budget-bar${eintrag.month === monat ? ' current' : ''}`}
            >
              <button className="budget-bar-name link" onClick={() => setMonat(eintrag.month)}>
                {formatMonth(eintrag.month).replace(/ \d{4}$/, '')}
              </button>
              <div className="load-bar">
                <div
                  className="load-fill"
                  style={{ width: `${Math.round((eintrag.cents / hoechster) * 100)}%` }}
                />
              </div>
              <span className="budget-bar-value">
                {eintrag.cents > 0 ? formatEuro(eintrag.cents) : '–'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="button-row">
        <button className="btn primary" onClick={() => setErfassen(!erfassen)}>
          {erfassen ? 'Abbrechen' : '+ Ausgabe'}
        </button>
      </div>

      {erfassen && (
        <form
          className="absence-form"
          onSubmit={(e) => {
            e.preventDefault();
            speichern();
          }}
        >
          <div className="field-row tight">
            <label className="field">
              <span>Wofür</span>
              <input
                value={entwurf.title}
                onChange={(e) => setEntwurf({ ...entwurf, title: e.target.value })}
                placeholder="z.B. Wocheneinkauf"
                aria-label="Wofür"
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
                aria-label="Betrag"
              />
            </label>
          </div>
          <div className="field-row tight">
            <label className="field">
              <span>Kategorie</span>
              <select
                value={entwurf.category}
                onChange={(e) => setEntwurf({ ...entwurf, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Wann</span>
              <input
                type="date"
                value={entwurf.date}
                onChange={(e) => setEntwurf({ ...entwurf, date: e.target.value })}
              />
            </label>
          </div>
          <MemberPicker
            members={state.members}
            value={entwurf.memberIds}
            onChange={(memberIds) => setEntwurf({ ...entwurf, memberIds })}
            label="Wer hat bezahlt"
            emptyHint="Ohne Angabe zählt die Ausgabe als gemeinsam getragen."
          />
          {entwurf.betrag.trim() !== '' && parseAmount(entwurf.betrag) === null && (
            <p className="hint warn">Betrag bitte als Zahl, z.B. 12,50.</p>
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

      <RecurringSettings state={state} month={monat} />

      {imMonat.length > 0 && (
        <div className="settings-group">
          <h3>Einzeln erfasst</h3>
          <ul className="shopping-list">
            {imMonat.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                state={state}
                displayName={displayName}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ExpenseRow({
  expense,
  state,
  displayName,
}: {
  expense: Expense;
  state: AppState;
  displayName: string | null;
}) {
  const abweichung =
    expense.estimatedCents !== null && expense.estimatedCents > 0
      ? expense.cents - expense.estimatedCents
      : null;
  const beleg = state.receipts.find((r) => r.expenseId === expense.id) ?? null;
  const [nachtragen, setNachtragen] = useState(false);

  return (
    <li className="shopping-row">
      <span className="shopping-main">
        <span className="shopping-name">
          <strong>{expense.title}</strong>
          <MemberDots
            memberIds={expense.memberIds}
            members={knownMembers(expense.memberIds, state.members)}
            withInitials
          />
        </span>
        <span className="muted small">
          {formatDateShort(expense.date)} · {expense.category}
          {abweichung !== null &&
            ` · geschätzt ${formatEuro(expense.estimatedCents!)}${
              abweichung === 0
                ? ' (genau)'
                : ` (${abweichung > 0 ? '+' : '−'}${formatEuro(Math.abs(abweichung))})`
            }`}
        </span>
      </span>
      {/*
        Der Beleg steht als Daumennagel in der Zeile. Fehlt er, gibt es einen
        stillen Knopf zum Nachtragen – man fotografiert den Bon nicht immer
        im Laden, sondern manchmal erst abends aus der Jackentasche.
      */}
      {beleg ? (
        <ReceiptView image={beleg.image} onDelete={() => deleteReceipt(beleg.id)} />
      ) : nachtragen ? (
        <ReceiptPicker
          value={null}
          onChange={(bild) => {
            if (bild) addReceipt(expense.id, bild, displayName);
            setNachtragen(false);
          }}
        />
      ) : (
        <button
          className="btn tiny ghost"
          onClick={() => setNachtragen(true)}
          title="Beleg nachträglich fotografieren"
          aria-label="Beleg nachtragen"
        >
          <span aria-hidden="true">📷</span>
        </button>
      )}
      <span className="shopping-price">{formatEuro(expense.cents)}</span>
      <button
        className="btn tiny danger ghost"
        onClick={() => deleteExpense(expense.id)}
        aria-label="Ausgabe löschen"
      >
        ×
      </button>
    </li>
  );
}
