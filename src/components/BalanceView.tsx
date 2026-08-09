import { useMemo, useState } from 'react';
import { WEEKDAY_SHORT, formatDuration } from '../domain/dates';
import { timeBalance, zeitraeume, type Anteil } from '../domain/balance';
import type { AppState, Block, ID } from '../domain/types';

type Props = {
  state: AppState;
  /** Bereits nach Bereich und Person gefiltert – die Ansicht filtert nicht selbst. */
  blocks: Block[];
  today: string;
  activeContexts: Set<ID>;
};

/**
 * Wo geht die Zeit hin?
 *
 * Der Tagesplan beantwortet „passt das noch rein", die Woche „ist zu viel
 * drin". Hier steht die Frage, die man sich erst nach ein paar Monaten
 * stellt: wohin geht sie eigentlich, und geht sie bei uns beiden
 * gleichmäßig hin?
 */
export function BalanceView({ state, blocks, today, activeContexts }: Props) {
  const spannen = useMemo(() => zeitraeume(today), [today]);
  const [gewaehlt, setGewaehlt] = useState(0);
  const zeitraum = spannen[gewaehlt];

  const sichtbar = useMemo(
    () => blocks.filter((b) => activeContexts.has(b.contextId)),
    [blocks, activeContexts],
  );

  const bilanz = useMemo(
    () =>
      timeBalance(
        sichtbar,
        state.tasks,
        state.contexts,
        state.members,
        zeitraum,
        state.settings.capacityMin,
      ),
    [sichtbar, state.tasks, state.contexts, state.members, zeitraum, state.settings.capacityMin],
  );

  const hoechster = Math.max(...bilanz.proWochentag, 1);

  return (
    <div className="balance">
      <div className="segmented inline" role="tablist">
        {spannen.map((s, i) => (
          <button
            key={s.label}
            className={i === gewaehlt ? 'on' : ''}
            role="tab"
            aria-selected={i === gewaehlt}
            onClick={() => setGewaehlt(i)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {bilanz.minuten === 0 ? (
        <p className="empty">
          In diesem Zeitraum steht nichts mit Uhrzeit im Plan.
          {bilanz.ganztags > 0 && ` ${bilanz.ganztags} ganztägige Einträge gibt es.`}
        </p>
      ) : (
        <>
          <div className="balance-figures">
            <div className="balance-figure">
              <span className="balance-value">{formatDuration(bilanz.minuten)}</span>
              <span className="muted small">verplant</span>
            </div>
            <div className="balance-figure">
              <span className="balance-value">{formatDuration(bilanz.proWoche)}</span>
              <span className="muted small">je Woche</span>
            </div>
            <div className="balance-figure">
              <span className="balance-value">{bilanz.termine}</span>
              <span className="muted small">Termine</span>
            </div>
            {bilanz.ganztags > 0 && (
              <div className="balance-figure">
                <span className="balance-value">{bilanz.ganztags}</span>
                <span className="muted small">ganztägig</span>
              </div>
            )}
          </div>

          <Aufteilung
            titel="Nach Bereich"
            anteile={bilanz.nachBereich}
            hinweis="Anteil an der verplanten Zeit."
          />

          {bilanz.nachPerson.length > 0 && (
            <Aufteilung
              titel="Nach Person"
              anteile={bilanz.nachPerson}
              /*
               * Ohne diesen Satz wirkt die Aufteilung wie eine Verteilung
               * von hundert Prozent – und ein gemeinsamer Termin, der bei
               * beiden voll zählt, sähe nach einem Rechenfehler aus.
               */
              hinweis="Ein gemeinsamer Termin zählt bei beiden voll – die Frage ist, wie viel bei wem ansteht."
            />
          )}

          <div className="settings-group">
            <h3>Über die Woche verteilt</h3>
            <div className="balance-days">
              {bilanz.proWochentag.map((min, i) => (
                <div
                  key={i}
                  className="balance-day"
                  title={`${WEEKDAY_SHORT[i]}: ${formatDuration(min)}`}
                >
                  <div className="balance-bar">
                    <div
                      className={`balance-fill${i === bilanz.vollsterTag?.index ? ' top' : ''}`}
                      style={{ height: `${Math.round((min / hoechster) * 100)}%` }}
                    />
                  </div>
                  <span className="muted small">{WEEKDAY_SHORT[i]}</span>
                </div>
              ))}
            </div>
            <p className="hint">
              {bilanz.vollsterTag && (
                <>
                  Am vollsten ist der <strong>{bilanz.vollsterTag.name}</strong> mit{' '}
                  {formatDuration(bilanz.vollsterTag.minuten)}.{' '}
                </>
              )}
              {bilanz.ueberTage > 0 && (
                <>
                  An <strong>{bilanz.ueberTage}</strong> {bilanz.ueberTage === 1 ? 'Tag' : 'Tagen'}{' '}
                  stand mehr an als die Tageskapazität.{' '}
                </>
              )}
              {bilanz.freieTage > 0 && (
                <>
                  <strong>{bilanz.freieTage}</strong> von {bilanz.tage} Tagen waren ganz frei.
                </>
              )}
            </p>
          </div>

          {/*
            Was hier steht, ist Geplantes, nicht Gelebtes. Der Planer weiß
            nicht, ob ein Termin stattgefunden hat – das gehört dazugesagt,
            sonst liest man die Zahlen als Nachweis.
          */}
          <p className="hint">
            Gerechnet wird mit dem, was im Plan stand – nicht damit, was am Ende wirklich passiert
            ist. Ganztägiges bleibt außen vor, es belegt keine Stunden.
          </p>
        </>
      )}
    </div>
  );
}

function Aufteilung({
  titel,
  anteile,
  hinweis,
}: {
  titel: string;
  anteile: Anteil[];
  hinweis: string;
}) {
  return (
    <div className="settings-group">
      <h3>{titel}</h3>
      <ul className="balance-split">
        {anteile.map((a) => (
          <li key={a.id}>
            <span className="balance-split-name">
              <span className="dot" style={{ background: a.farbe }} aria-hidden="true" />
              {a.name}
            </span>
            <span className="load-bar balance-split-bar">
              <span className="load-fill" style={{ width: `${a.prozent}%`, background: a.farbe }} />
            </span>
            <span className="balance-split-value">
              {formatDuration(a.minuten)} <span className="muted small">{a.prozent} %</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">{hinweis}</p>
    </div>
  );
}
